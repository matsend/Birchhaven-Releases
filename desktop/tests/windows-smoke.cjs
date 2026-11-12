const { _electron:electron }=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),temp=path.join(process.env.RUNNER_TEMP||repo,'BirchhavenClientTest'),install=path.join(temp,'Installed'),data=path.join(temp,'Player Data'),old=path.join(temp,'Old Game');
const version=require('../package.json').version,installer=path.join(repo,'output/desktop',`Birchhaven-Setup-${version}-x64.exe`),exe=path.join(install,'Birchhaven.exe');
fs.mkdirSync(temp,{recursive:true});const screenshotDir=path.join(repo,'output/desktop-evidence');fs.mkdirSync(screenshotDir,{recursive:true});
let app,game,testFailed=false;const errors=[];
function installClient(){execFileSync(installer,['/S','/D='+install],{timeout:180000,stdio:'inherit'});assert(fs.existsSync(exe),'Installer must create Birchhaven.exe');for(const name of ['node/node.exe','node/msvcp140.dll','runtime/node_modules/wrangler/bin/wrangler.js','runtime/node_modules/@cloudflare/workerd-windows-64/bin/workerd.exe'])assert(fs.existsSync(path.join(install,'resources',name)),'Installed runtime missing '+name);}
async function launch(){
 app=await electron.launch({executablePath:exe,env:{...process.env,CI:'true',BIRCHHAVEN_TEST_USER_DATA:data},timeout:60000});
 const setup=await app.firstWindow();setup.on('pageerror',e=>errors.push(e.message));
 await setup.locator('#start:not([disabled])').waitFor({timeout:180000});return setup;
}
async function play(setup){
 const window=app.waitForEvent('window',{timeout:180000});
 await setup.locator('#start').click();game=await Promise.race([window,setup.waitForFunction(async()=> (await globalThis.birchhavenClient.getState()).phase==='error',{},{timeout:180000}).then(async()=>{throw Error('Client startup: '+await setup.locator('#message').innerText());})]);await game.waitForURL('http://localhost:8787/**',{timeout:180000});
 game.on('pageerror',e=>errors.push(e.message));
 await game.locator('#createcharacter').waitFor({state:'visible',timeout:180000});
 await game.waitForFunction(()=>typeof window.flushPlayerAccount==='function'&&window.BIRCHHAVEN_SINGLEPLAYER===true);
 assert.equal(await game.evaluate(()=>window.birchhavenDesktop&&typeof window.birchhavenDesktop.update),'function');
 assert.equal(await game.evaluate(()=>typeof require),'undefined');
 assert.equal(await game.evaluate(()=>typeof process),'undefined');
 console.log(execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',path.join(repo,'release/assert-bundled-runtime.ps1'),'-DataRoot',data],{encoding:'utf8'}).trim());
}
async function close(){
 const done=app.waitForEvent('close',{timeout:180000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.close();});
 await done;app=null;
}
async function roster(){return game.evaluate(async()=>{const r=await fetch('/api/player/characters');if(!r.ok)throw Error('Character API failed');return (await r.json()).data;});}
(async()=>{try{
 console.log('INSTALL standalone client without Node dependency');installClient();
 let setup=await launch();await play(setup);
 await game.locator('#createcharacter').click();await game.locator('#heroname').fill('Desktop Tester');await game.locator('#begin').click();
 await game.locator('#welcome').waitFor({state:'hidden',timeout:30000});
 await game.waitForFunction(()=>document.getElementById('charactername').textContent==='Desktop Tester');
 await game.screenshot({path:path.join(screenshotDir,'windows-client-game.png')});
 await game.keyboard.press('F11');await game.waitForTimeout(500);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787')).isFullScreen()),true);await game.keyboard.press('F11');
 console.log('SAVE and close through the actual window lifecycle');await close();
 const state=path.join(data,'game/birchhaven-solo-data');assert(fs.existsSync(path.join(state,'v3/d1')));fs.mkdirSync(old,{recursive:true});fs.cpSync(state,path.join(old,'birchhaven-solo-data'),{recursive:true});
 console.log('REINSTALL client; saved characters must survive');installClient();setup=await launch();await play(setup);let saved=await roster();assert(saved.characters.some(c=>c.name==='Desktop Tester'));await close();
 console.log('IMPORT an old local save through the native picker');setup=await launch();
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:0});},old);
 await setup.locator('#choose').click();await setup.locator('#message').filter({hasText:'Din gamla sparning är kopierad'}).waitFor({timeout:60000});await play(setup);
 saved=await roster();assert(saved.characters.some(c=>c.name==='Desktop Tester'));assert(fs.existsSync(path.join(old,'birchhaven-solo-data/v3/d1')));
 // Exercise World Creator local storage through the rendered client session.
 const map=await game.evaluate(async()=>{const p=await (await fetch('/api/world/published')).json();const r=await fetch('/api/world/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:p.data,expectedVersion:p.version})});return {status:r.status,data:(await r.json()).data};});assert.equal(map.status,200);assert(map.data);
 // A controlled GitHub response verifies the actual renderer -> isolated preload
 // -> main-process update action without depending on a not-yet-published release.
 await app.evaluate((_electron,current)=>{const https=require('node:https'),{EventEmitter}=require('node:events'),{Readable}=require('node:stream');const original=https.get;https.get=(url,options,callback)=>{if(!String(url).endsWith('/birchhaven-desktop-update.json'))return original(url,options,callback);const req=new EventEmitter();req.setTimeout=()=>req;process.nextTick(()=>{const res=Readable.from([JSON.stringify({format:1,version:current,asset:'Birchhaven-Setup-'+current+'-x64.exe',sha256:'a'.repeat(64),size:1000000})]);res.statusCode=200;res.headers={};callback(res);});return req;};},version);
 const update=await game.evaluate(()=>window.birchhavenDesktop.update());assert.match(update.message,/senaste Windows-klienten/);
 await game.screenshot({path:path.join(screenshotDir,'windows-client-saved-character.png')});await close();
 assert.deepEqual(errors,[],'Renderer errors');
 fs.writeFileSync(path.join(screenshotDir,'verification.json'),JSON.stringify({version,platform:process.platform,checks:['NSIS installation','bundled Node and runtime','sandboxed game window','create character','F11 fullscreen','save and graceful close','reinstall preserving saves','native import picker','old save unchanged','world draft persistence'],rendererErrors:errors},null,2));
 console.log('PASS: installed Windows client, own game window, save, restart, reinstall and import.');
}catch(error){
 testFailed=true;console.error('WINDOWS CLIENT FAILURE',error);
 if(app)for(const [i,page] of app.windows().entries()){try{console.error('WINDOW',i,page.url(),(await page.locator('body').innerText()).slice(0,5000));await page.screenshot({path:path.join(screenshotDir,'failure-'+i+'.png')});}catch{}}
 throw error;
}finally{const log=path.join(data,'desktop.log');if(fs.existsSync(log)){fs.copyFileSync(log,path.join(screenshotDir,'desktop.log'));if(testFailed||errors.length)console.error(fs.readFileSync(log,'utf8').slice(-12000));}if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
