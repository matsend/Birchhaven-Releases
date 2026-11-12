import http from 'node:http';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]);if(!root||fs.existsSync(path.join(root,'birchhaven-solo-data')))throw Error('Smoke tests require a fresh disposable runtime');
const origin='http://localhost:8787',version=JSON.parse(fs.readFileSync(path.join(root,'update-version.json'))).version;
let child,cookie='',savedMap;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// A fresh IPv4 loopback connection per check avoids retaining a timed-out startup
// socket on Windows. Keep the actual localhost Host/Origin and session cookie.
function localHttp(route,data,timeout=60000){return new Promise((resolve,reject)=>{
 const body=data===undefined?null:JSON.stringify(data),req=http.request(origin+route,{family:4,agent:false,method:body===null?'GET':'POST',headers:{Origin:origin,Cookie:cookie,...(body===null?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)})}},res=>{
  let bytes=0,chunks=[];res.on('data',chunk=>{bytes+=chunk.length;if(bytes>3000000)req.destroy(Error('Response too large: '+route));else chunks.push(chunk);});
  res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
 });req.setTimeout(timeout,()=>req.destroy(Error('Local check timed out: '+route)));req.on('error',reject);req.end(body);
});}
async function request(route,data){console.log('CHECK '+(data===undefined?'GET ':'POST ')+route);const start=Date.now(),r=await localHttp(route,data);const c=r.headers['set-cookie']?.[0];if(c)cookie=c.split(';')[0];const body=JSON.parse(r.text);assert.equal(r.status,200,JSON.stringify(body));console.log('OK '+route+' '+(Date.now()-start)+'ms');return body;}
async function start(){child=spawn(process.execPath,['Birchhaven-Launcher.mjs','--no-open'],{cwd:root,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Runtime exited');try{const r=await localHttp('/version.js',undefined,1500);if(r.status===200&&r.text.includes('"version":"'+version+'"'))return;}catch{}await sleep(1000);}throw Error('Runtime startup timeout');}
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
