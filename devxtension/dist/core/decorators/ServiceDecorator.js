"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableFeatures = exports.Feature = exports.ServiceDecorator = void 0;
const dependencyContainer_1 = require("../dependencyContainer/dependencyContainer");
function MethodDecorator(target, propertyKey, descriptor) {
    descriptor.value.classname = target.constructor.name;
    return descriptor;
}
function ServiceDecorator(service) {
    const proto = service.prototype;
    const methodNames = Object.getOwnPropertyNames(proto);
    methodNames.forEach((methodName) => {
        const methodDescriptor = Object.getOwnPropertyDescriptor(proto, methodName);
        if (methodDescriptor && typeof methodDescriptor.value === "function") {
            MethodDecorator(proto, methodName, methodDescriptor);
        }
    });
    Object.defineProperty(service, "classname", { value: service.name });
    dependencyContainer_1.dependencyContainer.registerService(service.name, service);
    return service;
}
exports.ServiceDecorator = ServiceDecorator;
function Feature(feature) {
    return function (target, propertyKey, descriptor) {
        descriptor.value.feature = feature;
        return descriptor;
    };
}
exports.Feature = Feature;
function DisableFeatures({ method, features, link }) {
    return (args) => {
        if (features) {
            const methodDescriptors = Object.getOwnPropertyDescriptors(link.constructor.prototype);
            const disableFeatures = features;
            for (const disableFeature in disableFeatures) {
                for (const feature in methodDescriptors) {
                    const methodDescriptor = methodDescriptors[feature];
                    const featureName = methodDescriptor.value.feature;
                    if (disableFeatures[disableFeature] && featureName === disableFeature) {
                        link.constructor.prototype[feature] = function () {
                            return;
                        };
                    }
                }
            }
        }
        const linked = method.bind(link);
        return linked(args);
    };
}
exports.DisableFeatures = DisableFeatures;
//# sourceMappingURL=ServiceDecorator.js.map