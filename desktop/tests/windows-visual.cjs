const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),temp=path.join(process.env.RUNNER_TEMP,'BirchhavenVisual'),install=path.join(temp,'Installed'),data=path.join(temp,'Player Data'),out=path.join(repo,'output/visual-evidence');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
let app,game;const errors=[];
(async()=>{try{
 execFileSync(path.join(repo,'output/desktop/Birchhaven-Setup-7.23.0-x64.exe'),['/S','/D='+install],{timeout:180000,stdio:'inherit'});
 app=await electron.launch({executablePath:path.join(install,'Birchhaven.exe'),env:{...process.env,CI:'true',BIRCHHAVEN_TEST_USER_DATA:data},timeout:60000});
 const setup=await app.firstWindow();await setup.locator('#start:not([disabled])').waitFor({timeout:180000});await setup.locator('#start').click();
 for(let i=0;i<360;i++){game=app.windows().find(p=>p!==setup&&p.url().startsWith('http://localhost:8787'));if(game)break;await new Promise(r=>setTimeout(r,500));}
 assert(game,'Native game window must open');game.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<360;i++){if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().startsWith('http://localhost:8787')&&w.isVisible())))break;if(i===359)throw Error('Native game window did not become visible');await new Promise(r=>setTimeout(r,500));}
 await game.waitForFunction(()=>window.BIRCHHAVEN_SINGLEPLAYER===true&&typeof window.flushPlayerAccount==='function');
 await game.locator('#createcharacter').waitFor({timeout:180000});await game.locator('#createcharacter').click();await game.locator('#heroname').fill('Visual Tester');await game.locator('#begin').click();
 await game.waitForFunction(()=>document.getElementById('welcome')?.hidden===true&&document.getElementById('world-loading')?.hidden===true&&document.getElementById('game')?.width>300&&document.getElementById('game')?.height>200,{},{timeout:180000});
 await game.waitForFunction(()=>{const c=document.getElementById('game'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let colors=new Set();for(let i=0;i<d.length;i+=256)if(d[i+3])colors.add((d[i]>>3)+','+(d[i+1]>>3)+','+(d[i+2]>>3));return colors.size>100;},{},{timeout:60000});
 await game.screenshot({path:path.join(out,'rendered-map.png')});
 const before=await game.locator('#coords').textContent();let after=before;
 await game.locator('#game').focus();
 for(const key of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']){await game.keyboard.down(key);await new Promise(r=>setTimeout(r,600));await game.keyboard.up(key);await new Promise(r=>setTimeout(r,700));after=await game.locator('#coords').textContent();if(after!==before)break;}
 assert(after!==before,'Player must move through actual keyboard input');assert.deepEqual(errors,[]);
 await game.screenshot({path:path.join(out,'after-movement.png')});
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({version:'7.23.0',checks:['Rendered landscape with more than 100 distinct sampled colors','World resource preparation completed','Actual keyboard movement','No renderer errors'],before,after,errors},null,2));
 const done=app.waitForEvent('close',{timeout:180000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787')).close());await done;app=null;
 console.log('PASS: production Windows installer renders the world and responds to movement.');
}finally{if(game&&!game.isClosed())await game.screenshot({path:path.join(out,'last-state.png')}).catch(()=>{});const log=path.join(data,'desktop.log');if(fs.existsSync(log))fs.copyFileSync(log,path.join(out,'desktop.log'));if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
