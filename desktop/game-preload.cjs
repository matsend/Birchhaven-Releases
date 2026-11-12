'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('birchhavenDesktop',Object.freeze({update:()=>ipcRenderer.invoke('client:update')}));
