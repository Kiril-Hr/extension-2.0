import {
    CustomManifestModulesType,
    extensionConfigType,
    IExtensionParams,
    ModulesType,
} from "./coreInterfaces";
import {ExtensionConfig} from "./decorators/ExtensionConfig";
import {ExtensionCoreModule} from "./coreModule/ExtensionCoreModule";
import {ExtensionConfigurator} from "./coreModule/ExtensionConfigurator";

type FactoryArgs = {
    params: IExtensionParams,
    customManifestModules?: CustomManifestModulesType // todo configuration: first UI module for extension in Browser. For example setting google-analytics module
}

const createExtensionFactory = (modules: ModulesType) => ({ params, customManifestModules }: FactoryArgs) => {
    if (!params.manifest) throw new Error('You have to specify your manifest configuration')

    const config: extensionConfigType = {
        functionalities: modules,
    };

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

    const runExtension = () => {
        const extension = new ExtensionCoreModule(Config.getConfig());
        extension.setup();
    }

    const configurator = new ExtensionConfigurator({
        runExtension,
        manifest: params.manifest,
        widgets: (params.widgets.length && params.widgets) || [],
        customManifestModules: customManifestModules || []
    });
};

export { createExtensionFactory }
