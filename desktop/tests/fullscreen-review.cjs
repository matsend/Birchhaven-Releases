const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),temp=path.join(process.env.RUNNER_TEMP,'BirchhavenFullscreenReview'),install=path.join(temp,'Installed'),data=path.join(temp,'Review Data'),out=path.join(repo,'output/fullscreen-review');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
let app,game,stage='initializing';const errors=[];
function checkpoint(s){stage=s;console.log('STAGE',s);}
(async()=>{try{
 checkpoint('install');execFileSync(path.join(repo,'output/desktop/Birchhaven-Setup-8.0.1-x64.exe'),['/S','/D='+install],{timeout:180000,stdio:'inherit'});
 app=await electron.launch({executablePath:path.join(install,'Birchhaven.exe'),env:{...process.env,CI:'true',BIRCHHAVEN_TEST_USER_DATA:data},timeout:60000});
 // Serve only this candidate's public visual files over the installed baseline.
 // API calls, saves and all other assets use the unmodified local runtime.
 const patch=path.join(repo,'review/fullscreen');
 await app.context().route('http://localhost:8787/**',async route=>{let name=new URL(route.request().url()).pathname.slice(1)||'index.html';const f=path.join(patch,name);if(!name.includes('..')&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html'});if(name==='assets/ui/leafbound-frame.png')return route.fulfill({body:Buffer.from(fs.readFileSync(path.join(patch,'leafbound-frame.base64'),'utf8'),'base64'),contentType:'image/png'});return route.continue();});
 const setup=await app.firstWindow();await setup.locator('#start:not([disabled])').waitFor({timeout:180000});await setup.locator('#start').click();
 for(let i=0;i<360;i++){game=app.windows().find(p=>p!==setup&&p.url().startsWith('http://localhost:8787'));if(game)break;await new Promise(r=>setTimeout(r,500));}
 assert(game);game.on('pageerror',e=>errors.push(e.message));
 checkpoint('new character');await game.locator('#createcharacter').waitFor({timeout:180000});await game.bringToFront();await game.locator('#createcharacter').click();await game.locator('#heroname').fill('HUD Review');await game.locator('#begin').click();
 await game.waitForFunction(()=>document.getElementById('welcome')?.hidden===true&&document.getElementById('world-loading')?.hidden===true,{},{timeout:180000});
 await game.waitForTimeout(1000);checkpoint('layout checks');await require('./fullscreen-hud-smoke.cjs')(game,app,out);
 assert.deepEqual(errors,[]);checkpoint('passed');
}catch(e){console.error(stage,e);throw e;}finally{fs.writeFileSync(path.join(out,'status.json'),JSON.stringify({stage,errors},null,2));if(game&&!game.isClosed())await game.screenshot({path:path.join(out,'last-state.png')}).catch(()=>{});if(app)try{execFileSync('taskkill',['/pid',String(app.process().pid),'/t','/f']);}catch{}}})().catch(e=>{console.error(e);process.exitCode=1;});
