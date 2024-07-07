"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replacer = exports.getCurrentUrl = exports.checkUrl = exports.matchModuleToUrl = void 0;
function matchModuleToUrl(config, currentUrl) {
    return {
        functionalities: config.functionalities.filter(Module => {
            const moduleUrl = Object.getOwnPropertyDescriptor(Module, 'url').value;
            return checkUrl(moduleUrl, currentUrl);
        })
    };
}
exports.matchModuleToUrl = matchModuleToUrl;
function checkUrl(url, currentUrl) {
    const kindModuleUrl = new URL(url);
    const { protocol, path, hostname } = {
        protocol: currentUrl.includes(kindModuleUrl.protocol),
        hostname: currentUrl.includes(replacer(kindModuleUrl.hostname)),
        path: kindModuleUrl.pathname.startsWith('/*') ? true : currentUrl.includes(replacer(kindModuleUrl.pathname)),
    };
    return protocol && hostname && path;
}
exports.checkUrl = checkUrl;
function getCurrentUrl() {
    return window.location.href;
}
exports.getCurrentUrl = getCurrentUrl;
function replacer(pathname) {
    // This function returns url without star or dot (after converting url via url Object starts converting to %2A)
    return pathname.replace(/(\.(\*|%2A)|(\*|%2A)\.|(\*|%2A))/g, '');
}
exports.replacer = replacer;
//# sourceMappingURL=checkURL.utils.js.map