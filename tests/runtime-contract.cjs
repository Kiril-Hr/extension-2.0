const { sourceRoot } = require('./source-package.cjs')
const assert=require('assert/strict');
const {ServiceDecorator,ModuleDecorator,ExtensionCoreModule,dependencyContainer,createExtensionFactory,Feature,DisableFeatures}=require(require('path').join(sourceRoot,'dist'));
let calls=[];
class Main {run(){calls.push('main')}}
class Executor {executor(){calls.push('executor')}}
class Widget {constructor(){this.count=0}setup(){this.count++;calls.push('widget:'+this.count)}}
ServiceDecorator(Main);ServiceDecorator(Executor);
const Vanilla=ModuleDecorator({url:'https://example.com/*',widgets:[Widget],vanilla:{mainService:Main,executors:Executor}})(class Vanilla{});
const core=new ExtensionCoreModule({functionalities:[Vanilla]});core.setup();core.reSetup({functionalities:[Vanilla]});
assert.deepEqual(calls,['main','widget:1','executor','main','widget:2','executor']);
assert.equal(dependencyContainer.getService('Widget').count,2);
// End the vanilla ownership before checking an independent reactive module.
// Concurrent owners now intentionally share one initialization.
core.reSetup({functionalities:[]});
const Reactive=ModuleDecorator({url:'https://example.com/*',widgets:[Widget],reactiveScripts:{type:'react',components:[]}})(class Reactive{});
const reactive=new Reactive();reactive.setup();reactive.teardown();
assert.equal(dependencyContainer.getService('Widget').count,3);
assert.throws(()=>ModuleDecorator({url:'https://x/*',vanilla:{mainService:Main},reactiveScripts:{type:'react',components:[]}})(class Invalid{}),/either vanilla or reactiveScripts/);
global.window={location:{href:'https://example.com/test'}};
createExtensionFactory([Vanilla])({params:{manifest:{name:'Test',version:'1.0.0',description:'Test',action:{default_title:'Test'},host_permissions:[]}}});
class Features {one(){return 'one'}two(){return 'two'}}
Feature('one')(Features.prototype,'one',Object.getOwnPropertyDescriptor(Features.prototype,'one'));
const f=new Features();
assert.equal(DisableFeatures({method:f.two,features:{one:true},link:f})(), 'two');
assert.equal(f.one(),undefined);
const instance={count:0,run(){this.count++}};
const Direct=ModuleDecorator({url:'https://example.com/*',vanilla:{mainService:instance}})(class Direct{});
new Direct().setup();assert.equal(instance.count,1);
console.log('PASS compiled package: factory defaults, executor class, widget instance binding, reactive widgets, exclusive module contract, feature decorators');
