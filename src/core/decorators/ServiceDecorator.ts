import dependencyContainer from '../dependencyContainer/dependencyContainer';
import { DisableFeaturesDecoratorType } from '../coreInterfaces';

function MethodDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  descriptor.value.classname = target.constructor.name
  return descriptor
}

export function ServiceDecorator<T extends new (...args: any[]) => {}>(service: T) {
  const proto = service.prototype
  const methodNames = Object.getOwnPropertyNames(proto)

  methodNames.forEach((methodName) => {
    const methodDescriptor = Object.getOwnPropertyDescriptor(proto, methodName)
    if (methodDescriptor && typeof methodDescriptor.value === "function") {
      MethodDecorator(proto, methodName, methodDescriptor)
    }
  })

  Object.defineProperty(service, "classname", { value: service.name })

  dependencyContainer.registerService<T>(service.name, service)

  return service
}

export function Feature(feature: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value.feature = feature

    return descriptor
  }
}

export function DisableFeatures<TypeFeature, ReturnTypes, ClassLinkType, WrappedArgs>({ method, features, link }: DisableFeaturesDecoratorType<TypeFeature, ClassLinkType>): (args: WrappedArgs) => ReturnTypes {
  return (args) => {
    if (features) {
      const methodDescriptors = Object.getOwnPropertyDescriptors(link.constructor.prototype)
      const disableFeatures = features

      for (const disableFeature in disableFeatures) {
        for (const feature in methodDescriptors) {
          const methodDescriptor = methodDescriptors[feature]
          const featureName = methodDescriptor.value.feature

          if (disableFeatures[disableFeature] && featureName === disableFeature) {
            link.constructor.prototype[feature] = function() {
              return
            }
          }
        }
      }
    }

    const linked = method.bind(link)
    return linked(args)
  };
}
