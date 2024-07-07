import {
    ExecutorsProviderInput,
    ModuleDecoratorOptionsInput,
    ModuleDecoratorOptionsAdapt,
    ServiceValue,
    Vanilla
} from '../coreInterfaces';

export class ModuleProvider {
    private readonly _params: ModuleDecoratorOptionsAdapt

    constructor(params: ModuleDecoratorOptionsInput) {
        this._params = this.adaptParams({...params.vanilla!, name: params.name, url: params.url})
    }

    get params() {
        return this._params
    }

    private adaptParams(params: ModuleDecoratorOptionsInput): ModuleDecoratorOptionsAdapt {
        return {
            ...params,
            vanilla: {
                ...params.vanilla,
                executors: this.adaptExecutors(params.vanilla),
                setupFunction: this.adaptSetupFunction(params.vanilla),
            },
        }
    }

    private adaptSetupFunction(params: ModuleDecoratorOptionsInput['vanilla']) {
       return params.setupFunction.bind(params.mainService)
    }

    private adaptExecutors(params: ModuleDecoratorOptionsInput['vanilla']) {
        if (!params.executors || params.executors.length === 0) return params.executors
        return params.executors.map(([service, method]) => method.bind(service))
    }

}
