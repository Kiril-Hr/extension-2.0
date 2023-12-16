import {extensionConfigType, Target} from "../coreInterfaces";

export function ExtensionConfig(config: extensionConfigType) {
    // Decorator helps select needed module which depends on current URL
    return function (target: Target) {
        const currentUrl = getCurrentUrl()
        const neededModulesConfig = matchModuleToUrl(config, currentUrl)
        target.setConfig(neededModulesConfig)
    }
}

export function matchModuleToUrl(config: extensionConfigType, currentUrl: string) {
    return {
        functionalities: config.functionalities.filter(Module => {
            const moduleUrl = Object.getOwnPropertyDescriptor(Module, 'url').value
            return checkUrl(moduleUrl, currentUrl)
        })
    }
}

function checkUrl(url: string, currentUrl: string) {
    const kindModuleUrl = new URL(url)
    const { protocol, path, hostname } = {
        protocol: currentUrl.includes(kindModuleUrl.protocol),
        hostname: currentUrl.includes(replacer(kindModuleUrl.hostname)),
        path: kindModuleUrl.pathname.startsWith('/*') ? true : currentUrl.includes(replacer(kindModuleUrl.pathname)),
    }

    return protocol && hostname && path
}

function getCurrentUrl() {
    return window.location.href
}

function replacer (pathname: string) {
    // This function returns url without star or dot (after converting url via url Object starts converting to %2A)
    return pathname.replace(/(\.(\*|%2A)|(\*|%2A)\.|(\*|%2A))/g, '')
}
