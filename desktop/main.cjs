'use strict';
const {app,BrowserWindow,Menu,dialog,ipcMain,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {GAME_ORIGIN,validateInstallation,assertPortsFree,isGameURL,isSyncURL,isExternalURL,updaterStatus,SAVE_SCRIPT,writeSettings,loadGameWindow}=require('./core.cjs');
const {provision,importSave}=require('./install.cjs');
const {checkUpdate,downloadInstaller}=require('./update.cjs');
app.setName('Birchhaven');
if(process.env.CI==='true'&&process.env.BIRCHHAVEN_TEST_USER_DATA)app.setPath('userData',path.resolve(process.env.BIRCHHAVEN_TEST_USER_DATA));app.setAppUserModelId('se.birchhaven.desktop');
let setup,game,child,childExit,installation='',launching=false,closing=false,canQuit=false,playing=false,shutdownPromise;
let updating=false,pendingInstaller=null;
let state={phase:'preparing',message:'Förbereder dina spelfiler…',installation:''};
const setupURL=pathToFileURL(path.join(__dirname,'ui/index.html')).href;
const security={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false};
const settingsFile=()=>path.join(app.getPath('userData'),'desktop-settings.json');
function publish(phase,message){state={phase,message,installation};if(setup&&!setup.isDestroyed())setup.webContents.send('client:state',state);}
function validSetup(event){return setup&&!setup.isDestroyed()&&event.sender===setup.webContents&&event.senderFrame===setup.webContents.mainFrame&&event.senderFrame.url===setupURL;}
function requireSetup(event){if(!validSetup(event))throw Error('Ogiltigt klientanrop.');}
function windowOptions(extra={}){return{title:'Birchhaven',backgroundColor:'#10221c',icon:path.join(__dirname,'ui/icon.png'),show:false,...extra,webPreferences:{...security,...extra.webPreferences}};}
function lockNavigation(window,setupPage=false){
 window.webContents.setWindowOpenHandler(({url})=>{
  // World Creator sync needs a real opener/postMessage relationship. Its remote
  // popup gets no preload or Node access; its own auth navigation remains remote.
  if(!setupPage&&isSyncURL(url))return{action:'allow',overrideBrowserWindowOptions:{width:650,height:640,autoHideMenuBar:true,webPreferences:{...security,preload:undefined}}};
  if(isExternalURL(url))void shell.openExternal(url);return{action:'deny'};
 });
 const guard=(event,legacyURL)=>{const url=event.url||legacyURL;if(setupPage?url===setupURL:isGameURL(url))return;event.preventDefault();if(isExternalURL(url))void shell.openExternal(url);};
 window.webContents.on('will-navigate',guard);window.webContents.on('will-redirect',guard);
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 window.webContents.session.setPermissionCheckHandler(()=>false);
}
function showSetup(){
 if(setup&&!setup.isDestroyed()){setup.show();setup.focus();return;}
 setup=new BrowserWindow(windowOptions({width:740,height:520,minWidth:640,minHeight:460,resizable:true,webPreferences:{preload:path.join(__dirname,'preload.cjs')}}));
 setup.removeMenu();lockNavigation(setup,true);setup.on('close',event=>{if(!canQuit&&(child||launching)){event.preventDefault();void closeClient();}});
 setup.once('ready-to-show',()=>setup.show());void setup.loadFile(path.join(__dirname,'ui/index.html'));
}
function nativeNode(){
 const executable=app.isPackaged?path.join(process.resourcesPath,'node','node.exe'):process.env.BIRCHHAVEN_DESKTOP_NODE;
 if(!executable||!path.isAbsolute(executable)||!fs.existsSync(executable))throw Error('Den medföljande spelmotorn saknas. Installera om klienten.');
 return executable;
}
function appendLog(chunk){
 const file=path.join(app.getPath('userData'),'desktop.log');
 try{if(fs.existsSync(file)&&fs.statSync(file).size>512*1024)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,String(chunk).slice(0,16384));}catch{}
}
async function startGame(){
 if(launching||child||updating||state.phase==='preparing')return;launching=true;
 try{
  installation=validateInstallation(installation);await assertPortsFree();if(closing)return;
  writeSettings(settingsFile(),{installation});publish('starting','Startar Birchhaven och kontrollerar sparningen…');
  child=spawn(nativeNode(),[path.join(__dirname,'server-host.mjs'),installation],{cwd:installation,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+JSON.stringify(path.join(__dirname,'hidden-processes.cjs'))).trim()}});
  const ownChild=child;
  childExit=new Promise(resolve=>{ownChild.once('exit',(code)=>{if(child===ownChild)child=null;resolve();if(!closing&&playing){playing=false;game?.destroy();showSetup();publish('error','Spelprocessen stängdes. Dina sparningar ligger kvar. Starta igen.');}appendLog('Server exit '+code+'\n');});ownChild.once('error',()=>{if(child===ownChild)child=null;resolve();});});
  ownChild.stdout.on('data',appendLog);ownChild.stderr.on('data',appendLog);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('Starten tar för lång tid. Ingen ny spelruta öppnades.'));},150000);
   const cleanup=()=>{clearTimeout(timer);ownChild.off('message',message);ownChild.off('exit',exited);ownChild.off('error',failed);};
   const failed=error=>{cleanup();reject(error);};const exited=()=>failed(Error('Spelet kunde inte startas. Kontrollera desktop.log i klientens inställningsmapp.'));
   const message=m=>{if(m?.type==='ready'){cleanup();resolve();}else if(m?.type==='failed')failed(Error(m.message));};
   ownChild.on('message',message);ownChild.once('exit',exited);ownChild.once('error',failed);
  });
  if(closing)return;
  game=new BrowserWindow(windowOptions({width:1440,height:960,minWidth:1024,minHeight:720,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'game-preload.cjs')}}));game.removeMenu();lockNavigation(game);
  game.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();game.setFullScreen(!game.isFullScreen());}});
  game.on('close',event=>{if(!canQuit){event.preventDefault();void closeClient();}});
  game.webContents.on('render-process-gone',()=>{playing=false;showSetup();publish('error','Spelfönstret slutade svara. Spelprocessen hålls igång för att skydda sparningen.');});
  await loadGameWindow(game);if(!child)throw Error('Spelprocessen stängdes under starten.');playing=true;game.show();setup?.hide();game.focus();publish('playing','Birchhaven körs.');
 }catch(error){if(game&&!playing&&!game.isDestroyed())game.destroy();publish('error',error.message);if(child&&!playing)await stopHost().catch(()=>{});}
 finally{launching=false;}
}
async function stopHost(){
 if(shutdownPromise)return shutdownPromise;
 shutdownPromise=(async()=>{const own=child;if(!own)return;if(own.connected)own.send({type:'shutdown'});
  let timer;try{await Promise.race([childExit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Spelprocessen har inte stängts ännu. Försök igen.')),160000);})]);}finally{clearTimeout(timer);}
 })();try{await shutdownPromise;}finally{shutdownPromise=null;}
}
async function closeClient(){
 if(closing)return;if(updating&&!pendingInstaller){await dialog.showMessageBox(game||setup,{type:'info',message:'Vänta tills nedladdningen är klar.',buttons:['OK']});return;}closing=true;
 try{
  if(playing&&game&&!game.isDestroyed()){
   await updaterStatus();
   let timer;let result;try{result=await Promise.race([game.webContents.executeJavaScript(SAVE_SCRIPT),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Sparningen svarade inte i tid. Spelet hålls öppet.')),90000);})]);}finally{clearTimeout(timer);}
   if(result?.ok!==true)throw Error(result?.message||'Sparningen kunde inte bekräftas.');
   await updaterStatus();
  }else if(child&&!launching){
   const decision=await dialog.showMessageBox(setup||undefined,{type:'warning',title:'Avsluta Birchhaven',message:'Spelfönstret är inte tillgängligt. Den senaste sparningen kan inte bekräftas.',buttons:['Stanna kvar','Avsluta ändå'],defaultId:0,cancelId:0});
   if(decision.response!==1){closing=false;return;}
  }
  publish('closing','Avslutar spelprocessen…');await stopHost();
  if(pendingInstaller){const installer=spawn(pendingInstaller,[],{detached:true,stdio:'ignore',windowsHide:false});await new Promise((resolve,reject)=>{installer.once('spawn',resolve);installer.once('error',reject);});installer.unref();}
  canQuit=true;game?.destroy();setup?.destroy();app.quit();
 }catch(error){closing=false;await dialog.showMessageBox(game&&!game.isDestroyed()?game:setup,{type:'warning',title:'Birchhaven hålls öppet',message:error.message,buttons:['OK']});}
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{const window=game&&!game.isDestroyed()?game:setup;window?.show();window?.focus();});
 app.on('before-quit',event=>{if(!canQuit&&(child||launching)){event.preventDefault();void closeClient();}});
 app.on('window-all-closed',()=>{if(!child)app.quit();});
 app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);

  ipcMain.handle('client:state',event=>{requireSetup(event);return{...state,installation};});
  ipcMain.handle('client:choose',async event=>{requireSetup(event);if(launching||child||state.phase==='preparing')return state;
   const selection=await dialog.showOpenDialog(setup,{title:'Välj din gamla Birchhaven-spelmapp',properties:['openDirectory']});
   if(!selection.canceled){try{
    await assertPortsFree();
    const choice=await dialog.showMessageBox(setup,{type:'question',title:'Ta över din sparning',message:'Kopiera karaktärer, utrustning och kartor från den gamla spelmappen? Originalet finns kvar. Klientens nuvarande sparning säkerhetskopieras.',buttons:['Kopiera sparningen','Avbryt'],defaultId:0,cancelId:1});
    if(choice.response===0){publish('preparing','Kopierar och kontrollerar sparningen…');await new Promise(r=>setImmediate(r));importSave(selection.filePaths[0],installation);publish('setup','Din gamla sparning är kopierad. Starta Birchhaven för att fortsätta.');}
   }catch(error){publish('error',error.message);}}
   return state;
  });
  ipcMain.handle('client:update',async event=>{
   if(!game||event.sender!==game.webContents||event.senderFrame!==game.webContents.mainFrame||!isGameURL(event.senderFrame.url))throw Error('Ogiltigt uppdateringsanrop.');
   if(updating||closing)return {message:'En uppdatering pågår redan.'};updating=true;
   try{
    const manifest=await checkUpdate(app.getVersion());if(!manifest)return {message:'Du har senaste Windows-klienten ('+app.getVersion()+').'};
    const choice=await dialog.showMessageBox(game,{type:'question',title:'Uppdatera Birchhaven',message:'Windows-klienten '+manifest.version+' finns. Hämta och installera? Spelet sparas och stängs före installationen.',buttons:['Hämta och installera','Senare'],defaultId:0,cancelId:1});
    if(choice.response!==0)return {message:'Uppdateringen väntar.'};
    pendingInstaller=await downloadInstaller(manifest,path.join(app.getPath('userData'),'downloads'));
    await closeClient();return {message:canQuit?'Installationen startar…':'Uppdateringen är hämtad. Spara kartan och försök igen.'};
   }catch(error){return {message:error.message};}finally{updating=false;pendingInstaller=null;}
  });
  ipcMain.handle('client:start',event=>{requireSetup(event);void startGame();return state;});
  showSetup();
  await new Promise(r=>setTimeout(r,150));
  try{await assertPortsFree();installation=provision(path.join(process.resourcesPath,'runtime'),app.getPath('userData'),app.getVersion());publish('setup','Klart att spela. Har du spelat tidigare? Ta över din gamla sparning först.');}
  catch(error){publish('error',error.message);}
 }).catch(error=>{dialog.showErrorBox('Birchhaven kunde inte starta',error.message);app.quit();});
}
