'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('birchhavenClient',Object.freeze({
 exit:()=>ipcRenderer.invoke('client:exit'),
 displaySettings:()=>ipcRenderer.invoke('client:display'),
 chooseInstallation:()=>ipcRenderer.invoke('client:choose'),
 start:()=>ipcRenderer.invoke('client:start'),
 getState:()=>ipcRenderer.invoke('client:state'),
 onState:listener=>{const handler=(_event,state)=>listener(state);ipcRenderer.on('client:state',handler);return()=>ipcRenderer.removeListener('client:state',handler);}
}));
