import {
    CustomManifestModulesType,
    extensionConfigType,
    IExtensionParams,
    ModulesType,
    ExtensionLifecycle,
} from "./coreInterfaces";
import {ExtensionConfig} from "./decorators/ExtensionConfig";
import {ExtensionCoreModule} from "./coreModule/ExtensionCoreModule";
import {ExtensionConfigurator} from "./coreModule/ExtensionConfigurator";

type FactoryArgs = {
    params: IExtensionParams,
    customManifestModules?: CustomManifestModulesType // todo configuration: first UI module for extension in Browser. For example setting google-analytics module
}

const createExtensionFactory = (modules: ModulesType) => {
  let current: ExtensionLifecycle | undefined
  return ({ params, customManifestModules }: FactoryArgs): ExtensionLifecycle => {
    if (!params.manifest) throw new Error('You have to specify your manifest configuration')
    current?.teardown()

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

    let extension: ExtensionCoreModule
    const runExtension = () => {
        extension = new ExtensionCoreModule(Config.getConfig());
        extension.setup();
    }

    const configurator = new ExtensionConfigurator({
        runExtension,
        manifest: params.manifest,
        widgets: params.widgets || [],
        customManifestModules: customManifestModules || []
    });
    let disposed = false
    let lastUrl = window.location.href
    const onRoute = () => {
        if (!disposed && window.location.href !== lastUrl) controller.reSetup()
    }
    const onMessage = (message: { type?: string }, _sender: unknown, respond: (value: unknown) => void) => {
        if (message?.type !== '__DEVEX_ROUTE_CHANGED__' || disposed) return
        onRoute()
        respond({ handled: true })
    }
    const runtime = typeof chrome !== 'undefined' ? chrome.runtime : undefined
    const controller: ExtensionLifecycle = {
        reSetup() {
            if (disposed) throw new Error('Cannot reSetup a disposed extension; configure the factory again')
            ExtensionConfig(config)(Config)
            lastUrl = window.location.href
            // Use the existing Core for cleanup and recreation; persistent
            // participants see the new route before route modules start.
            extension.teardown()
            configurator.reSetup(Config.getConfig())
            extension.reSetup(Config.getConfig())
        },
        teardown() {
            if (disposed) return
            disposed = true
            window.removeEventListener?.('popstate', onRoute)
            window.removeEventListener?.('hashchange', onRoute)
            runtime?.onMessage?.removeListener(onMessage)
            const errors: unknown[] = []
            try { extension.teardown() } catch (error) { errors.push(error) }
            try { configurator.teardown() } catch (error) { errors.push(error) }
            if (errors.length) throw new AggregateError(errors, 'Extension teardown failed')
        }
    }
    window.addEventListener?.('popstate', onRoute)
    window.addEventListener?.('hashchange', onRoute)
    runtime?.onMessage?.addListener(onMessage)
    current = controller
    return controller
  }
};

export { createExtensionFactory }
