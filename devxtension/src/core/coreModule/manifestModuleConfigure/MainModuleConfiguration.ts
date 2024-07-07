import {Constructor, CustomManifestModulesType, IManifestModule, ManifestParams} from "../../coreInterfaces";
import {dependencyContainer} from "../../dependencyContainer/dependencyContainer";

interface IMainModuleConfiguration {
    configureModules(): void
}

class MainModuleConfiguration implements IMainModuleConfiguration {
    private manifest: ManifestParams
    private customManifestModules: CustomManifestModulesType

    constructor(manifest: ManifestParams, customManifestModules: CustomManifestModulesType) {
        this.manifest = manifest
        this.customManifestModules = customManifestModules
    }

    public configureModules = () => {
        // Function is going to run modules from a library and the user’s custom logic. This object and its modules (functions) depend on the configuration of the manifest and perform certain events in accordance with a specific property that is intended for custom processing.

        this.customManifestModules.forEach((mm: Constructor<IManifestModule>) => {
            dependencyContainer.registerService(mm.name, mm);
            dependencyContainer.getService<Constructor<IManifestModule>>(mm.name).setup(this.manifest);
        })

        console.log('configureModules is running ...')
    }

}

export { MainModuleConfiguration }