const fs=require('fs'),path=require('path'),vm=require('vm'),Module=require('module'),assert=require('assert');
const root=path.resolve(__dirname,'../../../..');const generator=path.join(root,'devxtension/lib-bild/config/webpackCompileUtils/additionalUpdater.js');
process.chdir(path.join(root,'test'));fs.mkdirSync('dist',{recursive:true});require(generator)();
const manifest=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));assert(manifest.content_scripts[0].matches.includes('https://meet.google.com/*'));assert.equal(manifest.background.service_worker,'background.js');
const background=fs.readFileSync('dist/background.js','utf8');
assert(background.includes('https://meet.google.com/*'));
let callback, receiver=false; const reloads=[],messages=[];
const ctx={URL,chrome:{
 webNavigation:{onHistoryStateUpdated:{addListener:fn=>callback=fn}},
 tabs:{reload:id=>reloads.push(id),sendMessage:(id,message,respond)=>{
   messages.push({id,message});
   if(!receiver)ctx.chrome.runtime.lastError={message:'No receiver'};
   respond(receiver?{handled:true}:undefined);delete ctx.chrome.runtime.lastError;
 },onUpdated:{addListener:()=>{}},onActivated:{addListener:()=>{}}},
 runtime:{onMessage:{addListener:()=>{}}}
}};
vm.runInNewContext(background,ctx);
callback({tabId:7,frameId:0,url:'https://meet.google.com/abc'});
callback({tabId:8,frameId:0,url:'https://meet.google.com.evil.org/abc'});
callback({tabId:9,frameId:1,url:'https://meet.google.com/abc'});
assert.deepEqual(reloads,[7]);assert.equal(messages.length,2);
receiver=true;callback({tabId:10,frameId:0,url:'https://meet.google.com/next'});
assert.deepEqual(reloads,[7]);assert.equal(messages[2].message.type,'__DEVEX_ROUTE_CHANGED__');
console.log(JSON.stringify({manifest:'pass',url_injection:'pass',background_worker:'pass',navigation_fallback:'pass',unmatched_no_reload:'pass',frame_ignored:'pass',live_factory_message:'pass'}));
