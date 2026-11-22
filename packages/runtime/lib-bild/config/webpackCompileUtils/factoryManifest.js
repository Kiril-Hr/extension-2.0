const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Read configuration data without executing runner.ts, decorators or DOM code.
function readProjectManifest(appRoot) {
    const dependencies = new Set();
    const contexts = new Map();
    const fail = message => { throw new Error('[DevEx manifest] ' + message); };
    const unwrap = node => {
        while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
            ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
        return node;
    };
    function context(file) {
        file = path.resolve(file);
        if (contexts.has(file)) return contexts.get(file);
        dependencies.add(file);
        if (file.endsWith('.json')) {
            const ctx = {file, json: JSON.parse(fs.readFileSync(file, 'utf8'))};
            contexts.set(file, ctx); return ctx;
        }
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const ctx = {file, source, bindings:new Map(), imports:new Map(), factoryNames:new Set(['createExtensionFactory']), configureNames:new Set()};
        contexts.set(file, ctx);
        for (const statement of source.statements) {
            if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
                for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) ctx.bindings.set(d.name.text, d.initializer);
            }
            if (ts.isExportAssignment(statement)) ctx.bindings.set('default', statement.expression);
            if (ts.isImportDeclaration(statement) && statement.importClause) {
                const specifier = statement.moduleSpecifier.text;
                const clause = statement.importClause;
                if (clause.name) ctx.imports.set(clause.name.text, {specifier, exported:'default'});
                const named = clause.namedBindings;
                if (named && ts.isNamedImports(named)) for (const item of named.elements) {
                    const exported = (item.propertyName || item.name).text;
                    ctx.imports.set(item.name.text, {specifier, exported});
                    if (exported === 'createExtensionFactory') ctx.factoryNames.add(item.name.text);
                }
                if (named && ts.isNamespaceImport(named)) ctx.imports.set(named.name.text, {specifier, exported:'*'});
            }
        }
        for (const [name, expression] of ctx.bindings) {
            const value = unwrap(expression);
            if (ts.isCallExpression(value) && isFactory(value.expression, ctx)) ctx.configureNames.add(name);
        }
        return ctx;
    }
    function imported(ctx, binding) {
        if (!binding.specifier.startsWith('.')) fail(`Manifest data must use a local static import: ${binding.specifier} in ${ctx.file}`);
        const base = path.resolve(path.dirname(ctx.file), binding.specifier);
        const file = [base, base+'.ts', base+'.tsx', base+'.js', base+'.json', path.join(base,'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!file) fail(`Cannot resolve manifest import ${binding.specifier} in ${ctx.file}`);
        return context(file);
    }
    function resolve(node, ctx, seen = new Set()) {
        node = unwrap(node);
        if (!node) fail(`Missing static configuration in ${ctx.file}`);
        if (ts.isIdentifier(node)) {
            if (node.text === 'undefined') return {value:undefined};
            const key = ctx.file + ':' + node.text;
            if (seen.has(key)) fail(`Circular manifest constant ${node.text} in ${ctx.file}`);
            seen = new Set(seen); seen.add(key);
            if (ctx.bindings.has(node.text)) return resolve(ctx.bindings.get(node.text), ctx, seen);
            if (ctx.imports.has(node.text)) {
                const binding = ctx.imports.get(node.text), target = imported(ctx, binding);
                if ('json' in target) {
                    if (binding.exported === 'default' || binding.exported === '*') return {value:target.json};
                    if (!Object.prototype.hasOwnProperty.call(target.json, binding.exported)) fail(`Missing JSON export ${binding.exported} in ${target.file}`);
                    return {value:target.json[binding.exported]};
                }
                if (binding.exported === '*') return {namespace:target};
                if (!target.bindings.has(binding.exported)) fail(`Missing static export ${binding.exported} in ${target.file}`);
                return resolve(target.bindings.get(binding.exported), target, seen);
            }
            fail(`Cannot statically resolve ${node.text} in ${ctx.file}`);
        }
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const owner = resolve(node.expression, ctx, seen);
            const key = ts.isPropertyAccessExpression(node) ? node.name.text : evaluate(node.argumentExpression, ctx, seen);
            return property(owner, key, seen);
        }
        return {node, ctx, seen};
    }
    function property(owner, key, seen = new Set(), optional = false) {
        if ('namespace' in owner) {
            const target = owner.namespace;
            if (!target.bindings.has(key)) fail(`Missing static export ${key} in ${target.file}`);
            return resolve(target.bindings.get(key), target, seen);
        }
        if ('value' in owner) {
            if (owner.value && Object.prototype.hasOwnProperty.call(owner.value, key)) return {value:owner.value[key]};
            if (optional) return undefined;
            fail(`Missing static property ${key}`);
        }
        const {node,ctx} = owner;
        if (!ts.isObjectLiteralExpression(node)) fail(`Expected static object containing ${key} in ${ctx.file}`);
        for (const p of [...node.properties].reverse()) {
            if (ts.isSpreadAssignment(p)) {
                const found = property(resolve(p.expression,ctx,owner.seen),key,owner.seen,true);
                if (found) return found;
            } else if (p.name && propertyName(p.name, ctx) === key) {
                if (ts.isPropertyAssignment(p)) return resolve(p.initializer, ctx, owner.seen);
                if (ts.isShorthandPropertyAssignment(p)) return resolve(p.name, ctx, owner.seen);
                fail(`Manifest configuration cannot contain methods/getters in ${ctx.file}`);
            }
        }
        if (optional) return undefined;
        fail(`Missing ${key} in factory configuration in ${ctx.file}`);
    }
    function propertyName(node, ctx) {
        return ts.isComputedPropertyName(node) ? evaluate(node.expression,ctx) : node.text;
    }
    function valueOf(resolved) {
        if ('value' in resolved) return resolved.value;
        const {node,ctx,seen} = resolved;
        if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
        if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
        if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
        if (node.kind === ts.SyntaxKind.NullKeyword) return null;
        if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(item => ts.isSpreadElement(item) ? evaluate(item.expression,ctx,seen) : [evaluate(item,ctx,seen)]);
        if (ts.isObjectLiteralExpression(node)) {
            const result = {};
            for (const p of node.properties) {
                if (ts.isSpreadAssignment(p)) Object.assign(result,evaluate(p.expression,ctx,seen));
                else if (ts.isPropertyAssignment(p)) Object.defineProperty(result,propertyName(p.name,ctx),{value:evaluate(p.initializer,ctx,seen),enumerable:true,configurable:true,writable:true});
                else if (ts.isShorthandPropertyAssignment(p)) result[p.name.text]=evaluate(p.name,ctx,seen);
                else fail(`Manifest contains executable properties in ${ctx.file}`);
            }
            return result;
        }
        fail(`Manifest must be static data, not ${ts.SyntaxKind[node.kind]}, in ${ctx.file}`);
    }
    function evaluate(node,ctx,seen) { return valueOf(resolve(node,ctx,seen)); }
    function isFactory(node,ctx) {
        node=unwrap(node);
        return (ts.isIdentifier(node) && ctx.factoryNames.has(node.text)) ||
            (ts.isPropertyAccessExpression(node) && node.name.text === 'createExtensionFactory');
    }
    const runner = context(path.join(appRoot,'src/runner.ts'));
    const manifests = [];
    let hasGlobalParticipants = false;
    function hasItems(value) {
        if (!value) return false;
        if ('value' in value) return value.value != null && (!Array.isArray(value.value) || value.value.length > 0);
        return !ts.isArrayLiteralExpression(value.node) || value.node.elements.length > 0;
    }
    function visit(node) {
        if (ts.isCallExpression(node)) {
            const fn = unwrap(node.expression);
            const factoryCall = ts.isCallExpression(fn) && isFactory(fn.expression,runner);
            const configureCall = ts.isIdentifier(fn) && runner.configureNames.has(fn.text);
            if (factoryCall || configureCall) {
                const options = resolve(node.arguments[0],runner);
                const params = property(options,'params');
                manifests.push(valueOf(property(params,'manifest')));
                hasGlobalParticipants ||= hasItems(property(params,'widgets',new Set(),true)) ||
                    hasItems(property(options,'customManifestModules',new Set(),true));
            }
        }
        ts.forEachChild(node,visit);
    }
    visit(runner.source);
    const stable = value => JSON.stringify(value && typeof value === 'object' ? (Array.isArray(value) ? value.map(v=>JSON.parse(stable(v))) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))]))) : value);
    if (manifests.some(m => stable(m) !== stable(manifests[0]))) fail('Multiple factory calls declare different extension manifests');
    const legacyPath=path.join(appRoot,'extensionConfig.json');
    const legacy=fs.existsSync(legacyPath) ? context(legacyPath).json : undefined;
    const source=manifests[0];
    if (manifests.length && (!source || typeof source !== 'object' || Array.isArray(source))) fail('params.manifest must be an object');
    if (!source && !legacy) fail('No params.manifest in src/runner.ts and no legacy extensionConfig.json');
    function combine(primary, fallback, prefix='') {
        const result={...fallback,...primary};
        for (const key of Object.keys(fallback)) {
            const name=prefix+key;
            if (!(key in primary)) {
                if (name !== 'manifest_version') console.warn(`[DevEx manifest] Legacy-only field ${name}; migrate it to params.manifest`);
            } else if (primary[key] && fallback[key] && typeof primary[key]==='object' && typeof fallback[key]==='object' && !Array.isArray(primary[key]) && !Array.isArray(fallback[key])) {
                result[key]=combine(primary[key],fallback[key],name+'.');
            } else if (stable(primary[key])!==stable(fallback[key])) fail(`Conflict for ${name}: params.manifest disagrees with extensionConfig.json`);
        }
        return result;
    }
    const manifest=source && legacy ? combine(source,legacy) : source || legacy;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('Manifest must be an object');
    if (manifest.manifest_version !== undefined && manifest.manifest_version !== 3) fail('Only Manifest V3 is supported');
    return {manifest,dependencies:[...dependencies],hasGlobalParticipants};
}

module.exports = {readProjectManifest};
