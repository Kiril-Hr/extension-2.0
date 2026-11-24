const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),consumer=path.join(root,'.verification/factory-consumer'),out=path.join(root,'reports/factory-api-audit-2026-10-30');
const runner=path.join(consumer,'src/runner.ts'),original=fs.readFileSync(runner,'utf8'),manifest=path.join(consumer,'dist/manifest.json');
const cli=path.join(consumer,'node_modules/devxtension/dist/devex-scripts/index.js'),npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(test){const end=Date.now()+60000;while(Date.now()<end){if(test())return;await pause(200)}throw Error('Factory watch timed out')}
async function main(){
  let output = ''
  const child = cp.spawn(process.execPath, [cli, 'dev', ...(process.env.DEVEX_SOURCE_ROOT ? ['--watch-only'] : [])], {
    cwd: consumer,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const appendOutput = chunk => {
    output += chunk.toString().replace(/\u001b\[[0-9;]*m/g, '')
  }

  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)
  try {
    await until(() => output.includes('compiled successfully'))
    fs.writeFileSync(runner, original.replace("version:'1.0.0'", "version:'1.0.1'"))

    let lastReadError
    try {
      await until(() => {
        try {
          const current = JSON.parse(fs.readFileSync(manifest, 'utf8'))
          lastReadError = undefined
          return current.version === '1.0.1'
        } catch (error) {
          // The watcher can truncate the file before writing the new JSON.
          if (!(error instanceof SyntaxError)) throw error
          lastReadError = error
          return false
        }
      })
    } catch (error) {
      if (lastReadError) throw new Error('Watch manifest did not settle as valid JSON', { cause: lastReadError })
      throw error
    }
    console.log('PASS watch regenerates inline params.manifest without extensionConfig.json')
  }
 finally{child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(5000)]);fs.writeFileSync(runner,original);fs.writeFileSync(path.join(out,'watch.log'),output)}
 const legacy=path.join(consumer,'extensionConfig.json');assert(!fs.existsSync(legacy));
 try{fs.writeFileSync(legacy,JSON.stringify({name:'Conflict'}));const r=cp.spawnSync(process.execPath,[npm,'run','build'],{cwd:consumer,encoding:'utf8',timeout:120000});fs.writeFileSync(path.join(out,'manifest-conflict.log'),r.stdout+r.stderr);assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/Conflict for name/);console.log('PASS CLI fails explicitly on conflicting legacy Manifest')}
 finally{fs.rmSync(legacy,{force:true})}
 const r=cp.spawnSync(process.execPath,[npm,'run','build'],{cwd:consumer,encoding:'utf8',timeout:300000,maxBuffer:20000000});fs.writeFileSync(path.join(out,'consumer-final-build.log'),r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);console.log('PASS restored source production build');
 const backgroundTest = process.env.DEVEX_SOURCE_ROOT === undefined
   ? [path.join(root,'devxtension/lib-bild/config/webpackCompileUtils/integration-test.cjs')]
   : [path.join(__dirname,'runtime-background.cjs'), path.join(root,'examples/minimal/dist')]
 const vm=cp.spawnSync(process.execPath,backgroundTest,{cwd:root,encoding:'utf8'});fs.writeFileSync(path.join(out,'background-vm.log'),vm.stdout+vm.stderr);assert.equal(vm.status,0,vm.stdout+vm.stderr);
 fs.writeFileSync(path.join(out,'watch-results.json'),JSON.stringify({status:'PASS',inlineManifestWatch:true,conflictExitCodeNonzero:true,restoredProductionBuild:true,backgroundVM:true},null,2));console.log('PASS background VM regression');
}
main().catch(e=>{console.error(e);process.exitCode=1});
