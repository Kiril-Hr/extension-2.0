import {modules} from "./modules";
import {ExtensionConfig} from "./core/decorators/ExtensionConfig";
import {ExtensionCoreModule} from "./core/extensionCoreModule";
import { extensionConfigType, ModuleTurnerType } from './core/coreInterfaces';
import { ModuleTurner } from './core/observer/ModuleTurner';
import dependencyContainer from './core/dependencyContainer/dependencyContainer';

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
