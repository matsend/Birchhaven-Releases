'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('birchhavenDesktop',Object.freeze({displaySettings:()=>ipcRenderer.invoke('client:display'),update:()=>ipcRenderer.invoke('client:update')}));
