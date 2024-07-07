import { DisableFeaturesDecoratorType } from '../coreInterfaces';
export declare function ServiceDecorator<T extends new (...args: any[]) => {}>(service: T): T;
export declare function Feature(feature: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function DisableFeatures<TypeFeature, ReturnTypes, ClassLinkType, WrappedArgs>({ method, features, link }: DisableFeaturesDecoratorType<TypeFeature, ClassLinkType>): (args: WrappedArgs) => ReturnTypes;
