'use strict';
const fs=require('node:fs');
const {writeSettings}=require('./core.cjs');
const RESOLUTIONS=[[1024,720],[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440],[3440,1440],[3840,2160]];
const SCALES=[75,85,100,115,125,150];
function normalize(value={}){value=value&&typeof value==='object'?value:{};return {width:RESOLUTIONS.some(([w,h])=>w===value.width&&h===value.height)?value.width:1600,height:RESOLUTIONS.some(([w,h])=>w===value.width&&h===value.height)?value.height:900,fullscreen:value.fullscreen===true,scale:SCALES.includes(value.scale)?value.scale:100};}
function fit(value,area,frame={width:16,height:40}){const p=normalize(value);return {width:Math.max(320,Math.min(p.width,area.width-frame.width)),height:Math.max(240,Math.min(p.height,area.height-frame.height))};}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {};}}
function createDisplay({screen,file,getGame,onChange=()=>{},previewMs=15000}){
 let saved=normalize(read(file).display),current={...saved},deadline=0,timer=null,busy=false;
 const target=()=>{const w=getGame();return w&&!w.isDestroyed()?w:null;};
 const monitor=()=>target()?screen.getDisplayMatching(target().getBounds()):screen.getPrimaryDisplay();
 const state=()=>({current:{...current},saved:{...saved},deadline,resolutions:RESOLUTIONS,scales:SCALES,screen:monitor().size});
 async function apply(value){const w=target();current=normalize(value);if(!w)return;
  if(w.isFullScreen())await new Promise((resolve,reject)=>{const done=()=>{clearTimeout(t);w.off('leave-full-screen',done);resolve();};const t=setTimeout(()=>{w.off('leave-full-screen',done);reject(Error('Helskärmen kunde inte lämnas. Försök igen.'));},5000);w.once('leave-full-screen',done);w.setFullScreen(false);});
  if(w.isMaximized())w.unmaximize();
  const area=monitor().workArea,outer=w.getBounds(),content=w.getContentBounds(),size=fit(current,area,{width:Math.max(0,outer.width-content.width),height:Math.max(0,outer.height-content.height)});
  w.setMinimumSize(Math.min(1024,area.width),Math.min(720,area.height));w.setContentSize(size.width,size.height);w.center();w.webContents.setZoomFactor(current.scale/100);
  if(current.fullscreen)w.setFullScreen(true);
 }
 function stop(){clearTimeout(timer);timer=null;deadline=0;}
 async function revert(){if(busy)throw Error('Bildläget ändras. Vänta ett ögonblick.');busy=true;stop();try{await apply(saved);}finally{busy=false;onChange(state());}return state();}
 async function preview(value){if(busy)throw Error('Bildläget ändras. Vänta ett ögonblick.');busy=true;stop();try{await apply(value);deadline=Date.now()+previewMs;timer=setTimeout(()=>void revert().catch(()=>{}),previewMs);}catch(error){await apply(saved);throw error;}finally{busy=false;onChange(state());}return state();}
 function keep(){if(busy)throw Error('Bildläget ändras. Vänta ett ögonblick.');if(!deadline)throw Error('Prova bildläget först.');writeSettings(file,{...read(file),display:current});saved={...current};stop();onChange(state());return state();}
 async function toggle(){if(busy||deadline)return;busy=true;try{await apply({...saved,fullscreen:!saved.fullscreen});writeSettings(file,{...read(file),display:current});saved={...current};}finally{busy=false;onChange(state());}}
 return {state,applySaved:()=>apply(saved),preview,keep,revert,toggle,dispose:stop};
}
module.exports={RESOLUTIONS,SCALES,normalize,fit,createDisplay};
