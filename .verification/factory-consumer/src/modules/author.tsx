import React,{useEffect} from 'react';import {ModuleDecorator,dependencyContainer} from 'devxtension';import {State} from '../state';import {SharedWidget,LocalWidget} from '../widgets';
const service=()=>dependencyContainer.getService<typeof State>(State.name);
@ModuleDecorator({url:'http://127.0.0.2/active/*',widgets:[SharedWidget,LocalWidget],vanilla:{mainService:State}})
export class Vanilla {teardown(){service().stop()}}
function View(){const s=service();useEffect(()=>{s.stats.reactMounts++;s.publish();return()=>{s.stats.reactStops++;s.publish()}},[]);return <div id="factory-react">React through factory + DI {s.stats.routeSetups}</div>}
@ModuleDecorator({url:'http://127.0.0.2/active/*',reactiveScripts:{type:'react',components:[View]}})
export class Reactive {}
export const modules=[Vanilla,Reactive];
