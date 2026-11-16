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
            public reactiveCleanup?: () => void
            public reactiveGeneration = 0
            public widgetCleanups: (() => void)[] = []

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
                        widgets: checkedParams.widgets,
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
                    throw Error('Error has occurred if you have not followed this recommendation => 1) module has vanilla property but does not have setupFunction; 2) Error during initialize widgets; 3) Error during initialize reactive components; (at moduleDecorator)', { cause: e })
                }

                try {
                  this.setupAdditionalMethods(this._params.vanilla?.executors)
                } catch (e) {
                  throw Error('Error in method has occurred if you have not followed this recommendation => Element of executors has to be [service class]; (at moduleDecorator)', { cause: e })
                }
            }

            public async initializeReactiveComponents() {
                const generation = this.reactiveGeneration;
                try {
                    const { ReactiveComponentFactory } = await import('../reactiveComponents/ReactiveComponentFactory');

                    const cleanup = ReactiveComponentFactory.createComponent(this._params.reactiveScripts);
                    if (generation !== this.reactiveGeneration) {
                        cleanup?.();
                    } else {
                        this.reactiveCleanup?.();
                        this.reactiveCleanup = cleanup;
                    }
                } catch (error) {
                    console.error('Error initializing reactive components:', error);
                }
            }

            public teardown() {
                this.reactiveGeneration++;
                const cleanup = this.reactiveCleanup;
                this.reactiveCleanup = undefined;
                const cleanups = this.widgetCleanups.splice(0);
                const errors: unknown[] = [];
                for (const release of [cleanup, ...cleanups]) {
                    try { release?.(); } catch (error) { errors.push(error); }
                }
                try { if (typeof super.teardown === 'function') super.teardown(); }
                catch (error) { errors.push(error); }
                if (errors.length) throw new AggregateError(errors, 'Module teardown failed');
            }

            public initializeWidgets() {
                if (this.widgetCleanups.length) return
                this._params.widgets.forEach((w) => {
                    const cleanup = w() as unknown
                    if (typeof cleanup === 'function') this.widgetCleanups.push(cleanup as () => void)
                })
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
