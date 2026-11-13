const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function frontierSmoke(game,output){
 // The live enemy array is replaced by the active zone snapshot. Count registered
 // boss types across all dungeons, independently of whether town sync has arrived.
 const inventory=await game.evaluate(()=>({sets:FrontierGear.sets.length,equipment:Object.values(Gear.templates).filter(t=>t.frontier).length,npcs:FrontierPlan.npcs.length,quests:frontierQuests.length,floors:Object.values(adventureZones).filter(d=>FrontierDungeons[d.key]).length,bosses:Object.values(types).filter(t=>t.frontierBoss).length,music:Object.keys(musicTracks).length,version:gameRelease.version}));
 assert.deepEqual(inventory,{sets:12,equipment:89,npcs:15,quests:39,floors:6,bosses:6,music:16,version:require('../package.json').version});
 const bossRegistration=await game.evaluate(()=>({actual:Object.values(types).filter(t=>t.frontierBoss).map(t=>t.frontierBoss).sort(),expected:Object.values(FrontierDungeons).flatMap(d=>d.bosses.map(b=>b[0])).sort()}));
 assert.deepEqual(bossRegistration.actual,bossRegistration.expected,'Every authored frontier boss is registered');
 const bossCrops=await game.evaluate(()=>TowerCampaignAssets.boss.rects);
 assert.deepEqual(bossCrops,[[80,5,246,354],[461,5,167,355],[814,5,208,355],[1189,6,184,353],[41,366,327,328],[447,367,198,326],[739,367,320,327],[1185,367,200,327],[7,698,365,366],[397,701,286,364],[764,698,321,363],[1147,701,279,366]],'Installed boss atlas uses reviewed full-body crops');
 // Character creation can finish before the first visible-page audio gesture.
 // Exercise the real music control before asking its decoder for all tracks.
 await game.bringToFront();
 await game.waitForFunction(()=>!document.hidden);
 const musicToggle=game.locator('#music-toggle');
 if(await musicToggle.getAttribute('aria-pressed')==='true')await musicToggle.click();
 await musicToggle.click();
 await game.waitForFunction(()=>music.unlocked&&music.context?.state==='running',{},{timeout:30000});
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
 console.log('PASS: frontier counts, real first quest/harvest/reward, music control and all 16 audio decodes.');
};
