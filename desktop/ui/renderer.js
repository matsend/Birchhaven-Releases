'use strict';
const message=document.getElementById('message'),installation=document.getElementById('installation'),choose=document.getElementById('choose'),start=document.getElementById('start');
function render(state){message.textContent=state.message;installation.textContent=state.installation||'Förbereder spelet…';const busy=['preparing','starting','closing'].includes(state.phase);choose.disabled=busy||!state.installation;start.disabled=busy||!state.installation;start.textContent=state.phase==='starting'?'Startar…':'Starta Birchhaven';}
window.birchhavenClient.onState(render);window.birchhavenClient.getState().then(render);
choose.onclick=async()=>{try{render(await window.birchhavenClient.chooseInstallation());}catch(error){message.textContent=error.message;}};
start.onclick=async()=>{try{await window.birchhavenClient.start();}catch(error){message.textContent=error.message;}};

document.getElementById('display').onclick=()=>window.birchhavenClient.displaySettings();
