'use strict';
const api=window.birchhavenDisplay,$=id=>document.getElementById(id);let state;
function render(s){state=s;$('mode').value=s.current.fullscreen?'fullscreen':'window';$('resolution').replaceChildren(...s.resolutions.map(([w,h])=>new Option(w+' × '+h,w+'x'+h)));$('resolution').value=s.current.width+'x'+s.current.height;$('resolution').disabled=s.current.fullscreen;$('scale').replaceChildren(...s.scales.map(n=>new Option(n+' %',n)));$('scale').value=s.current.scale;const pending=!!s.deadline;$('keep').hidden=$('revert').hidden=!pending;$('preview').disabled=pending;$('mode').disabled=$('scale').disabled=pending;$('screen-info').textContent='Skärmyta: '+s.screen.width+' × '+s.screen.height;countdown();}
function countdown(){if(state?.deadline)$('display-message').textContent='Behåll ändringen? Återställs om '+Math.max(0,Math.ceil((state.deadline-Date.now())/1000))+' sekunder.';else $('display-message').textContent='Inställningen sparas när du väljer Behåll.';}
async function run(fn){try{render(await fn());}catch(e){$('display-message').textContent=e.message;}}
$('mode').onchange=()=>{$('resolution').disabled=$('mode').value==='fullscreen';};
$('display-form').onsubmit=e=>{e.preventDefault();const [width,height]=$('resolution').value.split('x').map(Number);run(()=>api.preview({width,height,fullscreen:$('mode').value==='fullscreen',scale:Number($('scale').value)}));};
$('keep').onclick=()=>run(()=>api.keep());$('revert').onclick=()=>run(()=>api.revert());api.onState(render);run(()=>api.get());setInterval(countdown,250);
