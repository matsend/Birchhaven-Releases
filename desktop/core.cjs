'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const GAME_ORIGIN='http://localhost:8787';
const UPDATER_ORIGIN='http://localhost:8788';
function validateInstallation(directory){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('Välj mappen där Birchhaven är installerat.');
 const root=fs.realpathSync(directory);
 for(const name of ['Birchhaven-Launcher.mjs','scripts/local-client.mjs','scripts/local-start.mjs','node_modules/wrangler/bin/wrangler.js']){
  const target=path.join(root,name);
  if(!fs.existsSync(target)||!fs.statSync(target).isFile())throw Error('Mappen saknar en färdiginstallerad Birchhaven-version. Välj mappen med Start-Birchhaven.cmd.');
 }
 // A pending journal must be handled by the original stable launcher, even when
 // the interrupted update temporarily removed update-version.json or dist.
 const recovering=fs.existsSync(path.join(root,'.birchhaven-update'));
 if(!recovering){
  const version=JSON.parse(fs.readFileSync(path.join(root,'update-version.json'),'utf8')).version;
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Installationen har ett ogiltigt versionsnummer.');
  if(!fs.existsSync(path.join(root,'dist/server/wrangler.json')))throw Error('Spelets färdiga programfiler saknas.');
 }
 const lock=path.join(root,'birchhaven-solo-data.lock');
 if(fs.existsSync(lock)){
  const pid=Number(fs.readFileSync(lock,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('Spelets låsfil är ogiltig. Ingen sparning har ändrats.');
  try{process.kill(pid,0);throw Error('Birchhaven kör redan. Stäng den gamla starten innan du öppnar klienten.');}
  catch(error){if(error.code!=='ESRCH')throw error;}
 }
 return root;
}
async function assertPortsFree(ports=[8787,8788]){
 for(const port of ports)await new Promise((resolve,reject)=>{
  const probe=net.createServer();probe.once('error',()=>reject(Error('Birchhaven kör redan eller en spelport används. Stäng den gamla starten först.')));
  probe.listen(port,'127.0.0.1',()=>probe.close(resolve));
 });
}
function isGameURL(raw){try{const u=new URL(raw);return u.origin===GAME_ORIGIN&&!u.username&&!u.password;}catch{return false;}}
function isSyncURL(raw){try{const u=new URL(raw);return u.origin==='https://birchhaven-map-sync.matsend.chatgpt.site'&&!u.username&&!u.password;}catch{return false;}}
function isExternalURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&((u.hostname==='github.com'&&/^\/matsend\/Birchhaven-Releases(?:\/|$)/.test(u.pathname))||u.hostname==='chatgpt.com'||u.hostname==='www.electronjs.org');}catch{return false;}}
async function updaterStatus(fetcher=fetch){
 const response=await fetcher(UPDATER_ORIGIN+'/status',{headers:{Origin:GAME_ORIGIN},signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error('Uppdateringstjänstens status kunde inte kontrolleras.');
 const status=await response.json();
 if(['downloading','installing','recovering'].includes(status.phase))throw Error('En uppdatering pågår. Vänta tills den är klar innan du stänger.');
 return status;
}
// Same acknowledgement gate as the existing in-game updater. Never treat a
// renderer timeout, missing account API or rejected save as successful saving.
const SAVE_SCRIPT=`(async()=>{
 if(window.BIRCHHAVEN_SINGLEPLAYER!==true)return {ok:false,message:'Det lokala spelläget är inte klart.'};
 if(typeof Creator!=='undefined'&&Creator.active)return {ok:false,message:'Spara kartan och lämna World Creator innan du stänger spelet.'};
 if(typeof showCharacterSelection!=='function'||typeof window.flushPlayerAccount!=='function')return {ok:false,message:'Sparningen är inte redo.'};
 showCharacterSelection();
 const ok=await window.flushPlayerAccount();
 return {ok:ok===true,message:ok?'':'Sparningen kunde inte bekräftas. Spelet hålls öppet.'};
})()`;
function writeSettings(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);
}
// Account/world hydration can legitimately reload the first document before
// loadURL completes. Wait for the replacement document, preserving all origin
// guards and treating actual main-frame failures as errors.
function loadGameWindow(window,timeoutMs=150000){
 const wc=window.webContents;let timer,settled=false;
 return new Promise((resolve,reject)=>{
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);wc.off('did-finish-load',loaded);wc.off('did-fail-load',failed);wc.off('destroyed',destroyed);error?reject(error):resolve();};
  const loaded=()=>finish(isGameURL(wc.getURL())?null:Error('Spelet öppnade en oväntad adress.'));
  const failed=(_event,code,description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)finish(Error(description+' ('+code+')'));};
  const destroyed=()=>finish(Error('Spelfönstret stängdes under starten.'));
  wc.on('did-finish-load',loaded);wc.on('did-fail-load',failed);wc.on('destroyed',destroyed);
  timer=setTimeout(()=>finish(Error('Spelfönstret laddades inte klart. Försök starta igen.')),timeoutMs);
  try{Promise.resolve(window.loadURL(GAME_ORIGIN)).catch(e=>{if(e.code!=='ERR_ABORTED'&&e.errno!==-3)finish(e);});}catch(e){finish(e);}
 });
}
module.exports={GAME_ORIGIN,UPDATER_ORIGIN,validateInstallation,assertPortsFree,isGameURL,isSyncURL,isExternalURL,updaterStatus,SAVE_SCRIPT,writeSettings,loadGameWindow};
