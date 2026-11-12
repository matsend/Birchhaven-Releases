// Runs under the bundled standalone Node, not inside the renderer or Electron's
// Node runtime. The existing launcher owns recovery, database locks and backups.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'');
if(!process.connected||process.argv.length!==3)throw Error('Start this host through the Birchhaven desktop client.');
let ready=false,closing=false,pendingClose=false;
function shutdown(){
 pendingClose=true;
 if(!ready||closing)return;
 closing=true;
 if(!process.emit('SIGTERM'))process.exit(0);
}
process.on('message',message=>{if(message?.type==='shutdown')shutdown();});
process.on('disconnect',shutdown);
process.argv=[process.execPath,path.join(root,'Birchhaven-Launcher.mjs'),'--no-open'];
process.chdir(root);
try{
 await import(pathToFileURL(path.join(root,'Birchhaven-Launcher.mjs')).href);
 ready=true;
 if(process.exitCode)throw Error('Spelets startprocess avslutades med ett fel.');
 if(pendingClose||!process.connected)shutdown();else process.send({type:'ready'});
}catch(error){
 if(process.connected)process.send({type:'failed',message:String(error.message).slice(0,500)});
 ready=true;shutdown();process.exitCode=1;
}
