// Owner-approved publication; restricted to this repository's main-branch Actions job.
import fs from 'node:fs';import path from 'node:path';import {Readable} from 'node:stream';import {hashFile} from './bundle.mjs';
const repo='matsend/Birchhaven-Releases';
if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_REF!=='refs/heads/main'||!process.env.GH_TOKEN)throw Error('Publication is restricted to the approved main-branch Actions job');
const receipt=JSON.parse(fs.readFileSync('output/release-receipt.json'));
if(!/^\d+\.\d+\.\d+$/.test(receipt.version)||!Array.isArray(receipt.files)||receipt.files.length!==3||new Set(receipt.files.map(f=>f.name)).size!==3)throw Error('Invalid receipt');
const names=[`Birchhaven-Singleplayer-${receipt.version}.zip`,`Birchhaven-${receipt.version}.bhupdate`,'birchhaven-update.json'];
for(const file of receipt.files)if(!names.includes(file.name)||hashFile(path.join('output',file.name))!==file.sha256||fs.statSync(path.join('output',file.name)).size!==file.size)throw Error('Release file changed after verification');
const base='https://api.github.com/repos/'+repo+'/releases';
async function api(url,options={}){const u=new URL(url);if(!['api.github.com','uploads.github.com'].includes(u.hostname)||!u.pathname.startsWith('/repos/'+repo+'/releases'))throw Error('Unexpected publication URL');const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(300000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,'X-GitHub-Api-Version':'2022-11-28',...options.headers}});if(!r.ok)throw Error('GitHub release operation failed: '+r.status);return r.json();}
const tag='v'+receipt.version;
const existing=await fetch(base+'/tags/'+tag,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN},redirect:'error'});
if(existing.status!==404)throw Error('A release may already exist; inspect it instead of overwriting');
const release=await api(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:process.env.GITHUB_SHA,name:'Birchhaven '+receipt.version+' — '+receipt.name,body:receipt.notes,draft:true,prerelease:false})});
for(const file of receipt.files){const result=await api(release.upload_url.split('{')[0]+'?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Length':String(file.size)},body:Readable.toWeb(fs.createReadStream(path.join('output',file.name))),duplex:'half'});if(result.state!=='uploaded'||result.size!==file.size||result.digest!=='sha256:'+file.sha256)throw Error('Uploaded asset failed verification; release remains draft');}
const result=await api(release.url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,make_latest:'true'})});
if(result.draft||result.prerelease)throw Error('Release was not published');console.log(result.html_url);
