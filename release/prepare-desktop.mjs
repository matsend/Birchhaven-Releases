import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {Readable} from 'node:stream';import {pipeline} from 'node:stream/promises';import {execFileSync} from 'node:child_process';
const pins=JSON.parse(fs.readFileSync('desktop/pins.json'));
for(const [name,pin] of Object.entries(pins)){
 const file=path.resolve('output',pin.archive);const r=await fetch(pin.url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('Binary download failed: '+r.status);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file,{flags:'wx'}));
 if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==pin.sha256)throw Error('Official binary checksum mismatch: '+name);
 execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${file.replaceAll("'","''")}' -DestinationPath '${path.resolve('output',name).replaceAll("'","''")}'`],{stdio:'inherit'});
 if(name==='node'){const extracted=path.join('output/node',`node-v${pin.version}-win-x64`);for(const n of ['node.exe','LICENSE'])fs.copyFileSync(path.join(extracted,n),path.join('output/node',n));fs.rmSync(extracted,{recursive:true});}
 fs.unlinkSync(file);
}

execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-File','release/prepare-msvc.ps1'],{stdio:'inherit'});
