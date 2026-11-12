import fs from 'node:fs';import path from 'node:path';import {hashFile} from './bundle.mjs';
const receipt=JSON.parse(fs.readFileSync('output/release-receipt.json'));
const name=`Birchhaven-Setup-${receipt.version}-x64.exe`,source=path.join('output/desktop',name),target=path.join('output',name);
fs.copyFileSync(source,target);const asset={name,size:fs.statSync(target).size,sha256:hashFile(target)};
fs.writeFileSync('output/birchhaven-desktop-update.json',JSON.stringify({format:1,version:receipt.version,asset:name,size:asset.size,sha256:asset.sha256},null,2)+'\n');
receipt.files=receipt.files.filter(f=>!f.name.endsWith('.zip'));receipt.files.push(asset,{name:'birchhaven-desktop-update.json',size:fs.statSync('output/birchhaven-desktop-update.json').size,sha256:hashFile('output/birchhaven-desktop-update.json')});
fs.writeFileSync('output/release-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log('Desktop receipt ready:',asset.name,asset.sha256);
