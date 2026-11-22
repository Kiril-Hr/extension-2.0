const { sourceRoot } = require('./source-package.cjs')
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),lib=sourceRoot,consumer=path.join(root,'.verification/factory-consumer'),out=path.join(root,'reports/factory-api-audit-2026-10-30');
fs.mkdirSync(out,{recursive:true});const results=[];
const pkg = require(path.join(lib, 'package.json'))
const archive = path.join(out, pkg.name + '-' + pkg.version + '.tgz')
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
function run(name,args,cwd=lib){console.log('RUN',name);const r=cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:300000,maxBuffer:20000000});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));results.push({name,exitCode:r.status,status:r.status===0?'PASS':'FAIL'});fs.writeFileSync(path.join(out,'pipeline-results.json'),JSON.stringify(results,null,2));assert.equal(r.status,0,(r.stdout||'')+(r.stderr||''));console.log('PASS',name);}
function write(file,content){const target=path.join(consumer,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
run('clean-build',[npm,'run','build']);
run('noemit',[path.join(lib,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json','--noEmit','--pretty','false']);
for(const name of ['regression','lifecycle_cleanup','service_collisions','url_routing','react_mounting','react_cleanup','integration_contract','runtime-contract','manifest-conversion','factory-lifecycle','factory-manifest'])run(name,[path.join(root,'tests',name+'.cjs')],root);
run('npm-pack',[npm,'pack','--pack-destination',out]);
if(!fs.existsSync(path.join(consumer,'package.json'))){
write('package.json',JSON.stringify({name:'devex-author-factory-consumer',version:'1.0.0',private:true,scripts:{build:'devex-scripts build',dev:'devex-scripts dev'},dependencies:{devxtension:'file:'+archive.replaceAll('\\','/')}},null,2));
write('.env','');
write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2020',module:'commonjs',jsx:'react',esModuleInterop:true,experimentalDecorators:true,resolveJsonModule:true,types:['chrome','react'],strict:true},include:['src/**/*']},null,2));
write('src/state.ts',`import {ServiceDecorator} from 'devxtension';
@ServiceDecorator
export class State {
 stats={routeSetups:0,routeStops:0,widgetSetups:0,widgetResets:0,widgetStops:0,widgetPings:0,localSetups:0,localStops:0,manifestSetups:0,manifestResets:0,manifestStops:0,manifestPings:0,reactMounts:0,reactStops:0,servicePings:0,background:'',manifestName:'',lastCount:-1};
 publish(){document.documentElement.dataset.factoryState=JSON.stringify(this.stats)}
 private ping=()=>{this.stats.servicePings++;this.publish()};
 run(){this.stats.routeSetups++;const node=document.createElement('div');node.id='factory-vanilla';node.textContent='Vanilla through factory';document.body.append(node);window.addEventListener('factory-service-ping',this.ping);this.publish()}
 stop(){window.removeEventListener('factory-service-ping',this.ping);document.querySelector('#factory-vanilla')?.remove();this.stats.routeStops++;this.publish()}
}
`);
write('src/widgets.ts',`import {dependencyContainer,extensionConfigType,ManifestParams} from 'devxtension';import {State} from './state';
const state=()=>dependencyContainer.getService<typeof State>(State.name);
export class SharedWidget {
 private ping=()=>{state().stats.widgetPings++;state().publish()};
 setup(){state().stats.widgetSetups++;const node=document.createElement('div');node.id='factory-widget';node.textContent='Global widget';document.body.append(node);window.addEventListener('factory-widget-ping',this.ping);state().publish()}
 reSetup(config:extensionConfigType){state().stats.widgetResets++;state().stats.lastCount=config.functionalities.length;state().publish()}
 teardown(){window.removeEventListener('factory-widget-ping',this.ping);document.querySelector('#factory-widget')?.remove();state().stats.widgetStops++;state().publish()}
}
export class LocalWidget {setup(){state().stats.localSetups++;state().publish()}teardown(){state().stats.localStops++;state().publish()}}
export class ManifestModule {
 private ping=()=>{state().stats.manifestPings++;state().publish()};
 setup(manifest?:ManifestParams){if(!manifest?.permissions?.includes('storage'))throw Error('Manifest permissions missing');state().stats.manifestSetups++;state().stats.manifestName=manifest.name;window.addEventListener('factory-manifest-ping',this.ping);state().publish()}
 reSetup(){state().stats.manifestResets++;state().publish()}
 teardown(){window.removeEventListener('factory-manifest-ping',this.ping);state().stats.manifestStops++;state().publish()}
}
`);
write('src/modules/author.tsx',`import React,{useEffect} from 'react';import {ModuleDecorator,dependencyContainer} from 'devxtension';import {State} from '../state';import {SharedWidget,LocalWidget} from '../widgets';
const service=()=>dependencyContainer.getService<typeof State>(State.name);
@ModuleDecorator({url:'http://127.0.0.2/active/*',widgets:[SharedWidget,LocalWidget],vanilla:{mainService:State}})
export class Vanilla {teardown(){service().stop()}}
function View(){const s=service();useEffect(()=>{s.stats.reactMounts++;s.publish();return()=>{s.stats.reactStops++;s.publish()}},[]);return <div id="factory-react">React through factory + DI {s.stats.routeSetups}</div>}
@ModuleDecorator({url:'http://127.0.0.2/active/*',reactiveScripts:{type:'react',components:[View]}})
export class Reactive {}
export const modules=[Vanilla,Reactive];
`);
write('src/runner.ts',`import {createExtensionFactory,dependencyContainer} from 'devxtension';import {modules} from './modules/author';import {SharedWidget,ManifestModule} from './widgets';import {State} from './state';
const start=()=>createExtensionFactory(modules)({
 params:{manifest:{name:'DevEx author factory',version:'1.0.0',description:'Full public factory integration',permissions:['storage'],host_permissions:['http://127.0.0.2/*'],action:{default_title:'Factory integration'}},widgets:[SharedWidget,SharedWidget]},
 customManifestModules:[ManifestModule,ManifestModule]
});
let controller=start();
document.addEventListener('factory-reset',()=>controller.reSetup());
document.addEventListener('factory-stop',()=>controller.teardown());
document.addEventListener('factory-restart',()=>{controller.teardown();controller=start()});
chrome.runtime.sendMessage({kind:'factory-probe'},response=>{if(chrome.runtime.lastError)throw Error(chrome.runtime.lastError.message);const s=dependencyContainer.getService<typeof State>(State.name);s.stats.background=response.name;s.publish()});
`);
write('src/extensionOptions/backgrounds/probe.js',`chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(message.kind==='factory-probe'){chrome.storage.local.set({factoryProbe:true});respond({name:chrome.runtime.getManifest().name})}});`);
}
// Refresh installation even though this development tarball retains its version.
const modulesPath=path.resolve(consumer,'node_modules');assert(modulesPath.startsWith(consumer+path.sep));fs.rmSync(modulesPath,{recursive:true,force:true});fs.rmSync(path.join(consumer,'package-lock.json'),{force:true});
run('consumer-install',[npm,'install','--no-audit','--no-fund'],consumer);
function compare(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(relative, entry.name)
    const file = path.join(dir, entry.name)
    const installed = path.join(consumer, 'node_modules/devxtension/dist', name)
    const excluded = name === 'test' || name.replaceAll('\\', '/') === 'config/webpackCompileUtils/integration-test.cjs'

    if (excluded) {
      assert(!fs.existsSync(installed), 'Internal test files must not be published: ' + name)
      continue
    }

    if (entry.isDirectory()) {
      compare(file, name)
      continue
    }

    assert(fs.readFileSync(file).equals(fs.readFileSync(installed)), 'Stale installed output: ' + name)
  }
}
compare(path.join(lib,'dist'));
assert(!fs.existsSync(path.join(consumer,'extensionConfig.json')),'Factory consumer must prove params.manifest alone');
assert(!fs.readFileSync(path.join(consumer,'src/runner.ts'),'utf8').includes('ExtensionCoreModule'),'Factory consumer cannot create a manual Core');
run('consumer-types',[path.join(consumer,'node_modules/typescript/bin/tsc'),'--noEmit'],consumer);
run('consumer-api-types',[path.join(root,'tests/factory-types.cjs')],consumer);
run('consumer-build',[npm,'run','build'],consumer);
const manifest=JSON.parse(fs.readFileSync(path.join(consumer,'dist/manifest.json'),'utf8'));
assert.equal(manifest.name,'DevEx author factory');assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.host_permissions,['http://127.0.0.2/*']);assert(manifest.permissions.includes('storage'));assert(manifest.permissions.includes('webNavigation'));assert.equal(manifest.background.service_worker,'background.js');
const packageSha256=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');fs.writeFileSync(path.join(out,'package-hash.json'),JSON.stringify({packageSha256},null,2));
console.log('FACTORY PRODUCT PIPELINE PASS',packageSha256);
