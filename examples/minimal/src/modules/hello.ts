import { dependencyContainer, ModuleDecorator, ServiceDecorator } from 'devxtension'

@ServiceDecorator
class HelloService {
  private node?: HTMLDivElement

  run() {
    this.node = document.createElement('div')
    this.node.id = 'devex-hello'
    this.node.textContent = 'Hello from DevEx 2.0'
    document.body.append(this.node)
  }

  stop() {
    this.node?.remove()
    this.node = undefined
  }
}

@ModuleDecorator({
  url: 'https://example.com/*',
  vanilla: { mainService: HelloService }
})
export class HelloModule {
  teardown() {
    dependencyContainer.getService<typeof HelloService>(HelloService.name).stop()
  }
}
