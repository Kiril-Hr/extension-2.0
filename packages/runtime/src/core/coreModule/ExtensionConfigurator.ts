import {Constructor, extensionConfigType, IExtensionConfigurationParams, Module} from "../coreInterfaces";
import { MainModuleConfiguration } from "./manifestModuleConfigure/MainModuleConfiguration";
import {dependencyContainer} from "../dependencyContainer/dependencyContainer";

class ExtensionConfigurator {
    private widgets: Module[] = []
    private manifestConfiguration?: MainModuleConfiguration

    constructor(params: IExtensionConfigurationParams) {
        try {
            this.additionalFunctionality(params)
        } catch (error) {
            try { this.teardown() } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Extension setup and cleanup failed')
            }
            throw error
        }
    }

    private configure(params: IExtensionConfigurationParams) {
        this.manifestConfiguration = new MainModuleConfiguration(params.manifest, params.customManifestModules)
        this.manifestConfiguration.configureModules()

        params.runExtension()
        console.log("Configuring extension with params:", params);
    }

    private additionalFunctionality(params: IExtensionConfigurationParams) {
        (params.widgets || []).forEach((m: Constructor<Module>) => {
            dependencyContainer.registerService(m.name, m);
            const instance = dependencyContainer.getService<Constructor<Module>>(m.name)
            if (this.widgets.includes(instance)) return
            if (typeof instance.setup !== 'function') throw new Error(`Widget "${m.name}" must implement setup()`)
            dependencyContainer.acquireSharedModule(instance)
            this.widgets.push(instance)
        })

        this.configure(params)
        console.log("Additional functionality has set up");
    }

    public reSetup(config: extensionConfigType) {
        this.widgets.forEach(widget => widget.reSetup?.(config))
        this.manifestConfiguration?.reSetup(config)
    }

    public teardown() {
        const errors: unknown[] = []
        try { this.manifestConfiguration?.teardown() } catch (error) { errors.push(error) }
        this.widgets.splice(0).reverse().forEach(widget => {
            try { dependencyContainer.releaseSharedModule(widget) } catch (error) { errors.push(error) }
        })
        if (errors.length) throw new AggregateError(errors, 'Extension configuration teardown failed')
    }
}

export { ExtensionConfigurator }
