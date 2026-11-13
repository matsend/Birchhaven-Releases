'use strict';
// Same coordinates drive terrain, edited scenery, directional marker and navigation.
const cornerMap={zoom:1,miniZoom:1,center:null,drag:null,suppressClick:false,minZoom:1,maxZoom:8};
try{const value=Number(localStorage.getItem('birchhaven-minimap-zoom'));if(Number.isFinite(value)&&value>0)cornerMap.miniZoom=Math.max(.25,Math.min(4,value));}catch{}
function cornerMapBounds(width,height){
 const size=mapSize();if(width<=260){const w=Math.min(40/cornerMap.miniZoom,size.w),h=w*height/width;return {x:p.x+.5-w*.5,y:p.y+.5-h*.5,w,h};}
 // The expanded map uses the entire square, with the world centered at 100%.
 const w=Math.max(size.w,size.h*width/height)/cornerMap.zoom,h=w*height/width;
 const center=cornerMap.center||{x:size.w/2,y:size.h/2};return {x:center.x-w*.5,y:center.y-h*.5,w,h};
}
mapWindow=function(width){return cornerMapBounds(width,width<=260?$('map').height:($('largemap').height||width*.7));};
function cornerMapArrow(c,width,height,bounds){const sx=width/bounds.w,sy=height/bounds.h,x=(p.x+.5-bounds.x)*sx,y=(p.y+.5-bounds.y)*sy,r=10,angle={north:0,east:Math.PI/2,south:Math.PI,west:-Math.PI/2}[p.facing]??Math.PI;c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(0,-r);c.lineTo(r*.6,r*.65);c.lineTo(0,r*.3);c.lineTo(-r*.6,r*.65);c.closePath();c.fillStyle='#fff1c9';c.strokeStyle='#30220f';c.lineWidth=width<=260?1.5:2;c.stroke();c.fill();c.restore();}
paintMap=function(c,width,height){
 reveal();const size=mapSize(),bounds=cornerMapBounds(width,height),known=discovered[explorationKey()]||new Set(),sx=width/bounds.w,sy=height/bounds.h,small=width<=260;
 c.save();c.imageSmoothingEnabled=false;c.fillStyle='#08150f';c.fillRect(0,0,width,height);
 const colors={water:'#284b54',grass:'#576d43',tree:'#2c4833',path:'#aa966b',sand:'#aea078',stone:'#969c89',house:'#ac9569',wall:'#202e28',rock:'#7a8377',stairs:'#ddc28a',wood:'#826a49'};
 for(const n of known){const x=n%size.w,y=Math.floor(n/size.w);if(x<bounds.x-1||y<bounds.y-1||x>bounds.x+bounds.w||y>bounds.y+bounds.h)continue;c.fillStyle=colors[tile(x,y)]||'#354137';c.fillRect((x-bounds.x)*sx,(y-bounds.y)*sy,Math.ceil(sx),Math.ceil(sy));}
 if(p.z===0&&typeof Creator!=='undefined'&&Creator.ready)for(const o of Creator.doc.objects){const a=creatorAsset(o.asset);if(!a?.blocks)continue;c.fillStyle=a.render==='tree'||a.natureKind==='tree'?'#2c4833':'#7d7259';for(const {x,y} of creatorCells(a,o))if(x>=bounds.x&&y>=bounds.y&&x<bounds.x+bounds.w&&y<bounds.y+bounds.h&&known.has(y*size.w+x))c.fillRect((x-bounds.x)*sx,(y-bounds.y)*sy,Math.ceil(sx),Math.ceil(sy));}
 if(!small){c.font='bold 13px Georgia';c.textAlign='center';for(const m of mapMarkers()){if(!known.has(Math.floor(m.y)*size.w+Math.floor(m.x))||m.x<bounds.x||m.y<bounds.y||m.x>=bounds.x+bounds.w||m.y>=bounds.y+bounds.h)continue;const x=(m.x+.5-bounds.x)*sx,y=(m.y+.5-bounds.y)*sy;c.fillStyle='#0c1711';c.fillRect(x-8,y-9,16,18);c.fillStyle=m.color;c.fillText(m.symbol,x,y+4);}}
 cornerMapArrow(c,width,height,bounds);c.restore();
};
function cornerMapPoint(canvas,clientX,clientY){const rect=canvas.getBoundingClientRect(),u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;if(u<0||v<0||u>1||v>1)return null;const b=cornerMapBounds(canvas.width,canvas.height);return {x:b.x+u*b.w,y:b.y+v*b.h,u,v};}
mapClick=function(e){if(cornerMap.suppressClick){cornerMap.suppressClick=false;return;}const point=cornerMapPoint(e.currentTarget,e.clientX,e.clientY);if(point)navigateMap(Math.floor(point.x),Math.floor(point.y));};
const cornerMini=$('map'),cornerBox=cornerMini.parentElement;cornerMini.width=240;cornerMini.height=240;cornerMini.onclick=mapClick;cornerMini.addEventListener('pointerdown',()=>{cornerMap.suppressClick=false;});cornerMini.setAttribute('aria-label','Minimap. The arrow shows your facing direction. Click explored ground to walk.');if(cornerBox)cornerBox.classList.add('corner-map');
function zoomMiniMap(factor,reset=false){cornerMap.miniZoom=reset?1:Math.max(.25,Math.min(4,cornerMap.miniZoom*factor));try{localStorage.setItem('birchhaven-minimap-zoom',String(cornerMap.miniZoom));}catch{}const label=$('mini-zoom-value');if(label)label.textContent=Math.round(cornerMap.miniZoom*100)+'%';paintMap(MC,cornerMini.width,cornerMini.height);}
if(cornerBox){const controls=document.createElement('div');controls.className='mini-zoom-controls';controls.setAttribute('aria-label','Minimap zoom');controls.innerHTML='<button type="button" id="mini-zoom-out" aria-label="Zoom minimap out" title="Zoom minimap out">−</button><button type="button" id="mini-zoom-value" aria-label="Reset minimap zoom" title="Reset minimap zoom">'+Math.round(cornerMap.miniZoom*100)+'%</button><button type="button" id="mini-zoom-in" aria-label="Zoom minimap in" title="Zoom minimap in">+</button>';cornerBox.append(controls);controls.append($('expandmap'));
 const compass=document.createElement('div');compass.className='minimap-compass';compass.setAttribute('role','img');compass.setAttribute('aria-label','Compass: north up, east right, south down, west left');compass.innerHTML='<svg viewBox="0 0 285 285" aria-hidden="true"><path d="M142.5 24v7M254 142.5h7M142.5 254v7M24 142.5h7"/><text x="142.5" y="16">N</text><text x="269" y="142.5">E</text><text x="142.5" y="269">S</text><text x="16" y="142.5">W</text></svg>';cornerBox.append(compass);$('mini-zoom-in').onclick=()=>zoomMiniMap(1.25);$('mini-zoom-out').onclick=()=>zoomMiniMap(1/1.25);$('mini-zoom-value').onclick=()=>zoomMiniMap(1,true);}
cornerMini.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();zoomMiniMap(e.deltaY<0?1.2:1/1.2);},{passive:false});
cornerMini.setAttribute('aria-label','Minimap. Scroll or use + and − to zoom. Click explored ground to walk.');
$('expandmap').innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';$('expandmap').setAttribute('aria-label','Expand map');$('expandmap').title='Expand map [M]';
drawMap=function(){paintMap(MC,cornerMini.width,cornerMini.height);drawSkillFX(performance.now());drawLandmarks();};
function drawCornerLarge(){const m=$('largemap');paintMap(m.getContext('2d'),m.width,m.height);const label=$('map-zoom-value');if(label)label.textContent=Math.round(cornerMap.zoom*100)+'%';}
function zoomCornerMap(factor,clientX,clientY){const m=$('largemap'),before=clientX==null?null:cornerMapPoint(m,clientX,clientY),next=Math.max(cornerMap.minZoom,Math.min(cornerMap.maxZoom,cornerMap.zoom*factor));if(next===cornerMap.zoom)return;cornerMap.zoom=next;if(before){const after=cornerMapBounds(m.width,m.height);cornerMap.center={x:before.x+(.5-before.u)*after.w,y:before.y+(.5-before.v)*after.h};}drawCornerLarge();}
function openCornerMap(){
 cornerMap.zoom=1;cornerMap.center=null;cornerMap.drag=null;cornerMap.suppressClick=false;
 modal('<div class="corner-map-heading"><h2>'+zoneName()+'</h2><div class="map-zoom-controls"><button id="map-zoom-out" aria-label="Zoom out">−</button><button id="map-zoom-value" aria-label="Reset map zoom">100%</button><button id="map-zoom-in" aria-label="Zoom in">+</button></div></div><div class="corner-map corner-map-large"><canvas id="largemap" width="1000" height="1000" aria-label="Explored map. Scroll to zoom. Drag to pan. Click explored ground to walk."></canvas></div><p class="corner-map-hint">Scroll to zoom · Drag to pan · Click to walk · M or Esc to close</p>');
 $('modal').dataset.kind='map';$('modal').classList.add('corner-map-dialog');
 const m=$('largemap');m.width=m.height=Math.max(420,Math.min(1100,innerWidth-110,innerHeight-180));m.onclick=mapClick;
 m.addEventListener('wheel',e=>{e.preventDefault();zoomCornerMap(e.deltaY<0?1.2:1/1.2,e.clientX,e.clientY);},{passive:false});
 m.addEventListener('pointerdown',e=>{if(e.button!==0)return;const point=cornerMapPoint(m,e.clientX,e.clientY);if(!point)return;cornerMap.suppressClick=false;cornerMap.drag={x:e.clientX,y:e.clientY,center:cornerMap.center||{x:mapSize().w/2,y:mapSize().h/2},bounds:cornerMapBounds(m.width,m.height),moved:false};m.setPointerCapture(e.pointerId);});
 m.addEventListener('pointermove',e=>{const d=cornerMap.drag;if(!d)return;const rect=m.getBoundingClientRect(),dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(!d.moved)return;cornerMap.center={x:d.center.x-dx/rect.width*d.bounds.w,y:d.center.y-dy/rect.height*d.bounds.h};drawCornerLarge();});
 m.addEventListener('pointerup',()=>{cornerMap.suppressClick=!!cornerMap.drag?.moved;cornerMap.drag=null;});m.addEventListener('pointercancel',()=>{cornerMap.drag=null;cornerMap.suppressClick=true;});
 $('map-zoom-out').onclick=()=>zoomCornerMap(1/1.25);$('map-zoom-in').onclick=()=>zoomCornerMap(1.25);$('map-zoom-value').onclick=()=>{cornerMap.zoom=1;cornerMap.center=null;drawCornerLarge();};drawCornerLarge();
}
$('expandmap').onclick=openCornerMap;
// Other dialogs keep their own layout after the map has been closed.
const cornerModalBefore=modal;modal=function(...args){$('modal').classList.remove('corner-map-dialog');return cornerModalBefore(...args);};
