const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function fullscreenHudSmoke(game,app,out){
 const measurements=[];
 async function size(width,height,scale=1){await app.evaluate(({BrowserWindow},{width,height,scale})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.setFullScreen(false);w.unmaximize();w.setContentSize(width,height);w.webContents.setZoomFactor(scale);},{width,height,scale});await game.waitForTimeout(500);}
 async function capture(name){const data=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));return(await w.webContents.capturePage()).toPNG().toString('base64');});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));}
 async function measure(label){const m=await game.evaluate(()=>{
  const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,viewport:rect('.viewport'),canvas:rect('#game'),rail:rect('.hud-rail'),host:rect('.container-panels'),map:rect('#map'),mapLabel:rect('.hud-map-heading>span'),mapToggle:rect('#minimize-minimap'),energy:rect('.corner-orb-value.energy'),minimized:document.getElementById('hud-minimap-body').hidden,mapPrefs:JSON.parse(localStorage.getItem('birchhaven-fullscreen-hud-v1')||'{}'),characterCollapsed:containerPanelState.collapsed.character===true};
 });m.label=label;measurements.push(m);
 assert(Math.abs(m.canvas.x)<1&&Math.abs(m.canvas.y)<1&&Math.abs(m.canvas.right-m.width)<1&&Math.abs(m.canvas.bottom-m.height)<1,'World reaches every viewport edge: '+label);
 assert(m.scrollWidth<=m.width+1&&m.scrollHeight<=m.height+1,'No external page scrolling: '+label);
 assert(m.rail.x>=0&&m.rail.right<=m.width+1&&m.rail.y>=0,'HUD stays inside viewport: '+label);
 assert(m.mapLabel.x>=m.rail.x+40&&m.mapToggle.right<=m.rail.right-35,'Map title and toggle clear the leaf corners: '+label);
 const ornamentTop=m.height-m.width*(793-(396.5+268*.5))/1983;
 assert(m.rail.bottom<=ornamentTop-7,'All bags stop above the energy ornament: '+label);
 if(!m.minimized)assert(Math.abs(m.map.w-m.map.h)<1,'Map remains square: '+label);
 return m;
 }
 await game.waitForFunction(()=>document.body.classList.contains('fullscreen-hud'));
 // SVG ornament images load outside the world canvas preparation gate. Wait for
 // their actual assets so early captures cannot mistake loading for missing art.
 await game.evaluate(async()=>{const sources=[...new Set([...document.querySelectorAll('.corner-orbs image')].map(n=>n.getAttribute('href')).filter(Boolean)),'assets/ui/leafbound-frame.png'];await Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.decode().then(resolve,reject);img.onerror=()=>reject(Error('HUD asset failed: '+src));img.src=src;})));});
 await game.evaluate(()=>{for(const id of [...containerPanelState.open])toggleContainerPanel(id,false);collapseContainerPanel('character',false);});
 if(await game.locator('#minimize-minimap').getAttribute('aria-expanded')!=='true')await game.locator('#minimize-minimap').click();
 for(const [w,h,z]of [[1280,720,1],[1920,1080,1],[2560,1440,1],[3440,1440,1],[1280,720,.85],[1920,1080,1.25]]){
  await size(w,h,z);const m=await measure(w+'x'+h+'@'+z);assert(Math.abs(m.width-w/z)<2&&Math.abs(m.height-h/z)<2,'Requested client dimensions and zoom are actually applied');await capture('hud-'+w+'x'+h+'-'+z);
 }
 await size(1920,1080);
 const inventoryBefore=await game.evaluate(()=>JSON.stringify({bag:p.bag,equip:p.equip,packs:p.packs}));
 await game.locator('#minimize-minimap').click();assert(await game.locator('#hud-minimap-body').isHidden());
 assert.equal(await game.locator('[data-minimize-container="character"]').getAttribute('aria-expanded'),'true','Minimap fold leaves Character open');
 await game.locator('[data-minimize-container="character"]').click();
 assert(await game.locator('.character-panel .hero').isHidden(),'Character folds portrait and equipment together');
 const folded=await measure('both-folded');assert(folded.mapPrefs.minimapCollapsed&&folded.characterCollapsed,'Both preferences saved independently');
 await capture('hud-both-folded');
 // Three actual panel components with empty cells, isolated layout fixtures only.
 // No item is granted, moved, saved or sent to the authoritative server.
 await game.evaluate(()=>{for(let i=1;i<=3;i++){const area='hud-layout-fixture-'+i,panel=makeContainerPanel(area,'Backpack '+i);panel.dataset.hudFixture='true';panel.querySelector('.container-content').style.height='170px';panel.querySelector('.container-grid').innerHTML=Array.from({length:20},(_,n)=>containerCellMarkup(area,null,n)).join('');containerHost.append(panel);}});
 for(const [w,h,z]of [[1920,1080,1],[1280,720,1],[1920,1080,1.25]]){
  await size(w,h,z);await measure('three-bags-'+w+'x'+h+'@'+z);await capture('hud-three-bags-'+w+'x'+h+'-'+z);
  await game.locator('.container-panels').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const last=await game.locator('[data-hud-fixture]').last().boundingBox(),host=await game.locator('.container-panels').boundingBox();
  assert(last.y+last.height<=host.y+host.height+2,'Last bag is reachable above the energy orb');
 }
 await game.evaluate(()=>{for(const e of document.querySelectorAll('[data-hud-fixture]'))e.remove();containerHost.scrollTop=0;});
 assert.equal(await game.evaluate(()=>JSON.stringify({bag:p.bag,equip:p.equip,packs:p.packs})),inventoryBefore,'Presentation never changes item ownership');
 await game.locator('#minimize-minimap').click();assert.equal(await game.locator('[data-minimize-container="character"]').getAttribute('aria-expanded'),'false','Expanding map leaves Character folded');
 await game.locator('[data-minimize-container="character"]').click();
 await size(1920,1080);await measure('restored');
 fs.writeFileSync(path.join(out,'fullscreen-hud-verification.json'),JSON.stringify({measurements,checks:['edge-to-edge world','square map','independent minimization','portrait folds with character','saved device preferences','three simultaneous bag layout components','scroll above full energy ornament','unchanged inventory'],limitation:'Empty bag components are layout fixtures; real item transfers are covered by the container regression suite.'},null,2));
 console.log('PASS: full viewport, square minimap, independent folds, multiple bag layout and energy ornament clearance.');
};
