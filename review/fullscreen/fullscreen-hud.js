'use strict';
// Viewport presentation only. Existing map navigation, item ownership and
// container controls remain authoritative; these preferences belong to this PC.
(()=>{
 const viewport=document.querySelector('.game-shell>.viewport');
 const rail=document.querySelector('aside.container-sidebar');
 if(!viewport||!rail||typeof containerHost==='undefined'||!containerHost)return;
 const character=containerPanels.get('character'),map=document.querySelector('.mapbox.corner-map');
 if(!character||!map)return;
 document.body.classList.add('fullscreen-hud');rail.classList.add('hud-rail');
 viewport.append(rail);

 // The complete identity card folds with Character, including portrait and XP.
 const hero=rail.querySelector('.hero'),content=character.querySelector('.container-content');
 if(hero)content.prepend(hero);
 character.querySelector('.container-heading').title='Minimize or expand Character';
 character.querySelector('.container-resize').setAttribute('aria-hidden','true');
 orderContainerPanels=function(){
  if(containerPanelDrag)return;
  const rank=n=>{const i=containerPanelState.order.indexOf(n.dataset.containerPanel);return i<0?1e6:i;};
  const ordered=[character,...[...containerHost.children].filter(n=>n!==character).sort((a,b)=>rank(a)-rank(b))];
  for(let i=0;i<ordered.length;i++)if(containerHost.children[i]!==ordered[i])containerHost.insertBefore(ordered[i],containerHost.children[i]||null);
 };
 // Character stays connected to the map; bag headers retain their saved order.
 const heading=character.querySelector('.container-heading');
 for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])heading.addEventListener(type,e=>{e.stopImmediatePropagation();},true);
 heading.addEventListener('click',e=>{if(!e.target.closest('button'))collapseContainerPanel('character');});
 heading.addEventListener('keydown',e=>{if(e.target!==heading)return;if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}},true);
 orderContainerPanels();

 const mapPanel=document.createElement('section');mapPanel.className='hud-minimap';mapPanel.setAttribute('aria-label','Minimap');
 const mapHeading=document.createElement('div');mapHeading.className='container-heading hud-map-heading';
 mapHeading.innerHTML='<span>Minimap</span><small>N ↑</small><button type="button" id="minimize-minimap" aria-controls="hud-minimap-body"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg></button>';
 const mapBody=document.createElement('div');mapBody.id='hud-minimap-body';mapBody.append(map);mapPanel.append(mapHeading,mapBody);rail.prepend(mapPanel);
 const key='birchhaven-fullscreen-hud-v1';let prefs={};
 try{const value=JSON.parse(localStorage.getItem(key));if(value&&typeof value==='object'&&!Array.isArray(value))prefs=value;}catch{}
 const minimize=mapHeading.querySelector('button');
 function applyMap(){const collapsed=prefs.minimapCollapsed===true;mapBody.hidden=collapsed;mapPanel.classList.toggle('container-minimized',collapsed);minimize.setAttribute('aria-expanded',String(!collapsed));minimize.setAttribute('aria-label',(collapsed?'Expand':'Minimize')+' minimap');minimize.title=(collapsed?'Expand':'Minimize')+' minimap';}
 function toggleMap(){prefs.minimapCollapsed=!prefs.minimapCollapsed;applyMap();try{localStorage.setItem(key,JSON.stringify({minimapCollapsed:!!prefs.minimapCollapsed}));}catch{}}
 minimize.onclick=toggleMap;
 mapHeading.addEventListener('click',e=>{if(!e.target.closest('button'))toggleMap();});
 applyMap();
 // Keep combat FX and landmarks running while the hidden minimap skips painting.
 const drawBefore=drawMap;
 drawMap=function(){if(!mapBody.hidden)return drawBefore();drawSkillFX(performance.now());drawLandmarks();};

 // The solo event log stays available inside the viewport, without a page footer.
 const log=document.querySelector('.journal');if(log&&!log.hidden){log.classList.add('hud-adventure-log');viewport.append(log);}
 // Reserve the full upper extent of the painted energy ornament. The source's
 // right half starts at y268 and is scaled .5 within the 1983×793 composition.
 // This covers the ornament, not merely its percentage text or circular liquid.
 const status=document.querySelector('.world-status');
 function fit(){
  const rect=viewport.getBoundingClientRect(),top=Math.ceil(status?.getBoundingClientRect().height||38)+4;
  const bottom=Math.ceil(rect.width*(793-(396.5+268*.5))/1983)+10;
  rail.style.setProperty('--hud-top',top+'px');rail.style.setProperty('--hud-bottom',bottom+'px');
 }
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(fit);observer.observe(viewport);if(status)observer.observe(status);}
 window.addEventListener('resize',fit);fit();
})();
