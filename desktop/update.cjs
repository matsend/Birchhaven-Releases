'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const BASE='https://github.com/matsend/Birchhaven-Releases/releases/';
function newer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function validateManifest(m){if(m?.format!==1||!/^\d+\.\d+\.\d+$/.test(m.version)||m.asset!==`Birchhaven-Setup-${m.version}-x64.exe`||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.size)||m.size<1000000||m.size>1500000000)throw Error('GitHub returnerade en ogiltig klientuppdatering.');return m;}
function download(url,max,onChunk,redirects=0){return new Promise((resolve,reject)=>{
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname)||redirects>5)return reject(Error('Ogiltig nedladdningsadress.'));
 const req=https.get(u,{headers:{'User-Agent':'Birchhaven-Desktop','Accept':'application/octet-stream'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){res.resume();if(!res.headers.location)return reject(Error('Ogiltig omdirigering.'));download(new URL(res.headers.location,u).href,max,onChunk,redirects+1).then(resolve,reject);return;}
  if(res.statusCode!==200){res.resume();return reject(Error('GitHub kunde inte nås ('+res.statusCode+'). Försök igen senare.'));}
  let count=0;res.on('data',chunk=>{count+=chunk.length;if(count>max){res.destroy(Error('Uppdateringen är för stor.'));return;}try{onChunk(chunk);}catch(e){res.destroy(e);}});res.on('error',reject);res.on('end',()=>resolve(count));
 });req.setTimeout(30000,()=>req.destroy(Error('Nedladdningen tog för lång tid.')));req.on('error',reject);
});}
async function checkUpdate(current){const parts=[];await download(BASE+'latest/download/birchhaven-desktop-update.json',16384,c=>parts.push(c));const m=validateManifest(JSON.parse(Buffer.concat(parts)));return newer(m.version,current)?m:null;}
async function downloadInstaller(m,directory){validateManifest(m);fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,m.asset),temp=file+'.partial';fs.rmSync(temp,{force:true});const fd=fs.openSync(temp,'wx'),hash=crypto.createHash('sha256');
 try{const size=await download(BASE+'download/v'+m.version+'/'+m.asset,m.size,c=>{fs.writeSync(fd,c);hash.update(c);});if(size!==m.size||hash.digest('hex')!==m.sha256)throw Error('Uppdateringens kontrollsumma stämmer inte. Inget har installerats.');fs.closeSync(fd);fs.renameSync(temp,file);return file;}
 catch(e){try{fs.closeSync(fd);}catch{}fs.rmSync(temp,{force:true});throw e;}
}
module.exports={newer,validateManifest,checkUpdate,downloadInstaller};
