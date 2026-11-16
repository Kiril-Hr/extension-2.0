import {Constructor, CustomManifestModulesType, extensionConfigType, IManifestModule, ManifestParams} from "../../coreInterfaces";
import {dependencyContainer} from "../../dependencyContainer/dependencyContainer";

interface IMainModuleConfiguration {
    configureModules(): void
}

class MainModuleConfiguration implements IMainModuleConfiguration {
    private manifest: ManifestParams
    private customManifestModules: CustomManifestModulesType
    private modules: IManifestModule[] = []

    constructor(manifest: ManifestParams, customManifestModules: CustomManifestModulesType) {
        this.manifest = manifest
        this.customManifestModules = customManifestModules
    }

    public configureModules = () => {
        // Function is going to run modules from a library and the user’s custom logic. This object and its modules (functions) depend on the configuration of the manifest and perform certain events in accordance with a specific property that is intended for custom processing.

        this.customManifestModules.forEach((mm: Constructor<IManifestModule>) => {
            dependencyContainer.registerService(mm.name, mm);
            const instance = dependencyContainer.getService<Constructor<IManifestModule>>(mm.name)
            if (this.modules.includes(instance)) return
            if (typeof instance.setup !== 'function') throw new Error(`Manifest module "${mm.name}" must implement setup(manifest)`)
            dependencyContainer.acquireSharedModule(instance, () => instance.setup(this.manifest))
            this.modules.push(instance)
        })

        console.log('configureModules is running ...')
    }

    public reSetup(config: extensionConfigType) {
        this.modules.forEach(module => module.reSetup?.(config))
    }

    public teardown() {
        const errors: unknown[] = []
        this.modules.splice(0).reverse().forEach(module => {
            try { dependencyContainer.releaseSharedModule(module) } catch (error) { errors.push(error) }
        })
        if (errors.length) throw new AggregateError(errors, 'Manifest module teardown failed')
    }

}

export { MainModuleConfiguration }
