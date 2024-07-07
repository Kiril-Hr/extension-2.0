import { Module, ModuleDecoratorOptionsOutput, ModuleDecoratorOptionsAdapt } from '../coreInterfaces';
import {ModuleProvider} from "../providers/ModuleProvider";
import {
    checkModuleDecoratorParams
} from "../commonUtils/checkModuleDecoratorParams.utils";

export function ModuleDecorator(params: ModuleDecoratorOptionsOutput) {
  // This decorator helps create a derivative module of program.
  // Write here services you want to use but remember that you have only one point to run your module(script),
  // put into params object a method of launching your module in setupFunction properties.
  // The params object has third option which is called executors where you can put in the functions you want to execute after module logic will start working on the web page.
    return function <U extends new (...args: any[]) => any>(target: U) {
        const checkedParams = checkModuleDecoratorParams(params, target.name)

        class ModuleWithServices extends target implements Module {
            public readonly _params: ModuleDecoratorOptionsAdapt

            constructor(...args: any[]) {
                super(...args)
                if (checkedParams.vanilla) {
                    const provider = new ModuleProvider(checkedParams)
                    this._params = provider.params
                }
                if (checkedParams.reactiveScripts) {
                    this._params = {
                        name: checkedParams.name,
                        url: checkedParams.url,
                        reactiveScripts: checkedParams.reactiveScripts
                    }
                }

                if (!checkedParams.vanilla && !checkedParams.reactiveScripts) {
                    throw new Error('Neither vanilla nor reactiveScripts are specified');
                }
            }

            public setup() {
                try {
                    this._params.vanilla && this._params.vanilla.setupFunction()
                    this._params.widgets && this.initializeWidgets()
                    this._params.reactiveScripts && this._params.reactiveScripts.components && this.initializeReactiveComponents()
                } catch (e) {
                    throw Error('Error has occurred if you have not followed this recommendation => 1) module has vanilla property but does not have setupFunction; 2) Error during initialize widgets; 3) Error during initialize reactive components; (at moduleDecorator)', e)
                }

                try {
                  this.setupAdditionalMethods(this._params.vanilla.executors)
                } catch (e) {
                  throw Error('Error in method has occurred if you have not followed this recommendation => Element of executors has to be [service class]; (at moduleDecorator)', e)
                }
            }

            public async initializeReactiveComponents() {
                try {
                    const { ReactiveComponentFactory } = await import('../reactiveComponents/ReactiveComponentFactory');

                    ReactiveComponentFactory.createComponent(this._params.reactiveScripts);
                } catch (error) {
                    console.error('Error initializing reactive components:', error);
                }
            }

            public initializeWidgets() {
                this._params.widgets.forEach((w) => w())
            }

            public setupAdditionalMethods(methods: (() => void)[]) {
                if (!methods || methods.length === 0) return
                methods.forEach((method) => method())
            }
        }

        Object.defineProperties(ModuleWithServices, {
          name: {
            value: checkedParams.name,
            writable: false
          },
          url: {
            value: checkedParams.url,
            writable: false
          }
        })

        return ModuleWithServices
    }
}
