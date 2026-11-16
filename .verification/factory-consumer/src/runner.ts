import {createExtensionFactory,dependencyContainer} from 'devxtension';import {modules} from './modules/author';import {SharedWidget,ManifestModule} from './widgets';import {State} from './state';
const start=()=>createExtensionFactory(modules)({
 params:{manifest:{name:'DevEx author factory',version:'1.0.0',description:'Full public factory integration',permissions:['storage'],host_permissions:['http://127.0.0.2/*'],action:{default_title:'Factory integration'}},widgets:[SharedWidget,SharedWidget]},
 customManifestModules:[ManifestModule,ManifestModule]
});
let controller=start();
document.addEventListener('factory-reset',()=>controller.reSetup());
document.addEventListener('factory-stop',()=>controller.teardown());
document.addEventListener('factory-restart',()=>{controller.teardown();controller=start()});
chrome.runtime.sendMessage({kind:'factory-probe'},response=>{if(chrome.runtime.lastError)throw Error(chrome.runtime.lastError.message);const s=dependencyContainer.getService<typeof State>(State.name);s.stats.background=response.name;s.publish()});
