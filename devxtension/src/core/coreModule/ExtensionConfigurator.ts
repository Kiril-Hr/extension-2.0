import {Constructor, IExtensionConfigurationParams, Module} from "../coreInterfaces";
import { MainModuleConfiguration } from "./manifestModuleConfigure/MainModuleConfiguration";
import {dependencyContainer} from "../dependencyContainer/dependencyContainer";

class ExtensionConfigurator {

    constructor(params: IExtensionConfigurationParams) {
        params.widgets && this.additionalFunctionality(params)
        !params.widgets && this.configure(params)
    }

    private configure(params: IExtensionConfigurationParams) {
        const manifestConfiguration = new MainModuleConfiguration(params.manifest, params.customManifestModules)
        manifestConfiguration.configureModules()

        params.runExtension()
        console.log("Configuring extension with params:", params);
    }

    private additionalFunctionality(params: IExtensionConfigurationParams) {
        params.widgets.forEach((m: Constructor<Module>) => {
            dependencyContainer.registerService(m.name, m);
            dependencyContainer.getService<Constructor<Module>>(m.name).setup();
        })

        this.configure(params)
        console.log("Additional functionality has set up");
    }
}

export { ExtensionConfigurator }