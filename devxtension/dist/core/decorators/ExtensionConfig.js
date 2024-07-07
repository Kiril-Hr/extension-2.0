"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionConfig = void 0;
const checkURL_utils_1 = require("../commonUtils/checkURL.utils");
function ExtensionConfig(config) {
    // Decorator helps select needed module which depends on current URL
    return function (target) {
        const currentUrl = (0, checkURL_utils_1.getCurrentUrl)();
        const neededModulesConfig = (0, checkURL_utils_1.matchModuleToUrl)(config, currentUrl);
        target.setConfig(neededModulesConfig);
    };
}
exports.ExtensionConfig = ExtensionConfig;
//# sourceMappingURL=ExtensionConfig.js.map