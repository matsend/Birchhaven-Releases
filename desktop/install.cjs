'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function stopped(root){
 const lock=path.join(root,'birchhaven-solo-data.lock');
 if(!fs.existsSync(lock))return;
 const pid=Number(fs.readFileSync(lock,'utf8'));
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('Sparningens låsfil är ogiltig. Ingen data har ändrats.');
 try{process.kill(pid,0);throw Error('Stäng den gamla Birchhaven-starten innan du fortsätter.');}catch(e){if(e.code!=='ESRCH')throw e;}
}
function copyTree(source,dest){
 const s=fs.lstatSync(source);if(s.isSymbolicLink())throw Error('Länkade spelfiler kan inte kopieras: '+source);
 if(s.isDirectory()){fs.mkdirSync(dest,{recursive:true});for(const n of fs.readdirSync(source))copyTree(path.join(source,n),path.join(dest,n));}
 else if(s.isFile()){fs.copyFileSync(source,dest);if(fs.statSync(dest).size!==s.size)throw Error('Kopieringen kunde inte kontrolleras.');}
 else throw Error('Ogiltig spelfil.');
}
function treeDigest(root){const h=crypto.createHash('sha256');function walk(dir,rel=''){for(const n of fs.readdirSync(dir).sort()){const p=path.join(dir,n),r=rel+'/'+n,s=fs.lstatSync(p);if(s.isSymbolicLink())throw Error('Länkad sparfil.');if(s.isDirectory())walk(p,r);else if(s.isFile()){h.update(r+'\0');h.update(fs.readFileSync(p));}else throw Error('Ogiltig sparfil.');}}walk(root);return h.digest('hex');}
function copySave(source,dest){const before=treeDigest(source);copyTree(source,dest);if(before!==treeDigest(dest)||before!==treeDigest(source))throw Error('Sparningen ändrades under kopieringen. Stäng det gamla spelet.');}
// Both renames are on one volume. An interrupted swap is recovered before the
// next launch. The old runtime (including its saves) remains until next upgrade.
function provision(template,userData,version){
 const root=path.join(userData,'game'),previous=root+'.previous',stage=root+'.staging';fs.mkdirSync(userData,{recursive:true});
 if(!fs.existsSync(root)&&fs.existsSync(previous))fs.renameSync(previous,root);
 stopped(root);
 recoverImport(root);
 try{if(JSON.parse(fs.readFileSync(path.join(root,'.desktop-version.json'))).version===version)return root;}catch{}
 fs.rmSync(stage,{recursive:true,force:true});
 try{
  copyTree(template,stage);
  if(fs.existsSync(root))for(const n of ['birchhaven-solo-data','birchhaven-solo-data-backups'])if(fs.existsSync(path.join(root,n)))copySave(path.join(root,n),path.join(stage,n));
  fs.writeFileSync(path.join(stage,'.desktop-version.json'),JSON.stringify({version})+'\n');
  stopped(root);fs.rmSync(previous,{recursive:true,force:true});
  if(fs.existsSync(root))fs.renameSync(root,previous);
  fs.renameSync(stage,root);return root;
 }catch(e){if(!fs.existsSync(root)&&fs.existsSync(previous))fs.renameSync(previous,root);throw e;}
}
function recoverImport(root){
 const journal=path.join(root,'.save-import.json');if(!fs.existsSync(journal))return;
 const dest=path.join(root,'birchhaven-solo-data'),stage=dest+'.importing';
 const record=JSON.parse(fs.readFileSync(journal,'utf8'));
 if(!/^[a-f0-9]{64}$/.test(record.digest))throw Error('Ogiltig återställningspost för sparningen.');
 if(!fs.existsSync(dest)){if(!fs.existsSync(stage)||treeDigest(stage)!==record.digest)throw Error('Sparningsimporten behöver återställas från säkerhetskopian.');fs.renameSync(stage,dest);}
 fs.unlinkSync(journal);
}
function importSave(sourceRoot,targetRoot){
 sourceRoot=fs.realpathSync(sourceRoot);targetRoot=fs.realpathSync(targetRoot);
 if(sourceRoot===targetRoot)throw Error('Den valda sparningen används redan.');
 stopped(sourceRoot);stopped(targetRoot);recoverImport(targetRoot);
 const source=path.join(sourceRoot,'birchhaven-solo-data'),dest=path.join(targetRoot,'birchhaven-solo-data'),stage=dest+'.importing';
 if(!fs.existsSync(path.join(source,'v3/d1')))throw Error('Mappen innehåller ingen lokal Birchhaven-sparning. Välj mappen med Start-Birchhaven.cmd.');
 fs.rmSync(stage,{recursive:true,force:true});copySave(source,stage);stopped(sourceRoot);stopped(targetRoot);
 const backup=path.join(path.dirname(targetRoot),'import-backups',new Date().toISOString().replace(/[:.]/g,'-'));
 fs.writeFileSync(path.join(targetRoot,'.save-import.json'),JSON.stringify({digest:treeDigest(stage)}),{flag:'wx'});
 if(fs.existsSync(dest)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.renameSync(dest,backup);}
 try{fs.renameSync(stage,dest);}catch(e){if(fs.existsSync(backup)&&!fs.existsSync(dest))fs.renameSync(backup,dest);throw e;}
 fs.unlinkSync(path.join(targetRoot,'.save-import.json'));
 return {backup:fs.existsSync(backup)?backup:null,digest:treeDigest(dest)};
}
module.exports={stopped,copyTree,copySave,treeDigest,provision,importSave,recoverImport};
