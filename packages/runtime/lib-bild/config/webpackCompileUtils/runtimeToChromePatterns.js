// Chrome cannot express DevEx's port restriction. Report that difference;
// ExtensionConfig remains responsible for selecting modules at runtime.
function convertRuntimePattern(pattern) {
    let url;
    try { url = new URL(pattern); } catch { throw new Error(`Invalid DevEx URL: ${pattern}`); }
    if (!['http:', 'https:', 'ftp:', 'file:'].includes(url.protocol) || url.username || url.password) {
        throw new Error(`Cannot convert DevEx URL to Chrome match patterns: ${pattern}`);
    }
    if (url.port) throw new Error(`Chrome match patterns cannot restrict port ${url.port}: ${pattern}`);
    const host = url.hostname;
    if (host.includes('*') && (!host.startsWith('*.') || host.slice(2).includes('*'))) {
        throw new Error(`Unsupported DevEx hostname wildcard: ${pattern}`);
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new Error(`Invalid URL pathname: ${pattern}`); }
    if (pathname.includes('*') && (!pathname.endsWith('*') || pathname.slice(0,-1).includes('*'))) {
        throw new Error(`Chrome glob would change DevEx literal path semantics: ${pattern}`);
    }
    if (/[?#]/.test(pathname) || pathname !== url.pathname.replace(/%2A/ig, '*')) {
        throw new Error(`Encoded pathname cannot be converted exactly: ${pattern}`);
    }
    // A bare slash means every path in DevEx. Query/hash do not affect routing.
    if (pathname === '/') pathname = '/*';
    const base = `${url.protocol}//${host}`;
    const matches = [base + pathname];
    if (!pathname.endsWith('*')) matches.push(base + pathname + '?*');
    const excludeMatches = host.startsWith('*.')
        ? matches.map(p => p.replace('://*.', '://')) : [];
    return {matches, excludeMatches, host, warnings: url.protocol === 'file:' ? [] : [
        `Chrome cannot limit ${pattern} to its default port. Content-script injection also covers other ports; DevEx runtime routing still rejects them.`
    ]};
}

function contentScriptForPatterns(patterns) {
    if (!patterns.length) return undefined;
    const converted = patterns.map(convertRuntimePattern);
    const excludes = new Set();
    converted.forEach(item => {
        item.warnings.forEach(w => console.warn('[DevEx URL conversion] ' + w));
        for (const excluded of item.excludeMatches) {
            const rootHost = item.host.slice(2);
            if (converted.some(other => other !== item && (other.host === rootHost ||
                (other.host.startsWith('*.') && rootHost.endsWith(other.host.slice(1)))))) {
                console.warn(`[DevEx URL conversion] Root-domain exclusion for ${item.host} overlaps another module. Injection uses the union; ExtensionConfig must select modules.`);
            } else excludes.add(excluded);
        }
    });
    return {
        matches: [...new Set(converted.flatMap(item => item.matches))],
        ...(excludes.size ? {exclude_matches:[...excludes]} : {}),
        js:['runner.js']
    };
}
module.exports = {convertRuntimePattern,contentScriptForPatterns};
