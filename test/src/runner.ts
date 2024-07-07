import { modules } from "./modules";
import { extensionConfigType, ModuleTurnerType } from 'devxtension/dist/core/coreInterfaces';

import { ExtensionCoreModule, ExtensionConfig, ModuleTurner, dependencyContainer } from 'devxtension'

const config: extensionConfigType = {
    functionalities: modules
}

@ExtensionConfig(config)
class Config {
    public static config: extensionConfigType;

    static getConfig() {
        return this.config;
    }

    static setConfig(config: extensionConfigType) {
      this.config = config;
    }
}

const extension = new ExtensionCoreModule(Config.getConfig())
const turner = dependencyContainer.getService<ModuleTurnerType>(ModuleTurner.name)

turner.initialModuleTurner(extension, config, Config)
extension.setup()
