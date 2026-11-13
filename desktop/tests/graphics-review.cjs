const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),temp=path.join(process.env.RUNNER_TEMP,'BirchhavenGraphicsReview'),install=path.join(temp,'Installed'),data=path.join(temp,'Review Data'),out=path.join(repo,'output/graphics-review');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
let app,game,stage='initializing';function checkpoint(value){stage=value;console.log('STAGE',value);fs.writeFileSync(path.join(out,'stage.json'),JSON.stringify({stage,at:new Date().toISOString()}));}
const watchdog=setTimeout(()=>{checkpoint('TIMEOUT at '+stage);if(app)execFileSync('taskkill',['/pid',String(app.process().pid),'/t','/f']);process.exit(1);},480000);
const errors=[],httpErrors=[],scenes=[],geometry=[];
async function capture(name){checkpoint(name);const png=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));return(await w.webContents.capturePage()).toPNG().toString('base64');});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));console.log('CAPTURE',name);}
async function size(width,height,scale=1){await app.evaluate(({BrowserWindow},{width,height,scale})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.setFullScreen(false);w.setContentSize(width,height);w.webContents.setZoomFactor(scale);},{width,height,scale});await game.waitForTimeout(600);}
(async()=>{try{
 checkpoint('install');execFileSync(path.join(repo,'output/desktop/Birchhaven-Setup-8.0.0-x64.exe'),['/S','/D='+install],{timeout:180000,stdio:'inherit'});
 app=await electron.launch({executablePath:path.join(install,'Birchhaven.exe'),env:{...process.env,CI:'true',BIRCHHAVEN_TEST_USER_DATA:data},timeout:60000});
 checkpoint('launcher');const setup=await app.firstWindow();await setup.locator('#start:not([disabled])').waitFor({timeout:180000});await setup.locator('#start').click();
 for(let i=0;i<360;i++){game=app.windows().find(p=>p!==setup&&p.url().startsWith('http://localhost:8787'));if(game)break;await new Promise(r=>setTimeout(r,500));}
 assert(game,'Native game window must open');game.on('pageerror',e=>errors.push(e.message));game.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
 checkpoint('native visibility');for(let i=0;i<240;i++){if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().startsWith('http://localhost:8787')&&w.isVisible())))break;if(i===239)throw Error('Game never visible');await new Promise(r=>setTimeout(r,500));}
 await game.waitForFunction(()=>window.BIRCHHAVEN_SINGLEPLAYER===true&&typeof window.flushPlayerAccount==='function',{},{timeout:180000});
 checkpoint('character selection');await game.locator('#createcharacter').waitFor({timeout:180000});await game.bringToFront();await size(1920,1080);await capture('00-character-selection');
 checkpoint('create character');await game.locator('#createcharacter').click();await game.locator('#heroname').fill('Graphics Review');await game.locator('#begin').click();
 await game.waitForFunction(()=>document.getElementById('welcome')?.hidden===true&&document.getElementById('world-loading')?.hidden===true,{},{timeout:180000});
 await game.waitForTimeout(1500);await capture('01-live-town');
 const before=await game.locator('#coords').textContent();await game.locator('#game').focus();await game.keyboard.down('ArrowRight');await game.waitForTimeout(700);await game.keyboard.up('ArrowRight');await game.waitForTimeout(700);const after=await game.locator('#coords').textContent();
 fs.writeFileSync(path.join(out,'live-client.json'),JSON.stringify({before,after,errors,httpErrors},null,2));
 const liveGeometry=[];
 for(const [w,h,scale]of [[1280,720,1],[1920,1080,1],[2560,1440,1],[1280,720,.85],[1920,1080,1.15]]){
  await size(w,h,scale);await capture('live-hud-'+w+'x'+h+'-'+scale);
  liveGeometry.push(await game.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,rects:Object.fromEntries(['.game-shell','.viewport','aside','#skillbar','.mapbox'].map(s=>{const r=document.querySelector(s)?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null]}))})));
 }
 fs.writeFileSync(path.join(out,'live-geometry.json'),JSON.stringify(liveGeometry,null,2));
 await size(1920,1080);await game.keyboard.press('F10');await game.waitForTimeout(600);await capture('live-display-settings');await game.keyboard.press('Escape');
 assert.deepEqual(errors,[],'Live renderer exceptions');console.log('PASS native HUD capture');return;

 // Scene fixtures exercise unmodified production painters and CSS, with in-memory
 // storage, no account transport, no simulation and no saves. They are NOT a playthrough.
 checkpoint('isolated fixture');const runtime=path.join(install,'resources/runtime');let html=fs.readFileSync(path.join(runtime,'dist/client/index.html'),'utf8');
 const omit=new Set(['multiplayer.js','multiplayer-trial.js','world-pve.js','world-loading.js']);
 html=html.replace(/<script src="([^?"]+)(?:[^"]*)"><\/script>/g,(tag,file)=>omit.has(file)?'':tag);
 const fixture=`<script>window.__auditRead=window.fetch.bind(window);const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}};Object.defineProperty(window,'localStorage',{value:memory()});Object.defineProperty(window,'sessionStorage',{value:memory()});window.fetch=undefined;window.WebSocket=undefined;</script>`;
 html=html.replace('<head>','<head>'+fixture);
 await game.route('**/graphics-review-fixture.html',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
 await game.goto('http://localhost:8787/graphics-review-fixture.html',{waitUntil:'load',timeout:120000});
 checkpoint('initialize fixture');await game.evaluate(async()=>{
  const read=window.__auditRead;const b=await(await read('/world-base.json')).json(),catalog=await(await read('/sprite-manifest.json')).json(),published=await(await read('/api/world/published')).json();
  const validation=await import('/world-validation.mjs');Creator.base=b;Creator.catalog=catalog.assets;Creator.cells=validation.worldObjectCells;Creator.ready=true;Creator.error=null;creatorApply(published.data);Creator.active=false;
  save=()=>{};tick=()=>{};paused=()=>false;started=true;casting=null;target=null;path=[];held.clear();p.name='Graphics Review';p.profileId='isolated-visual-review';p.z=0;p.x=22;p.y=29;p.level=110;p.dead=false;p.worldClock={minutes:720,epoch:Date.now()};p.hp=maxhp();p.energy=100;
  document.getElementById('welcome').hidden=true;document.getElementById('welcome').style.display='none';update();
  window.__reviewWarm=async()=>{for(let round=0;round<3;round++){const pending=[...document.images,...(typeof heroVisual!=='undefined'?heroVisual.images:[]),...creatorImages.values(),...landscapeArt.images.values(),...(typeof npcVisual!=='undefined'?npcVisual.prepare(p.z):[])];await Promise.all(pending.map(i=>i.decode?.().catch(()=>{})));await new Promise(r=>setTimeout(r,350));}};
 });
 checkpoint('warm fixture');await game.evaluate(()=>window.__reviewWarm());
 for(const [w,h]of [[1280,720],[1920,1080],[2560,1440]]){await size(w,h);await game.evaluate(()=>update());await capture('02-hud-'+w+'x'+h);geometry.push(await game.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,rects:Object.fromEntries(['.game-shell','.viewport','aside','#skillbar','.mapbox'].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null]}))})));}
 await size(1920,1080);
 const locations=await game.evaluate(()=>{
  const list=[{name:'town-day',z:0,x:22,y:29},{name:'churchyard',z:0,x:24,y:16},{name:'harbour',z:0,x:19,y:55},{name:'lake',z:0,x:86,y:65},{name:'orc-exterior',z:0,x:100,y:18},{name:'dragon-exterior',z:0,x:172,y:57},{name:'forest',z:0,x:66,y:43}];
  for(const key of Object.keys(roomDefs))list.push({name:'interior-'+key.toLowerCase().replace(/\W+/g,'-'),z:3,interior:key,x:7,y:6});
  for(let floor=0;floor<3;floor++){const f=cryptFloors[floor];list.push({name:'crypt-'+(floor+1),z:1,floor,x:f.up.x,y:f.up.y+3});}
  for(const [key,a]of Object.entries(adventures)){if(a.endgameKey||!a.floors?.length)continue;for(let floor=0;floor<a.floors.length;floor++){const f=a.floors[floor],at=f.rooms?.[Math.min(2,f.rooms.length-1)]||f.up;list.push({name:key+'-'+(floor+1),z:a.base+floor,floor,x:at.x,y:at.y});}}
  list.push({name:'island-harbour',z:200,x:35,y:111},{name:'island-camp',z:200,x:67,y:95});
  return list;
 });
 for(const loc of locations){
  await game.evaluate(loc=>{Object.assign(p,{z:loc.z,floor:loc.floor||0,interior:loc.interior||null,x:loc.x,y:loc.y});path=[];target=null;casting=null;lastReveal='';update();},loc);
  await game.evaluate(()=>window.__reviewWarm());await capture('scene-'+loc.name);scenes.push(loc);
 }
 await game.evaluate(()=>{p.z=0;p.interior=null;p.x=22;p.y=29;p.worldClock={minutes:0,epoch:Date.now()};update();});await game.evaluate(()=>window.__reviewWarm());await capture('scene-town-night');
 fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({version:'8.0.0',mode:'Installed Windows client plus explicitly isolated renderer fixtures; fixtures do not establish gameplay progression',scenes,geometry,errors,httpErrors},null,2));
 assert.deepEqual(errors,[],'Renderer exceptions');console.log('PASS graphics capture',scenes.length,'scenes');
}finally{console.log('REVIEW END',stage,JSON.stringify({errors,httpErrors,scenes:scenes.length}));if(game&&!game.isClosed())await game.screenshot({path:path.join(out,'last-state.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'partial-results.json'),JSON.stringify({scenes,geometry,errors,httpErrors},null,2));clearTimeout(watchdog);if(app)try{execFileSync('taskkill',['/pid',String(app.process().pid),'/t','/f']);}catch{}}})().catch(e=>{console.error(e);process.exitCode=1;});
