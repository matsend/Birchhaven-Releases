import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {Readable,Transform} from 'node:stream';import {pipeline} from 'node:stream/promises';import {gunzipSync} from 'node:zlib';import {execFileSync} from 'node:child_process';
import {packBundle,hashFile} from './bundle.mjs';
import {readPatch} from './read-patch.mjs';
const plan=JSON.parse(fs.readFileSync('release-request.json','utf8'));
const semver=v=>/^\d+\.\d+\.\d+$/.test(v),hash=v=>/^[a-f0-9]{64}$/.test(v);
if(plan.format!==1||!semver(plan.version)||!semver(plan.baseVersion)||!hash(plan.baseSha256)||!hash(plan.runtimeSha256)||!hash(plan.patchSha256)||plan.patch!==`release/patches/${plan.version}.json`)throw Error('Invalid release request');
const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0};if(compare(plan.version,plan.baseVersion)<=0)throw Error('Release must be newer');
const output=path.resolve('output');if(fs.existsSync(output))throw Error('Use a clean output directory');fs.mkdirSync(output);
const baseFile=path.join(output,'base.zip');const supplied=process.argv[2];
if(supplied)fs.copyFileSync(supplied,baseFile);else{
 const response=await fetch(`https://github.com/matsend/Birchhaven-Releases/releases/download/v${plan.baseVersion}/Birchhaven-Singleplayer-${plan.baseVersion}.zip`,{signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw Error('Base download failed: '+response.status);let bytes=0;
 await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,enc,cb){bytes+=chunk.length;cb(bytes>400000000?Error('Base package too large'):null,chunk)}}),fs.createWriteStream(baseFile,{flags:'wx'}));
}
if(hashFile(baseFile)!==plan.baseSha256)throw Error('Base ZIP hash mismatch');
execFileSync('python3',['-c',`import sys,zipfile,pathlib,stat
root=pathlib.Path(sys.argv[2]);total=0;seen=set()
with zipfile.ZipFile(sys.argv[1]) as z:
 for i in z.infolist():
  p=pathlib.PurePosixPath(i.filename);total+=i.file_size
  if len(z.infolist())>20000 or total>1073741824 or p.is_absolute() or '..' in p.parts or '\\\\' in i.filename or not p.parts or p.parts[0]!='Birchhaven-Singleplayer' or stat.S_ISLNK(i.external_attr>>16):raise Exception('Unsafe base ZIP')
  if i.filename.lower() in seen:raise Exception('Duplicate ZIP entry')
  seen.add(i.filename.lower())
 z.extractall(root)
`,baseFile,output],{stdio:'inherit'});
fs.unlinkSync(baseFile);const runtime=path.join(output,'Birchhaven-Singleplayer');
const patch=readPatch(plan.patch,plan.patchSha256,plan.version);if(patch.version!==plan.version||!Array.isArray(patch.files)||!Array.isArray(patch.remove)||patch.files.length+patch.remove.length>20000)throw Error('Invalid patch');
const safe=p=>typeof p==='string'&&p.length<240&&p.split('/').every(x=>/^[a-zA-Z0-9_.@+~-]+$/.test(x)&&!['.','..'].includes(x)&&!/[. ]$/.test(x)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(x))&&(['dist','scripts','drizzle','docs'].includes(p.split('/')[0])||['local-world.json','LAS-MIG.html','update-version.json'].includes(p));
const seen=new Set();
for(const f of [...patch.remove,...patch.files]){
 if(!safe(f.path)||seen.has(f.path.toLowerCase())||f.before!==null&&!hash(f.before))throw Error('Unsafe patch path/hash');seen.add(f.path.toLowerCase());
 const dest=path.join(runtime,f.path),exists=fs.existsSync(dest);
 if(f.before===null?exists:!exists||hashFile(dest)!==f.before)throw Error('Unexpected base file: '+f.path);
 if(patch.remove.includes(f)){fs.unlinkSync(dest);continue;}
 if(!hash(f.sha256)||!Number.isInteger(f.size)||f.size<0||f.size>40000000)throw Error('Invalid file entry');
 const bytes=gunzipSync(Buffer.from(f.gzip,'base64'),{maxOutputLength:40000000});
 if(bytes.length!==f.size||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Patch file mismatch');
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
}
function treeHash(root){const rows=[];function walk(dir,rel=''){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=rel?rel+'/'+item.name:item.name;if(item.isDirectory())walk(path.join(dir,item.name),p);else if(item.isFile())rows.push([p,hashFile(path.join(dir,item.name))]);else throw Error('Unsupported runtime entry');}}walk(root);rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);return createHash('sha256').update(rows.map(([p,h])=>p+'\0'+h+'\n').join('')).digest('hex');}
if(treeHash(runtime)!==plan.runtimeSha256)throw Error('Runtime tree checksum mismatch');
if(JSON.parse(fs.readFileSync(path.join(runtime,'update-version.json'))).version!==plan.version)throw Error('Runtime version mismatch');
const archive=path.join(output,`Birchhaven-Singleplayer-${plan.version}.zip`);
execFileSync('python3',['-c',`import sys,pathlib,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():z.write(p,'Birchhaven-Singleplayer/'+p.relative_to(root).as_posix())
`,runtime,archive],{stdio:'inherit'});
const asset=`Birchhaven-${plan.version}.bhupdate`,result=await packBundle(runtime,path.join(output,asset),plan.version);
fs.writeFileSync(path.join(output,'birchhaven-update.json'),JSON.stringify({format:1,version:plan.version,tag:'v'+plan.version,asset,...result},null,2)+'\n');
const names=[path.basename(archive),asset,'birchhaven-update.json'];
fs.writeFileSync(path.join(output,'release-receipt.json'),JSON.stringify({version:plan.version,name:plan.name,notes:plan.notes,files:names.map(name=>({name,size:fs.statSync(path.join(output,name)).size,sha256:hashFile(path.join(output,name))}))},null,2));
console.log('Verified runtime tree and built release '+plan.version);
