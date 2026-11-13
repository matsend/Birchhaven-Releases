const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function referenceArtSmoke(game,app,output){
 const evidence={status:'awaiting-manual-side-by-side-review',scenes:[],checks:[],limitations:['Exact originals exist for town, blacksmith and inn only.','Browser resampling, live characters and gameplay markers differ from a still reference.','This automated gate does not grant visual acceptance.']};
 const original=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));return{size:w.getContentSize(),zoom:w.webContents.getZoomFactor()};});
 async function settled(){await game.waitForFunction(()=>started&&!worldPreparation.busy&&ReferenceSceneArt.ready(ReferenceWorld.active()),{},{timeout:90000});await game.waitForTimeout(400);}
 async function walk(x,y){assert(await game.evaluate(({x,y})=>{if(!walkable(x,y))return false;route(x,y);return true;},{x,y}));await game.waitForFunction(({x,y})=>p.x===x&&p.y===y,{x,y},{timeout:90000});await settled();}
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
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.setFullScreen(false);w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(1800,1200);});
  await game.waitForFunction(()=>innerWidth===1800&&innerHeight===1200);
  assert(await game.evaluate(()=>p.z===0),'Art review starts in the real town session');
  // Review camera only: the actor, server session, collisions, rendering and
  // loaded original assets remain the real installed game. No image is substituted.
  await game.evaluate(()=>{window.__artReviewCamera=creatorCamera;creatorCamera=()=>{const s=ReferenceWorld.scenes.town;return{x:(s.x+768-24)/T,y:(s.y+512-24)/T};};});
  await capture('town');await game.evaluate(()=>{creatorCamera=window.__artReviewCamera;delete window.__artReviewCamera;});
  for(const key of ['BLACKSMITH','INN']){
   const door=await game.evaluate(key=>({...buildings.find(b=>b.name===key).door}),key);
   const routed=await game.evaluate(({x,y})=>{
    const queue=[{x:p.x,y:p.y,steps:[]}];
    const seen=new Set([p.x+','+p.y]);
    const otherDoors=new Set(buildings.filter(b=>b.door.x!==x||b.door.y!==y).map(b=>b.door.x+','+b.door.y));
    for(const position of queue){
     if(position.x===x&&position.y===y){
      path=position.steps;
      return true;
     }
     for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nx=position.x+dx,ny=position.y+dy,cell=nx+','+ny;
      if(seen.has(cell)||otherDoors.has(cell)||!walkable(nx,ny)||occupied(nx,ny))continue;
      seen.add(cell);
      queue.push({x:nx,y:ny,steps:[...position.steps,[nx,ny]]});
     }
    }
    return false;
   },door);
   assert(routed,'Walkable route to '+key+' avoiding other automatic entrances');
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
  evidence.checks.push('Actual installed game screenshots','Original image pixel comparison','Ordinary route movement into and out of both buildings','Existing NPC services','Actor behind/in front of anvil');
  console.log('PASS: installed artwork scenes, original-image comparison, real doors, room paths and services. Manual side-by-side acceptance still required.');
 }finally{
  await game.evaluate(()=>{if(window.__artReviewCamera){creatorCamera=window.__artReviewCamera;delete window.__artReviewCamera;}}).catch(()=>{});
  fs.writeFileSync(path.join(output,'reference-art-verification.json'),JSON.stringify(evidence,null,2));
  await app.evaluate(({BrowserWindow},old)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://localhost:8787'));w.webContents.setZoomFactor(old.zoom);w.setContentSize(...old.size);},original);
 }
};
