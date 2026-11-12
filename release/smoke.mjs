import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]);if(!root||fs.existsSync(path.join(root,'birchhaven-solo-data')))throw Error('Smoke tests require a fresh disposable runtime');
const origin='http://localhost:8787',version=JSON.parse(fs.readFileSync(path.join(root,'update-version.json'))).version;
let child,cookie='',savedMap;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(route,data){const r=await fetch(origin+route,{method:data?'POST':'GET',headers:{Origin:origin,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;}
async function start(){child=spawn(process.execPath,['Birchhaven-Launcher.mjs','--no-open'],{cwd:root,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Runtime exited');try{const r=await fetch(origin+'/version.js',{signal:AbortSignal.timeout(500)});if(r.ok&&(await r.text()).includes('"version":"'+version+'"'))return;}catch{}await sleep(1000);}throw Error('Runtime startup timeout');}
async function stop(){if(!child||child.exitCode!==null)return;if(process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F']);else child.kill('SIGTERM');for(let i=0;i<150&&child.exitCode===null;i++)await sleep(100);if(child.exitCode===null)throw Error('Runtime did not stop');child=null;}
try{
 await start();await request('/api/player/local-session',{});
 assert.equal((await request('/api/world/session')).canEdit,true);
 const published=await request('/api/world/published');savedMap=published.data;
 const draft=await request('/api/world/draft',{data:savedMap,expectedVersion:published.version});assert.deepEqual(draft.data,savedMap);
 const roster={version:1,active:'creator-ci',characters:[{profileId:'creator-ci',name:'Creator CI',level:1,xp:0,gold:42,equip:{},bag:[]}]};
 await request('/api/player/characters',{data:roster,expectedRevision:0});
 await stop();const {mapHash}=await import(pathToFileURL(path.join(root,'scripts/local-map-release.mjs')).href);const parts=version.split('.').map(Number);parts[2]++;const mapVersion=parts.join('.');const snapshot=JSON.parse(fs.readFileSync(path.join(root,'local-world.json')));snapshot.delivery={schema:1,id:mapVersion,acceptedSourceHashes:[mapHash(savedMap)],targetHash:mapHash(savedMap)};snapshot.data=savedMap;fs.writeFileSync(path.join(root,'local-world.json'),JSON.stringify(snapshot));cookie='';await start();await request('/api/player/local-session',{});
 assert.deepEqual((await request('/api/world/draft')).data,savedMap);
 assert.equal((await request('/api/player/characters')).data.characters[0].gold,42);
 assert.equal((await request('/api/world/release-status')).pending,false);assert.ok((await request('/api/world/history')).versions.some(v=>v.author==='local-map-release:'+mapVersion&&v.kind==='published'));
 console.log('PASS: runtime '+version+', Creator local save, map delivery and character persistence after restart.');
}finally{await stop();}
