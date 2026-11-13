'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('birchhavenDesktop',Object.freeze({exit:()=>ipcRenderer.invoke('client:exit'),displaySettings:()=>ipcRenderer.invoke('client:display'),update:()=>ipcRenderer.invoke('client:update')}));
