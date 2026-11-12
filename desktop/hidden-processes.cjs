'use strict';
// Scope: this desktop client's Node process tree only. Preserve all arguments,
// stdio, callbacks and promisified results; add only windowsHide. The existing
// installed game and its stable launcher are never rewritten for the wrapper.
const childProcess=require('node:child_process');
const {syncBuiltinESMExports}=require('node:module');
const {promisify}=require('node:util');
const mark=Symbol.for('birchhaven.hidden-processes');
function installHiddenWindows(api=childProcess,platform=process.platform,sync=syncBuiltinESMExports){
 if(platform!=='win32'||api[mark])return;
 Object.defineProperty(api,mark,{value:true});
 for(const name of ['spawn','spawnSync','execFileSync','fork']){
  const original=api[name];
  api[name]=function(command,args,options){return Array.isArray(args)?original.call(api,command,args,{...options,windowsHide:true}):original.call(api,command,{...args,windowsHide:true});};
 }
 const originalSync=api.execSync;
 api.execSync=(command,options)=>originalSync.call(api,command,{...options,windowsHide:true});
 for(const name of ['execFile','exec']){
  const original=api[name];
  const wrapped=name==='execFile'?function(file,...args){
   const callback=typeof args.at(-1)==='function'?args.pop():undefined;
   const argv=Array.isArray(args[0])?args.shift():[];
   return original.call(api,file,argv,{...args[0],windowsHide:true},callback);
  }:function(command,options,callback){
   if(typeof options==='function'){callback=options;options=undefined;}
   return original.call(api,command,{...options,windowsHide:true},callback);
  };
  Object.defineProperty(wrapped,promisify.custom,{value:(...args)=>{
   let yes,no;const promise=new Promise((resolve,reject)=>{yes=resolve;no=reject;});
   promise.child=wrapped(...args,(error,stdout,stderr)=>{if(error){error.stdout=stdout;error.stderr=stderr;no(error);}else yes({stdout,stderr});});
   return promise;
  }});
  api[name]=wrapped;
 }
 sync();
}
installHiddenWindows();
module.exports={installHiddenWindows};
