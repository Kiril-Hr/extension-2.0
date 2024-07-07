"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleTurner = exports.ModuleDecorator = exports.dependencyContainer = exports.ExtensionCoreModule = exports.ExtensionConfig = exports.DisableFeatures = exports.ServiceDecorator = exports.Feature = void 0;
var ServiceDecorator_1 = require("./decorators/ServiceDecorator");
Object.defineProperty(exports, "Feature", { enumerable: true, get: function () { return ServiceDecorator_1.Feature; } });
Object.defineProperty(exports, "ServiceDecorator", { enumerable: true, get: function () { return ServiceDecorator_1.ServiceDecorator; } });
Object.defineProperty(exports, "DisableFeatures", { enumerable: true, get: function () { return ServiceDecorator_1.DisableFeatures; } });
var ExtensionConfig_1 = require("./decorators/ExtensionConfig");
Object.defineProperty(exports, "ExtensionConfig", { enumerable: true, get: function () { return ExtensionConfig_1.ExtensionConfig; } });
var extensionCoreModule_1 = require("./extensionCoreModule");
Object.defineProperty(exports, "ExtensionCoreModule", { enumerable: true, get: function () { return extensionCoreModule_1.ExtensionCoreModule; } });
var dependencyContainer_1 = require("./dependencyContainer/dependencyContainer");
Object.defineProperty(exports, "dependencyContainer", { enumerable: true, get: function () { return dependencyContainer_1.dependencyContainer; } });
var ModuleDecorator_1 = require("./decorators/ModuleDecorator");
Object.defineProperty(exports, "ModuleDecorator", { enumerable: true, get: function () { return ModuleDecorator_1.ModuleDecorator; } });
var ModuleTurner_1 = require("./observer/ModuleTurner");
Object.defineProperty(exports, "ModuleTurner", { enumerable: true, get: function () { return ModuleTurner_1.ModuleTurner; } });
//# sourceMappingURL=index.js.map