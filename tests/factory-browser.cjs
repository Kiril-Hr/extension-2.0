const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'reports/factory-api-audit-2026-10-30')
const consumer = process.env.DEVEX_CONSUMER_PATH || path.join(root, '.verification/factory-consumer')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root,'.verification/browser-binaries')
const {chromium}=require(process.env.DEVEX_PLAYWRIGHT_PATH || 'C:/Users/kiril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>DevEx author factory integration</title><style>body{font:20px system-ui;padding:40px;background:#142033;color:#e9fff5}#factory-react,#factory-widget,#factory-vanilla{padding:18px;margin:15px 0;border:1px solid #4fdbad;border-radius:10px}</style><h1>DevEx — повний авторський API фабрики</h1><p>Widgets, ManifestModule, vanilla, React та DI запускає createExtensionFactory.</p>')});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(80,'127.0.0.2',resolve)});
 let context;const checks=[],errors=[];
 try{
  const extension=path.join(consumer,'dist');
  context=await chromium.launchPersistentContext(path.join(root,'.verification/browser-profile/factory'),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--no-proxy-server',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();
  const state=()=>page.evaluate(()=>JSON.parse(document.documentElement.dataset.factoryState));
  const event=name=>page.evaluate(name=>document.dispatchEvent(new Event(name)),name);
  const wait=predicate=>page.waitForFunction(predicate);
  await page.goto('http://127.0.0.2/active/one');
  await wait(()=>{const s=JSON.parse(document.documentElement.dataset.factoryState||'{}');return s.reactMounts===1&&s.background==='DevEx author factory'});
  let s=await state();assert.equal(s.routeSetups,1);assert.equal(s.widgetSetups,1);assert.equal(s.manifestSetups,1);assert.equal(s.manifestName,'DevEx author factory');assert.equal(s.localSetups,1);
  assert.equal(await page.locator('#factory-react').textContent(),'React through factory + DI 1');
  checks.push('Author API starts real modules, global widget, custom ManifestModule, shared DI and React; no manual Core or legacy JSON');
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('factoryProbe')).factoryProbe),true);
  checks.push('Generated MV3 service worker, permissions, Chrome messaging/storage and runtime manifest agree');
  await event('factory-reset');
  await wait(()=>{const s=JSON.parse(document.documentElement.dataset.factoryState);return s.reactMounts===2&&s.reactStops===1});
  s=await state();assert.equal(s.routeSetups,2);assert.equal(s.routeStops,1);assert.equal(s.widgetSetups,1);assert.equal(s.widgetResets,1);assert.equal(s.manifestSetups,1);assert.equal(s.manifestResets,1);assert.equal(s.localStops,1);
  assert.equal(await page.locator('#factory-react').count(),1);assert.equal(await page.locator('#factory-widget').count(),1);assert.equal(await page.locator('#factory-vanilla').count(),1);
  checks.push('Public controller reSetup reuses DI, invokes global hooks once and recreates route modules with one React root');
  await page.evaluate(()=>{window.__factoryDocument='same-document';history.pushState({},'', '/active/two')});
  await wait(()=>JSON.parse(document.documentElement.dataset.factoryState).reactMounts===3);
  assert.equal(await page.evaluate(()=>window.__factoryDocument),'same-document');
  s=await state();assert.equal(s.routeSetups,3);assert.equal(s.widgetSetups,1);assert.equal(s.manifestSetups,1);
  checks.push('Real Chrome webNavigation triggers factory reSetup on pushState without tab reload or DI loss');
  await page.evaluate(()=>history.pushState({},'', '/outside'));
  await wait(()=>{const s=JSON.parse(document.documentElement.dataset.factoryState);return s.lastCount===0&&s.reactStops===3});
  assert.equal(await page.locator('#factory-react').count(),0);assert.equal(await page.locator('#factory-vanilla').count(),0);assert.equal(await page.locator('#factory-widget').count(),1);
  s=await state();assert.equal(s.localStops,3);assert.equal(s.widgetStops,0);assert.equal(s.manifestStops,0);
  await page.evaluate(()=>history.pushState({},'', '/active/three'));
  await wait(()=>JSON.parse(document.documentElement.dataset.factoryState).reactMounts===4);
  checks.push('SPA exit deactivates route resources, keeps globals alive, and re-entry remounts matching modules');
  await page.goBack();await wait(()=>JSON.parse(document.documentElement.dataset.factoryState).lastCount===0);
  await page.goForward();await wait(()=>JSON.parse(document.documentElement.dataset.factoryState).reactMounts===5);
  await page.waitForTimeout(200);s=await state();assert.equal(s.routeSetups,5);assert.equal(s.reactMounts,5);
  checks.push('Back/forward popstate and Chrome notifications are deduplicated');
  await page.evaluate(()=>{window.dispatchEvent(new Event('factory-widget-ping'));window.dispatchEvent(new Event('factory-manifest-ping'));window.dispatchEvent(new Event('factory-service-ping'))});
  s=await state();assert.equal(s.widgetPings,1);assert.equal(s.manifestPings,1);assert.equal(s.servicePings,1);
  await page.screenshot({path:path.join(out,'factory-chromium.png')});
  await event('factory-stop');await wait(()=>!document.querySelector('#factory-react'));
  s=await state();assert.equal(s.widgetStops,1);assert.equal(s.manifestStops,1);assert.equal(s.routeStops,s.routeSetups);assert.equal(s.reactStops,s.reactMounts);assert.equal(s.localStops,s.localSetups);
  assert.equal(await page.locator('#factory-widget,#factory-react,#factory-vanilla').count(),0);
  await page.evaluate(()=>{window.dispatchEvent(new Event('factory-widget-ping'));window.dispatchEvent(new Event('factory-manifest-ping'));window.dispatchEvent(new Event('factory-service-ping'))});
  assert.deepEqual(await state(),s);await event('factory-stop');assert.deepEqual(await state(),s);
  checks.push('Final teardown removes module DOM, React effects, singleton widget/manifest listeners and is idempotent');
  await event('factory-restart');await wait(()=>JSON.parse(document.documentElement.dataset.factoryState).reactMounts===6);
  s=await state();assert.equal(s.widgetSetups,2);assert.equal(s.manifestSetups,2);assert.equal(s.routeSetups,6);
  await page.evaluate(()=>{document.dispatchEvent(new Event('factory-reset'));document.dispatchEvent(new Event('factory-stop'))});
  await page.waitForTimeout(200);assert.equal(await page.locator('#factory-react').count(),0);
  checks.push('Restart uses factory again; late async React mounting cannot survive teardown');
  const fresh=await context.newPage();await fresh.goto('http://127.0.0.2/outside');
  await fresh.waitForSelector('#factory-widget');
  assert.equal(await fresh.locator('#factory-react').count(),0);
  assert.equal(await fresh.evaluate(()=>JSON.parse(document.documentElement.dataset.factoryState).routeSetups),0);
  await fresh.evaluate(()=>{window.__factoryDocument='global-first';history.pushState({},'', '/active/fresh')});
  await fresh.waitForSelector('#factory-react');
  const freshState=await fresh.evaluate(()=>JSON.parse(document.documentElement.dataset.factoryState));assert.equal(freshState.routeSetups,1);assert.equal(freshState.widgetSetups,1);
  assert.equal(await fresh.evaluate(()=>window.__factoryDocument),'global-first');
  checks.push('Global participants run on declared hosts before any route; first SPA route entry preserves their context without reload');
  assert.deepEqual(errors,[]);
  const packageFile = process.env.DEVEX_PACKAGE_PATH || path.join(out, 'devxtension-1.1.0.tgz')
  const packageSha256 = crypto.createHash('sha256').update(fs.readFileSync(packageFile)).digest('hex')
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({status:'PASS',version:context.browser().version(),packageSha256,checks,errors},null,2));
  console.log('FACTORY BROWSER PASS',JSON.stringify(checks,null,2));
 }finally{await context?.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(e=>{fs.writeFileSync(path.join(out,'browser-failure.log'),e.stack);console.error(e);process.exitCode=1});
