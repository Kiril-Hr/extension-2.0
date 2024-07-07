"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleDecorator = void 0;
const moduleProvider_1 = require("../providers/moduleProvider");
function ModuleDecorator(params) {
    // This decorator helps create a derivative module of program.
    // Write here services you want to use but remember that you have only one point to run your module(script),
    // put into params object a method of launching your module in setupFunction properties.
    // The params object has third option which is called executors where you can put in the functions you want to execute after module logic will start working on the web page.
    return function (target) {
        class ModuleWithServices extends target {
            constructor(...args) {
                super(...args);
                const provider = new moduleProvider_1.ModuleProvider(params);
                this._params = provider.params;
                this.services = this.initializeServices(this._params.services);
            }
            setup() {
                this._params.setupFunction();
                try {
                    this.setupAdditionalMethods(this._params.executors);
                }
                catch (e) {
                    throw Error('Error in method has occurred if you have not followed this recommendation => Element of executors has to be [service, its method]; (at moduleDecorator)');
                }
            }
            initializeServices(services) {
                const temporary = {};
                for (let Service in services) {
                    temporary[Service] = services[Service];
                }
                return temporary;
            }
            setupAdditionalMethods(methods) {
                if (!methods || methods.length === 0)
                    return;
                methods.forEach((method) => method());
            }
        }
        Object.defineProperties(ModuleWithServices, {
            name: {
                value: params.name,
                writable: false
            },
            url: {
                value: params.url,
                writable: false
            }
        });
        return ModuleWithServices;
    };
}
exports.ModuleDecorator = ModuleDecorator;
//# sourceMappingURL=ModuleDecorator.js.map