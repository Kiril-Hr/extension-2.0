import { extensionConfigType, Module, Target, ModuleTurnerType, changeTurnEventsType } from '../coreInterfaces';
import { ServiceDecorator } from '../decorators/ServiceDecorator';

@ServiceDecorator
export class ModuleTurner implements ModuleTurnerType {
  private readonly changeTurnEvents: changeTurnEventsType[] = []
  private currentElement: HTMLElement

  private extension: Module

  private config: extensionConfigType
  private Config: Target

  constructor() {}

  public initialModuleTurner(extension: Module, config: extensionConfigType, Config: Target) {
    this.extension = extension

    this.config = config
    this.Config = Config
  }

  public registerTurnHandle({ turnHandle, elementID, browserEvent }: changeTurnEventsType) {
    this.changeTurnEvents.push({ turnHandle, elementID, browserEvent })

    document.body.addEventListener(browserEvent, (e) => {
      console.log((e.target as HTMLElement).id)
      if ((e.target as HTMLElement).id === elementID) {

        setTimeout(() => this.reselectModules().then(() => {
          if (turnHandle) turnHandle()

          this.currentElement = e.target as HTMLElement
        }), 1000)
      }
    })
  }

  get getTurnEvents(): changeTurnEventsType[] {
    return [...this.changeTurnEvents]
  }

  private async reselectModules()  {
    const { matchModuleToUrl } = await import('../decorators/ExtensionConfig');
    const currentURL =  new URL(window.location.href)

    this.config = matchModuleToUrl(this.config, currentURL.href)

    this.Config.setConfig(this.config)
    this.extension.reSetup(this.Config.getConfig())
  }

}
