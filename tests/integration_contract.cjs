const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../devxtension/src/core');
const loader=`const fs=require('fs'),ts=require(${JSON.stringify(require.resolve('../devxtension/node_modules/typescript'))});require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);const root=${JSON.stringify(root)};const {ServiceDecorator}=require(root+'/decorators/ServiceDecorator.ts'),{ModuleDecorator}=require(root+'/decorators/ModuleDecorator.ts'),{ExtensionCoreModule}=require(root+'/coreModule/ExtensionCoreModule.ts');`;
const cases={
'vanilla and reactive combined rejected':`require('assert').throws(()=>{class S{run(){}}ServiceDecorator(S);const M=ModuleDecorator({url:'https://x',vanilla:{mainService:S},reactiveScripts:{type:'react',components:[]}})(class M{});new M().setup();}, /either vanilla or reactiveScripts/);`,
'vanilla and reactive separate modules':`class S{run(){globalThis.runs=(globalThis.runs||0)+1}}ServiceDecorator(S);const V=ModuleDecorator({url:'https://x',vanilla:{mainService:S}})(class V{});const R=ModuleDecorator({url:'https://x',reactiveScripts:{type:'react',components:[]}})(class R{});const core=new ExtensionCoreModule({functionalities:[V,R]});core.setup();if(globalThis.runs!==1)throw Error('vanilla did not run');`,
'core teardown invoked on reSetup':`let calls=0;class M{setup(){} teardown(){calls++}}const core=new ExtensionCoreModule({functionalities:[M]});core.setup();core.reSetup({functionalities:[M]});if(calls!==1)throw Error('teardown not called once');`
};
let results=[];for(const [name,code] of Object.entries(cases)){const p=cp.spawnSync(process.execPath,['-e',loader+'try{'+code+'console.log("PASS")}catch(e){console.error(e.stack);process.exit(1)}'],{encoding:'utf8'});results.push({name,passed:p.status===0,detail:p.status===0?'':p.stderr.slice(0,1100)});}fs.writeFileSync(path.resolve(__dirname,'integration_contract_results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));

if(results.some(r=>!r.passed))process.exitCode=1;
