import {Instance} from "../coreInterfaces";

class DependencyContainer {
  // Need to save and reuse repeatedly services
  private services: Map<string, InstanceType<any>> = new Map()
  private fields: Record<string, string[]> = {}

  constructor() {}

  public registerService<T extends new (...args: any[]) => {}>(key: string, service: T) {
    if (!this.services.has(key)) {
      const template = new service() as Instance
      this.services.set(key, template)
    }
  }

  public getService<T extends new (...args: any[]) => {}>(key: string) {
    const service = this.services.get(key)

    if (!service) {
      throw new Error('An error occurred while trying to get the service')
    }

    return service as InstanceType<T>
  }

  public checkService(key: string) {
    const service = this.services.get(key)

    if (!service) {
      console.log('Service is not stored')

      return false
    }

    return true
  }

  public reSetup() {
    // Destroy all stored modules.
    // This method destroys all modules included in general widgets are set in runner factory, so it causes removing general widgets logic and inability to continue working process of these general widgets which have to work during whole extension cycle. (before reloading the page)
    this.services = new Map()
  }

}

const dependencyContainer = new DependencyContainer()

export { dependencyContainer }
