const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function frontierSmoke(game,output){
 const inventory=await game.evaluate(()=>({sets:FrontierGear.sets.length,equipment:Object.values(Gear.templates).filter(t=>t.frontier).length,npcs:FrontierPlan.npcs.length,quests:frontierQuests.length,floors:Object.values(adventureZones).filter(d=>FrontierDungeons[d.key]).length,bosses:enemies.filter(e=>e.frontierBoss).length,music:Object.keys(musicTracks).length,version:gameRelease.version}));
 assert.deepEqual(inventory,{sets:12,equipment:89,npcs:15,quests:39,floors:6,bosses:6,music:16,version:'8.0.0'});
 const audio=await game.evaluate(async()=>{const durations={};for(const key of Object.keys(musicTracks))durations[key]=(await musicBuffer(key)).duration;return durations;});
 assert(Object.values(audio).every(n=>n>=30));
 // Use ordinary route movement and UI buttons against the local authoritative server.
 async function approach(kind,id,radius){
  await game.evaluate(({kind,id})=>{const at=kind==='npc'?frontierNPC(id):FrontierPlan.harvest.find(n=>n.id===id);const point=[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>({x:at.x+dx,y:at.y+dy})).find(n=>walkable(n.x,n.y));if(!point)throw Error('No approach to '+id);route(point.x,point.y);},{kind,id});
  await game.waitForFunction(({kind,id,radius})=>frontierAt(kind==='npc'?frontierNPC(id):FrontierPlan.harvest.find(n=>n.id===id),radius),{kind,id,radius},{timeout:90000});
 }
 await approach('npc','signe',2);
 assert(await game.evaluate(()=>showFrontierNPC(frontierNPC('signe'))));
 await game.locator('[data-accept-quest="fr_01"]').click();
 await game.waitForFunction(()=>p.acceptedQuests.includes('fr_01'),{},{timeout:30000});
 await game.locator('#close').click();
 const tree=await game.evaluate(()=>FrontierPlan.harvest.find(n=>n.species==='apple'&&n.z===0).id);
 await approach('harvest',tree,1);
 assert(await game.evaluate(id=>showFrontierHarvest(FrontierPlan.harvest.find(n=>n.id===id)),tree));
 await game.locator('[data-frontier-harvest]').click();
 await game.waitForFunction(()=>frontierCount('apple')>=2,{},{timeout:30000});
 if(await game.locator('#modal').evaluate(e=>e.open))await game.locator('#close').click();
 await approach('npc','signe',2);
 assert(await game.evaluate(()=>showFrontierNPC(frontierNPC('signe'))));
 await game.screenshot({path:path.join(output,'frontier-first-quest.png')});
 await game.locator('[data-frontier-claim="fr_01"]').first().click();
 await game.waitForFunction(()=>p.claimed.includes('fr_01'),{},{timeout:30000});
 const reward=await game.evaluate(()=>p.bag.map(id=>items[id]).find(it=>it?.baseId==='base_frontier_farmguard'));
 assert(reward,'A real quest item reaches the actual backpack');
 if(await game.locator('#modal').evaluate(e=>e.open))await game.locator('#close').click();
 fs.writeFileSync(path.join(output,'frontier-verification.json'),JSON.stringify({inventory,audio,quest:'fr_01',reward:reward.baseId,checks:['actual window route movement','NPC dialogue','server-backed quest acceptance','physical harvest','server-backed quest reward','Vorbis decoding in Electron'],limitations:['Not a complete campaign playthrough','No subjective listening review']},null,2));
 console.log('PASS: frontier counts, real first quest/harvest/reward and all 16 audio decodes.');
};
