const { sourceRoot } = require('./source-package.cjs')
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require(require.resolve(require('path').join(sourceRoot, 'node_modules/typescript')));
const path = require('node:path');
const source = fs.readFileSync(path.join(sourceRoot, 'src/core/reactiveComponents/components/ReactComponent.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const events = [];
const body = { appendChild(el) { events.push(['append', el]); } };
const document = { body, createElement(tag) { return { tag }; } };
const requireMock = name => {
  if (name === 'react') return { createElement: component => ({ component }) };
  if (name === 'react-dom/client') return { createRoot: el => ({ render: node => events.push(['render', el, node]) }) };
  throw Error('unexpected import: ' + name);
};
const testModule = { exports: {} };
vm.runInNewContext(code, { require: requireMock, module: testModule, exports: testModule.exports, document });
const A = () => null, B = () => null;
testModule.exports.implementReactComponents([A, B]);
assert.equal(events.length, 4);
assert.equal(events[0][0], 'append');
assert.equal(events[1][0], 'render');
assert.equal(events[1][2].component, A);
assert.equal(events[2][0], 'append');
assert.equal(events[3][0], 'render');
assert.equal(events[3][2].component, B);
assert.notEqual(events[1][1], events[3][1]);
console.log('PASS DEVEX-008 React mounting contract mock (2 components)');
