'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('birchhavenDisplay',Object.freeze({get:()=>ipcRenderer.invoke('display:get'),preview:value=>ipcRenderer.invoke('display:preview',value),keep:()=>ipcRenderer.invoke('display:keep'),revert:()=>ipcRenderer.invoke('display:revert'),onState:listener=>ipcRenderer.on('display:state',(_event,state)=>listener(state))}));
