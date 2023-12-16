import {extensionConfigType, Module} from "./coreInterfaces";

export class ExtensionCoreModule implements Module {
  // Module creates main logic of program.
  // Don't use it to work.
    private modules: Module[]

    constructor(config: extensionConfigType) {
        this.modules = this.putModules(config)
    }

    public setup() {
      //console.log('---------------------------------- > setup is executing !!')
      this.modules.forEach(m => m.setup())
      //console.log(this.modules)
    }

    public reSetup(config: extensionConfigType) {
      //console.log('---------------------------------- > reSetup is executing !!')
      this.modules = []

      this.modules = this.putModules(config)
      this.setup()
    }

    private putModules(config: extensionConfigType): Module[] {
      return config.functionalities.map(Module => {
        return new Module()
      })
    }

}
