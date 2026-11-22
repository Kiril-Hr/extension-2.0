const { sourceRoot } = require('./source-package.cjs')
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{readProjectManifest:read}=require(path.join(sourceRoot,'lib-bild/config/webpackCompileUtils/factoryManifest'));
const folder=fs.mkdtempSync(path.join(root,'.verification/factory-manifest-'));
const results=[];
function scenario(name,files,check){
 const dir=path.join(folder,String(results.length));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
 for(const [file,content]of Object.entries(files)){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof content==='string'?content:JSON.stringify(content));}
 try{check(dir);results.push({name,status:'PASS'})}catch(error){results.push({name,status:'FAIL',detail:error.stack})}
}
const m={name:'Author manifest',version:'1.0.0',description:'Test',permissions:['storage'],host_permissions:['https://example.com/*'],action:{default_title:'Test'}};
const invoke=value=>`import {createExtensionFactory} from 'devxtension';createExtensionFactory(modules)({params:{manifest:${value},widgets:[Widget]},customManifestModules:[ManifestModule]});`;
try{
 scenario('inline author manifest without legacy JSON',{'src/runner.ts':invoke(JSON.stringify(m))},dir=>assert.deepEqual(read(dir).manifest,m));
 scenario('global participant presence is captured without executing classes',{'src/runner.ts':invoke(JSON.stringify(m))},dir=>assert.equal(read(dir).hasGlobalParticipants,true));
 scenario('omitted participants do not imply a global scope',{'src/runner.ts':`createExtensionFactory([])({params:{manifest:${JSON.stringify(m)},widgets:undefined},customManifestModules:[]});`},dir=>assert.equal(read(dir).hasGlobalParticipants,false));
 scenario('configuration spreads do not execute widget constructors',{'src/runner.ts':`const base={manifest:${JSON.stringify(m)},widgets:[Widget]};createExtensionFactory(modules)({params:{...base},customManifestModules:[MM]});`},dir=>assert.deepEqual(read(dir).manifest,m));
 scenario('local constants and aliased factory',{'src/runner.ts':`import {createExtensionFactory as create} from 'devxtension';const metadata=${JSON.stringify(m)};const config={params:{manifest:metadata,widgets:[Widget]},customManifestModules:[MM]};const configure=create(modules);configure(config);`},dir=>assert.deepEqual(read(dir).manifest,m));
 scenario('imported JSON and properties',{'src/runner.ts':`import data from './manifest.json';${invoke('{...data,action:{default_title:data.action.default_title}}')}`,'src/manifest.json':m},dir=>{assert.deepEqual(read(dir).manifest,m);assert(read(dir).dependencies.includes(path.join(dir,'src/manifest.json')))});
 scenario('imported TypeScript constant',{'src/runner.ts':`import {manifest} from './metadata';${invoke('manifest')}`,'src/metadata.ts':`export const manifest=${JSON.stringify(m)} as const;`},dir=>assert.deepEqual(read(dir).manifest,m));
 scenario('legacy Core entrypoint remains supported',{'src/runner.ts':'new ExtensionCoreModule(config).setup();','extensionConfig.json':m},dir=>assert.deepEqual(read(dir).manifest,m));
 scenario('conflicting legacy value fails explicitly',{'src/runner.ts':invoke(JSON.stringify(m)),'extensionConfig.json':{...m,name:'Conflicting'}},dir=>assert.throws(()=>read(dir),/Conflict for name/));
 scenario('legacy-only fields are preserved with diagnostics',{'src/runner.ts':invoke(JSON.stringify(m)),'extensionConfig.json':{...m,manifest_version:3,short_name:'Legacy'}},dir=>assert.equal(read(dir).manifest.short_name,'Legacy'));
 scenario('executable manifest never runs',{'src/runner.ts':invoke('getManifestFromNetwork()')},dir=>assert.throws(()=>read(dir),/static data/));
 scenario('different factory manifests fail',{'src/runner.ts':invoke(JSON.stringify(m))+invoke(JSON.stringify({...m,name:'Other'}))},dir=>assert.throws(()=>read(dir),/different extension manifests/));
 scenario('missing source and legacy manifest fails',{'src/runner.ts':'console.log("empty")'},dir=>assert.throws(()=>read(dir),/No params.manifest/));
 scenario('invalid source cannot be hidden by legacy JSON',{'src/runner.ts':invoke('"invalid"'),'extensionConfig.json':m},dir=>assert.throws(()=>read(dir),/must be an object/));
 scenario('MV2 cannot silently become MV3',{'src/runner.ts':invoke(JSON.stringify({...m,manifest_version:2}))},dir=>assert.throws(()=>read(dir),/Only Manifest V3/));
}finally{if(!path.resolve(folder).startsWith(path.resolve(root,'.verification')+path.sep))throw Error('Unsafe fixture cleanup');fs.rmSync(folder,{recursive:true,force:true})}
const out=path.join(root,'reports/factory-api-audit-2026-10-30');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
