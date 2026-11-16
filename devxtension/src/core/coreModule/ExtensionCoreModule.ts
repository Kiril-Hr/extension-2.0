import {extensionConfigType, Module} from "../coreInterfaces";
import {dependencyContainer} from "../dependencyContainer/dependencyContainer";

export class ExtensionCoreModule implements Module {
  // Module creates main logic of program.
  // Don't use it to work.
    private modules: Module[]

    constructor(config: extensionConfigType) {
        this.modules = this.putModules(config)
    }

    public setup() {
      try { this.modules.forEach(m => m.setup()) }
      catch (error) {
        try { this.teardown() } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Core setup and cleanup failed')
        }
        throw error
      }
    }

    public reSetup(config: extensionConfigType) {
      // This function deletes existing modules and running new extension cycle with new passed config
      // Let outgoing modules release their own listeners, observers and subscriptions.
      this.teardown()
      // Preserve registered singleton services: decorators register them at class definition time.
      // Clearing DI here breaks modules instantiated after a route reconfiguration.

      this.modules = this.putModules(config)
      this.setup()
    }

    public teardown() {
      const outgoing = this.modules
      this.modules = []
      const errors: unknown[] = []
      outgoing.forEach(module => {
        try { module.teardown?.() } catch (error) { errors.push(error) }
      })
      if (errors.length) throw new AggregateError(errors, 'Core teardown failed')
    }

    private putModules(config: extensionConfigType): Module[] {
      return config.functionalities.map(Module => {
        return new Module()
      })
    }

}
