const { sourceRoot } = require('./source-package.cjs')
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(sourceRoot,'src/core');
const loader=`const fs=require('fs'),ts=require(${JSON.stringify(require.resolve(require('path').join(sourceRoot, 'node_modules/typescript')))});require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);const {dependencyContainer:di}=require(${JSON.stringify(root)}+'/dependencyContainer/dependencyContainer.ts');const {ServiceDecorator}=require(${JSON.stringify(root)}+'/decorators/ServiceDecorator.ts');`;
const cases={
 'same class registered twice':`class S{};ServiceDecorator(S);di.registerService('S',S);if(di.getService('S').constructor!==S)throw Error('instance mismatch')`,
 'different classes with same name rejected':`const A=class Same{};const B=class Same{};ServiceDecorator(A);let caught=false;try{ServiceDecorator(B)}catch(e){caught=e.message.includes('Service registration conflict')}if(!caught)throw Error('collision not detected')`,
 'original instance preserved on conflict':`const A=class Same{};const B=class Same{};ServiceDecorator(A);const original=di.getService('Same');try{ServiceDecorator(B)}catch(e){}if(di.getService('Same')!==original)throw Error('instance overwritten')`,
 'different service names remain isolated':`class A{};class B{};ServiceDecorator(A);ServiceDecorator(B);if(di.getService('A')===di.getService('B'))throw Error('not isolated')`
};
const results=Object.entries(cases).map(([name,code])=>{const p=cp.spawnSync(process.execPath,['-e',loader+'try{'+code+';console.log("PASS")}catch(e){console.error(e.stack);process.exit(1)}'],{encoding:'utf8'});return {name,passed:p.status===0,detail:(p.stderr||'').trim().slice(-1200)}});console.log(JSON.stringify(results,null,2));fs.writeFileSync(path.resolve(__dirname,'service_collisions_results.json'),JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
