import {ServiceDecorator} from 'devxtension';
@ServiceDecorator
export class State {
 stats={routeSetups:0,routeStops:0,widgetSetups:0,widgetResets:0,widgetStops:0,widgetPings:0,localSetups:0,localStops:0,manifestSetups:0,manifestResets:0,manifestStops:0,manifestPings:0,reactMounts:0,reactStops:0,servicePings:0,background:'',manifestName:'',lastCount:-1};
 publish(){document.documentElement.dataset.factoryState=JSON.stringify(this.stats)}
 private ping=()=>{this.stats.servicePings++;this.publish()};
 run(){this.stats.routeSetups++;const node=document.createElement('div');node.id='factory-vanilla';node.textContent='Vanilla through factory';document.body.append(node);window.addEventListener('factory-service-ping',this.ping);this.publish()}
 stop(){window.removeEventListener('factory-service-ping',this.ping);document.querySelector('#factory-vanilla')?.remove();this.stats.routeStops++;this.publish()}
}
