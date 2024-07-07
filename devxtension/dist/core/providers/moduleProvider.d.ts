import { ModuleDecoratorOptions, ModuleDecoratorOptionsAdapt } from '../coreInterfaces';
export declare class ModuleProvider<T> {
    private readonly _params;
    constructor(params: ModuleDecoratorOptions<T>);
    get params(): ModuleDecoratorOptionsAdapt<T>;
    private adaptParams;
    private adaptSetupFunction;
    private adaptExecutors;
    private verifyMethod;
    private verifyWithDerivativeServices;
}
