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
    const kindModuleUrl = new URL(url)
    const { protocol, path, hostname } = {
        protocol: currentUrl.includes(kindModuleUrl.protocol),
        hostname: currentUrl.includes(replacer(kindModuleUrl.hostname)),
        path: kindModuleUrl.pathname.startsWith('/*') ? true : currentUrl.includes(replacer(kindModuleUrl.pathname)),
    }

    return protocol && hostname && path
}

export function getCurrentUrl() {
    return window.location.href
}

export function replacer (pathname: string) {
    // This function returns url without star or dot (after converting url via url Object starts converting to %2A)
    return pathname.replace(/(\.(\*|%2A)|(\*|%2A)\.|(\*|%2A))/g, '')
}