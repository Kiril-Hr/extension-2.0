"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dependencyContainer = void 0;
class DependencyContainer {
    constructor() {
        // need to save and reuse repeatedly services
        this.services = new Map();
    }
    registerService(key, service) {
        if (!this.services.has(key)) {
            const template = new service();
            this.services.set(key, template);
        }
    }
    getService(key) {
        const service = this.services.get(key);
        if (!service) {
            throw new Error('An error occurred while trying to get the service');
        }
        return service;
    }
}
const dependencyContainer = new DependencyContainer();
exports.dependencyContainer = dependencyContainer;
//# sourceMappingURL=dependencyContainer.js.map