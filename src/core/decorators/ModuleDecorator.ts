import { Module, ModuleDecoratorOptions, ModuleDecoratorOptionsAdapt, ServiceModuleRecord } from '../coreInterfaces';
import {ModuleProvider} from "../providers/moduleProvider";

export function ModuleDecorator<T>(params: ModuleDecoratorOptions<T>) {
  // This decorator helps create a derivative module of program.
  // Write here services you want to use but remember that you have only one point to run your module(script),
  // put into params object a method of launching your module in setupFunction properties.
  // The params object has third option which is called executors where you can put in the functions you want to execute after module logic will start working on the web page.
    return function <U extends new (...args: any[]) => any>(target: U) {
        class ModuleWithServices extends target implements Module {
            private readonly services: T
            private readonly _params:  ModuleDecoratorOptionsAdapt<T>

            constructor(...args: any[]) {
                super(...args)
                const provider = new ModuleProvider<T>(params)
                this._params = provider.params

                this.services = this.initializeServices<T>(this._params.services)
            }

            public setup() {
                this._params.setupFunction()
                try {
                  this.setupAdditionalMethods(this._params.executors)
                } catch (e) {
                  throw Error('Error in method has occurred if you have not followed this recommendation => Element of executors has to be [service, its method]; (at moduleDecorator)')
                }
            }

            private initializeServices<T>(services: ServiceModuleRecord<T>): T {
                const temporary = {} as T

                for (let Service in services) {
                    temporary[Service] = services[Service]
                }

                return temporary
            }

            private setupAdditionalMethods(methods: (() => void)[]) {
                if (!methods || methods.length === 0) return
                methods.forEach((method) => method())
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
        })

        return ModuleWithServices
    }
}
