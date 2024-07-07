import { ModuleDecoratorOptions, ModuleDecoratorOptionsAdapt, ServiceModuleRecord } from '../coreInterfaces';
export declare function ModuleDecorator<T>(params: ModuleDecoratorOptions<T>): <U extends new (...args: any[]) => any>(target: U) => {
    new (...args: any[]): {
        [x: string]: any;
        readonly services: T;
        readonly _params: ModuleDecoratorOptionsAdapt<T>;
        setup(): void;
        initializeServices<T>(services: ServiceModuleRecord<T>): T;
        setupAdditionalMethods(methods: (() => void)[]): void;
    };
} & U;
