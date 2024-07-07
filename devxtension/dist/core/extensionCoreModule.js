"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionCoreModule = void 0;
class ExtensionCoreModule {
    constructor(config) {
        this.modules = this.putModules(config);
    }
    setup() {
        //console.log('---------------------------------- > setup is executing !!')
        this.modules.forEach(m => m.setup());
        //console.log(this.modules)
    }
    reSetup(config) {
        //console.log('---------------------------------- > reSetup is executing !!')
        this.modules = [];
        this.modules = this.putModules(config);
        this.setup();
    }
    putModules(config) {
        return config.functionalities.map(Module => {
            return new Module();
        });
    }
}
exports.ExtensionCoreModule = ExtensionCoreModule;
//# sourceMappingURL=extensionCoreModule.js.map