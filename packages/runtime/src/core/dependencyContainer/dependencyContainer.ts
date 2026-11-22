import {Instance, Module} from "../coreInterfaces";

class DependencyContainer {
  // Need to save and reuse repeatedly services
  private services: Map<string, InstanceType<any>> = new Map()
  private fields: Record<string, string[]> = {}
  private sharedModules = new Map<Module, number>()

  constructor() {}

  public registerService<T extends new (...args: any[]) => {}>(key: string, service: T) {
    if (this.services.has(key)) {
      const registered = this.services.get(key) as Instance
      if (registered.constructor !== service) {
        throw new Error(`Service registration conflict for "${key}": two different classes share the same key`)
      }
      return
    }

    const template = new service() as Instance
    this.services.set(key, template)
  }

  public getService<T = any>(key: string): T extends new (...args: any[]) => any ? InstanceType<T> : T {
    const service = this.services.get(key)

    if (!service) {
      throw new Error('An error occurred while trying to get the service')
    }

    return service as T extends new (...args: any[]) => any ? InstanceType<T> : T
  }

  public checkService(key: string) {
    const service = this.services.get(key)

    if (!service) {
      console.log('Service is not stored')

      return false
    }

    return true
  }

  // Widgets and manifest modules are DI singletons. Each owner releases its
  // reference; setup/teardown run only on the first/last active reference.
  public acquireSharedModule(module: Module, initialize = () => module.setup()) {
    const owners = this.sharedModules.get(module) || 0
    if (!owners) {
      try { initialize() } catch (error) {
        try { module.teardown?.() } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Shared module setup and cleanup failed')
        }
        throw error
      }
    }
    this.sharedModules.set(module, owners + 1)
  }

  public releaseSharedModule(module: Module) {
    const owners = this.sharedModules.get(module)
    if (!owners) return
    if (owners > 1) { this.sharedModules.set(module, owners - 1); return }
    this.sharedModules.delete(module)
    module.teardown?.()
  }

  public reSetup() {
    // Destroy all stored modules.
    // This method destroys all modules included in general widgets are set in runner factory, so it causes removing general widgets logic and inability to continue working process of these general widgets which have to work during whole extension cycle. (before reloading the page)
    const errors: unknown[] = []
    for (const module of this.sharedModules.keys()) {
      try { module.teardown?.() } catch (error) { errors.push(error) }
    }
    this.sharedModules.clear()
    this.services = new Map()
    if (errors.length) throw new AggregateError(errors, 'DI cleanup failed')
  }

}

const dependencyContainer = new DependencyContainer()

export { dependencyContainer }
