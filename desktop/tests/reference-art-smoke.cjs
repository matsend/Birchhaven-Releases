const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function referenceArtSmoke(game,app,output){
 const evidence={status:'awaiting-manual-side-by-side-review',scenes:[],checks:[],limitations:['Thirteen exact reference originals; deeper campaigns are not covered by their acceptance.','Browser resampling, live characters, animated masks and gameplay markers differ from a still reference.','This automated gate does not grant visual acceptance.']};
 const original=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));return{size:w.getContentSize(),zoom:w.webContents.getZoomFactor()};});
 async function settled(){await game.waitForFunction(()=>started&&!worldPreparation.busy&&ReferenceSceneArt.ready(ReferenceWorld.active()),{},{timeout:90000});await game.waitForTimeout(400);}
 async function walk(x,y){
  console.log('Artwork route',x,y);assert(await game.evaluate(({x,y})=>{if(!walkable(x,y))return false;route(x,y);return true;},{x,y}));
  const deadline=Date.now()+90000;
  for(;;){const state=await game.evaluate(()=>({x:p.x,y:p.y,z:p.z,dead:p.dead,hp:p.hp}));assert(!state.dead,'Review character died on route to '+x+','+y);if(state.x===x&&state.y===y)break;assert(Date.now()<deadline,'Route timed out: '+JSON.stringify({target:{x,y},state}));
   if(evidence.wildernessFixture)await game.evaluate(({x,y})=>{if(paused()||casting)return;if(p.hp<maxhp()*.6)castHeal();else if(enemies.some(e=>!e.dead&&e.z===p.z&&dist(p,e)<=1))hit();if(!path.length&&!casting)route(x,y);},{x,y});
   await game.waitForTimeout(500);
  }
  await settled();
 }
 async function capture(label){
  await settled();await game.screenshot({path:path.join(output,'art-'+label+'-game.png')});
  const result=await game.evaluate(()=>{
   const s=ReferenceWorld.active(),sx=(s.x-Math.floor(view.x))*renderPixelScaleX,sy=(s.y-Math.floor(view.y))*renderPixelScaleY,sw=1536*s.scale*renderPixelScaleX,sh=1024*s.scale*renderPixelScaleY;
   if(sx<0||sy<0||sx+sw>C.width||sy+sh>C.height)throw Error('Artwork crop is outside the actual rendered game canvas');
   const shot=document.createElement('canvas');shot.width=1536;shot.height=1024;const c=shot.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(C,sx,sy,sw,sh,0,0,1536,1024);
   const ref=document.createElement('canvas');ref.width=1536;ref.height=1024;const rc=ref.getContext('2d');rc.drawImage(ReferenceSceneArt.images.get(s.id),0,0);
   const a=c.getImageData(0,0,1536,1024).data,b=rc.getImageData(0,0,1536,1024).data;let sum=0,changed=0,count=0;
   for(let i=0;i<a.length;i+=16){const delta=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;sum+=delta;if(delta>40)changed++;count++;}
   return{id:s.id,position:{x:p.x,y:p.y,z:p.z,interior:p.interior},sourceRect:{sx,sy,sw,sh},canvasSize:{width:C.width,height:C.height},viewport:{width:innerWidth,height:innerHeight},meanRGBDifference:sum/count,changedFraction:changed/count,png:shot.toDataURL('image/png')};
  });
  fs.writeFileSync(path.join(output,'art-'+label+'-scene.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;evidence.scenes.push({label,...result});
  assert(result.meanRGBDifference<7&&result.changedFraction<.07,JSON.stringify(result));
 }
 try{
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.setFullScreen(false);w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(2560,1920);});
  await game.waitForFunction(()=>innerWidth===2560&&innerHeight===1920);
  assert(await game.evaluate(()=>p.z===0),'Art review starts in the real town session');
  // Review camera only: the actor, server session, collisions, rendering and
  // loaded original assets remain the real installed game. No image is substituted.
  await game.evaluate(()=>{window.__artReviewCamera=creatorCamera;creatorCamera=()=>{const s=ReferenceWorld.scenes.town;return{x:(s.x+768-24)/T,y:(s.y+512-24)/T};};});
  await capture('town');await game.evaluate(()=>{creatorCamera=window.__artReviewCamera;delete window.__artReviewCamera;});
  for(const key of ['BLACKSMITH','INN']){
   const door=await game.evaluate(key=>({...buildings.find(b=>b.name===key).door}),key);
   const routed=await game.evaluate(({x,y})=>{
    route(x,y);
    const otherDoors=new Set(buildings.filter(b=>b.door.x!==x||b.door.y!==y).map(b=>b.door.x+','+b.door.y));
    return path.length>0&&path.at(-1)[0]===x&&path.at(-1)[1]===y&&path.every(([a,b])=>!otherDoors.has(a+','+b));
   },door);
   assert(routed,'Ordinary game route to '+key+' avoids other automatic entrances');
   console.log('Artwork review: walking to '+key,door);
   await game.waitForFunction(key=>p.z===3&&p.interior===key,key,{timeout:90000});await settled();
   const npc=await game.evaluate(()=>({...interiorNPCs()[0]}));
   await walk(npc.x-1,npc.y+1);await capture(key.toLowerCase());
   assert(await game.evaluate(()=>{const n=interiorNPCs()[0];return Math.max(Math.abs(p.x-n.x),Math.abs(p.y-n.y))<=2;}));
   await game.evaluate(()=>talkIndoors(interiorNPCs()[0]));await game.locator('#modal').waitFor({state:'visible',timeout:30000});await game.locator('#close').click();
   if(key==='BLACKSMITH'){
    await walk(4,5);await game.screenshot({path:path.join(output,'art-smith-behind-anvil.png')});
    await walk(4,7);await game.screenshot({path:path.join(output,'art-smith-before-anvil.png')});
   }
   await game.evaluate(()=>route(7,11));await game.waitForFunction(()=>p.z===0&&!p.interior,{},{timeout:90000});await settled();
  }
  // Exercise the expansion through real routes and automatic doors. No
  // screenshot substitute, actor teleport or disabled server authority.
  async function exterior(key,x,y){await walk(x,y);await game.screenshot({path:path.join(output,'art-'+key+'-ordinary-camera.png')});await game.evaluate(key=>{window.__artReviewCamera=creatorCamera;creatorCamera=()=>{const s=ReferenceWorld.scenes[key];return{x:(s.x+768*s.scale-24)/T,y:(s.y+512*s.scale-24)/T};};},key);try{await capture(key);}finally{await game.evaluate(()=>{creatorCamera=window.__artReviewCamera;delete window.__artReviewCamera;});}}
  async function doorRoom(key){await game.evaluate(key=>{const b=buildings.find(b=>b.name===key);route(b.door.x,b.door.y);},key);await game.waitForFunction(key=>p.z===3&&p.interior===key,key,{timeout:90000});await capture(key.toLowerCase());await game.evaluate(()=>route(7,11));await game.waitForFunction(()=>p.z===0&&!p.interior,{},{timeout:90000});await settled();}
  const cd=await game.evaluate(()=>({...churchBuilding.door}));await exterior('churchExterior',cd.x,cd.y+1);await doorRoom('CHURCH');
  await exterior('cemetery',55,18);assert(await game.evaluate(()=>ReferenceMotion.gateAmount>.9),'churchyard gate opens before passage');
  await game.evaluate(()=>route(stairsSurface.x,stairsSurface.y));await game.waitForFunction(()=>p.z===400,{},{timeout:90000});await capture('crypt-hall');await game.evaluate(()=>{const s=ReferenceWorld.scenes.crypt;route(s.up.x,s.up.y)});await game.waitForFunction(()=>p.z===0,{},{timeout:90000});
  await exterior('harbour',18,59);await doorRoom('BOAT');
  // The town review deliberately used a new level-one character. The outer
  // wilderness contains real hostile creatures: prepare the same character
  // through the existing Quartermaster UI and authoritative purchase/equip
  // actions before walking to the level-30+ destinations. Do not disable AI,
  // grant invulnerability, teleport, or patch the character's stats directly.
  const supplyAt=await game.evaluate(()=>[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>({x:testSupplier.x+dx,y:testSupplier.y+dy})).find(q=>walkable(q.x,q.y)&&!occupied(q.x,q.y,0)));
  assert(supplyAt,'Quartermaster has a reachable approach');await walk(supplyAt.x,supplyAt.y);
  assert(await game.evaluate(()=>showTestSupplies()));await game.locator('[data-test-level="100"]').click();await game.waitForFunction(()=>p.level===100,{},{timeout:30000});
  await game.locator('[data-test-supplies="gold"]').click();await game.waitForFunction(()=>p.gold>=10000000,{},{timeout:30000});
  for(const slot of ['head','armor','legs','mainhand','offhand']){
   const base='base_testforge_bulwark_'+slot;
   assert(await game.evaluate(base=>buyNpcOffer('quartermaster',base,'backpack',containerCells('backpack').findIndex(id=>!id)),base));
   await game.waitForFunction(base=>p.bag.some(id=>items[id]?.baseId===base),base,{timeout:30000});
   assert(await game.evaluate(({base,slot})=>inventoryEquip(inventoryCells().findIndex(id=>items[id]?.baseId===base),slot),{base,slot}));
   await game.waitForFunction(({base,slot})=>items[p.equip[slot]]?.baseId===base,{base,slot},{timeout:30000});
  }
  await game.locator('#close').click();
  evidence.wildernessFixture=await game.evaluate(()=>({level:p.level,equipment:Object.fromEntries(Object.entries(p.equip).map(([slot,id])=>[slot,items[id]?.baseId||id])),source:'Existing Quartermaster UI, server-backed purchases and equipment actions; combat remains enabled'}));
  for(const [key,exteriorKey,z]of [['orc','orcExterior',401],['dragon','dragonExterior',402]]){
   const at=await game.evaluate(key=>({x:adventures[key].x,y:adventures[key].y+1}),key);await exterior(exteriorKey,at.x,at.y);await game.evaluate(key=>enterAdventure(key),key);await game.waitForFunction(z=>p.z===z,z,{timeout:30000});await capture(key+'-hall');await game.evaluate(()=>{const s=ReferenceWorld.active();route(s.up.x,s.up.y)});await game.waitForFunction(()=>p.z===0,{},{timeout:90000});
  }
  await walk(22,29);
  evidence.checks.push('Actual installed game screenshots of all thirteen scenes','Original image pixel comparison','Ordinary movement through town, churchyard, harbour, tower and cave approaches','Existing NPC services','Actor behind/in front of anvil','Proximity gate opening','Automatic doors and vestibule return trips');
  console.log('PASS: installed artwork scenes, original-image comparison, real doors, room paths and services. Manual side-by-side acceptance still required.');
 }finally{
  await game.evaluate(()=>{if(window.__artReviewCamera){creatorCamera=window.__artReviewCamera;delete window.__artReviewCamera;}}).catch(()=>{});
  fs.writeFileSync(path.join(output,'reference-art-verification.json'),JSON.stringify(evidence,null,2));
  await app.evaluate(({BrowserWindow},old)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.webContents.setZoomFactor(old.zoom);w.setContentSize(...old.size);},original);
 }
};
