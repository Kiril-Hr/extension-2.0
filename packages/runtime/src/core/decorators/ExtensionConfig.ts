import {extensionConfigType, Target} from "../coreInterfaces";
import {getCurrentUrl, matchModuleToUrl} from "../commonUtils/checkURL.utils";

export function ExtensionConfig(config: extensionConfigType) {
    // Decorator helps select needed module which depends on current URL
    return function (target: Target) {
        const currentUrl = getCurrentUrl()
        const neededModulesConfig = matchModuleToUrl(config, currentUrl)
        target.setConfig(neededModulesConfig)
    }
}