import { ModuleDecoratorOptions, ModuleDecoratorOptionsAdapt } from '../coreInterfaces';

export class ModuleProvider<T> {
    private readonly _params: ModuleDecoratorOptionsAdapt<T>

    constructor(params: ModuleDecoratorOptions<T>) {
        this._params = this.adaptParams(params)
    }

    get params() {
        return this._params
    }

    private adaptParams(params: ModuleDecoratorOptions<T>): ModuleDecoratorOptionsAdapt<T> {
        return {
          name: params.name,
          url: params.url,
          mainService: params.mainService,
          services: params.services,
          executors: this.adaptExecutors(params),
          setupFunction: this.adaptSetupFunction(params),
        }
    }

    private adaptSetupFunction(params: ModuleDecoratorOptions<T>) {
       return this.verifyMethod(params, params.setupFunction).bind(params.mainService)
    }

    private adaptExecutors(params: ModuleDecoratorOptions<T>) {
        if (!params.executors || params.executors.length === 0) return params.executors
        return params.executors.map(([s, m]) => this.verifyMethod(params, m).bind(s))
    }

    private verifyMethod(params: ModuleDecoratorOptions<T>, method: () => void) {
        let inheritedClassNameMethod: string

        try {
          inheritedClassNameMethod = Object.getOwnPropertyDescriptors(method).classname.value
        } catch (e) {
          throw Error('Error in method has occurred if you have not followed these recommendations: 1) Use function declaration instead of function expression; 2) Use ServiceDecorator; (at moduleProvider)', e)
        }

        let verify: boolean

        for (let prop in params.services) {
          const service = params.services[prop]
          const serviceName = params.services[prop].constructor.prototype.constructor.classname

          verify = inheritedClassNameMethod === serviceName

          if (verify) {
            break
          } else {
            verify = this.verifyWithDerivativeServices<T>(service, inheritedClassNameMethod)
            if (verify) {
              break
            }
          }
        }

        if (!verify) throw Error('Error has occurred if you have not followed these recommendations: 1) You have to use reference to your service or method; 2) Setup method must belong to main service but it is not; (at moduleProvider)')

        return method
    }

    private verifyWithDerivativeServices<T>(service: T[keyof T], inheritedClassNameMethod: string) {
      function checkService(service) {
        for (const key in service) {
          if (typeof service[key] === 'object') {
            const result = checkService(service[key]);

            if (result) return true
          } else if (typeof service[key] === 'function') {
            const nameOfInnerProperty = Object.getPrototypeOf(service[key]).constructor.name;

            if (nameOfInnerProperty === inheritedClassNameMethod) return true
          }
        }

        return false
      }

      return checkService(service)
    }

}
