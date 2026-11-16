import {dependencyContainer,extensionConfigType,ManifestParams} from 'devxtension';import {State} from './state';
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
