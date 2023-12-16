
export class DependencyContainer {
  // need to save and reuse repeatedly services
  private services: Map<string, any> = new Map()

  constructor() {}

  registerService<T extends new (...args: any[]) => {}>(key: string, service: T) {
    if (!this.services.has(key)) {
      const template = new service()
      this.services.set(key, template)
    }
  }

  getService<T>(key: string) {
    const service = this.services.get(key)

    if (!service) {
      throw new Error('An error occurred while trying to get the service')
    }

    return service as T
  }
}

const dependencyContainer = new DependencyContainer()

export default  dependencyContainer
