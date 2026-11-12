// Temporary CI-only diagnostic. Not part of the game package or a release fix.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]);
if(!process.env.CI || !fs.existsSync(path.join(root,'package.json')))throw Error('Disposable CI runtime required');
const require=createRequire(path.join(root,'package.json'));
const file=path.join(path.dirname(require.resolve('wrangler')),'ProxyWorker.js');
const code=fs.readFileSync(file,'utf8');
const before='userWorkerUrl.href === newUserWorkerUrl?.href';
if(code.split(before).length!==2)throw Error('Diagnostic expects the pinned Wrangler proxy');
fs.writeFileSync(file,code.replace(before,'userWorkerUrl.origin === newUserWorkerUrl?.origin'));
console.log('DIAGNOSTIC ONLY: report the original proxy error instead of a false restart/indefinite GET wait. No request retries added.');
