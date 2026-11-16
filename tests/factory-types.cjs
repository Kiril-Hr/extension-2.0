const path=require('path'),fs=require('fs'),assert=require('assert/strict');
const consumer=process.cwd(),ts=require(path.join(consumer,'node_modules/typescript'));
const parsed=ts.getParsedCommandLineOfConfigFile(path.join(consumer,'tsconfig.json'),{noEmit:true,incremental:false},{...ts.sys,onUnRecoverableConfigFileDiagnostic:d=>{throw Error(ts.flattenDiagnosticMessageText(d.messageText,' '))}});
const virtual=path.join(consumer,'src/__factory_type_contract__.ts');
const text=`import {createExtensionFactory,Module,IManifestModule,ManifestParams,ExtensionLifecycle} from 'devxtension';
class W implements Module {setup(){} teardown(){}}
class MM implements IManifestModule {setup(manifest?:ManifestParams){} teardown(){}}
const manifest:ManifestParams={name:'Types',version:'1.0.0',description:'Types',permissions:['storage'],host_permissions:['https://example.com/*'],action:{default_title:'Types'}};
const options={params:{manifest,widgets:[W]},customManifestModules:[MM]};
const factory=createExtensionFactory([]);
const legacyCallback:(value:typeof options)=>void=factory;
legacyCallback(options);
const controller:ExtensionLifecycle=factory(options);controller.reSetup();controller.teardown();
factory({params:{manifest}});
class MissingSetup {}
// @ts-expect-error a global widget must actually implement setup
factory({params:{manifest,widgets:[MissingSetup]}});
`;
const host=ts.createCompilerHost(parsed.options),get=host.getSourceFile.bind(host);
host.getSourceFile=(file,language,...rest)=>path.resolve(file)===virtual?ts.createSourceFile(file,text,language,true):get(file,language,...rest);
const program=ts.createProgram([...parsed.fileNames,virtual],parsed.options,host),diagnostics=ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
console.log('PASS installed public types: original call, optional arguments, ignored return compatibility, lifecycle controller and invalid widget rejection; virtual file only');
