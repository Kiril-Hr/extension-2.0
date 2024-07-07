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
      this.modules.forEach(m => m.setup())
    }

    public reSetup(config: extensionConfigType) {
      // This function deletes existing modules and running new extension cycle with new passed config
      this.modules = [] // Destroy existing modules in order to change logic in specific sub URL
      dependencyContainer.reSetup() // Destroy all existing widgets

      this.modules = this.putModules(config)
      this.setup()
    }

    private putModules(config: extensionConfigType): Module[] {
      return config.functionalities.map(Module => {
        return new Module()
      })
    }

}
