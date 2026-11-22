import {extensionConfigType} from "../coreInterfaces";

export function matchModuleToUrl(config: extensionConfigType, currentUrl: string) {
    return {
        functionalities: config.functionalities.filter(Module => {
            const moduleUrl = Object.getOwnPropertyDescriptor(Module, 'url').value
            return checkUrl(moduleUrl, currentUrl)
        })
    }
}

export function checkUrl(url: string, currentUrl: string) {
    let pattern: URL;
    let current: URL;
    try {
        pattern = new URL(url);
        current = new URL(currentUrl);
    } catch {
        return false;
    }

    // Match URL components rather than searching their text inside the full URL.
    if (pattern.protocol !== current.protocol) return false;
    if (pattern.port !== current.port) return false;

    const hostPattern = pattern.hostname.toLowerCase();
    const host = current.hostname.toLowerCase();
    const hostnameMatches = hostPattern.startsWith('*.')
        ? host.endsWith(hostPattern.slice(1)) && host.length > hostPattern.length - 1
        : host === hostPattern;
    if (!hostnameMatches) return false;

    let pathname: string;
    try { pathname = decodeURIComponent(pattern.pathname); } catch { return false; }
    if (pathname === '/*' || pathname === '/') return true;
    if (pathname.endsWith('*')) return current.pathname.startsWith(pathname.slice(0, -1));
    return current.pathname === pathname;
}

export function getCurrentUrl() {
    return window.location.href
}

export function replacer (pathname: string) {
    // Retained for compatibility with existing imports.
    return pathname.replace(/(\.(\*|%2A)|(\*|%2A)\.|(\*|%2A))/g, '')
}
