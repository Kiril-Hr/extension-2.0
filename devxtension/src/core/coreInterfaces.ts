export interface Module {
    setup?(): void // here we indicated the point of start the module
    reSetup?(config: extensionConfigType): void // change module according to new URL
}

export type Instance<A = undefined> = new (...args: any[]) => {} & (A extends undefined ? {} : A)

export type Constructor<T = {}> = new (...args: any[]) => T

export type ModulesType = Constructor<Module>[]

export interface extensionConfigType {
    functionalities: ModulesType
}

export type ServiceValue<T = any, A = undefined> = T[keyof T] & {name?: string} & (A extends undefined ? {} : A)
export type WidgetValue = Constructor<Module & { name?: string, setup: () => void }>
export type WidgetModuleArrayInput = (() => void)[]
export type WidgetModuleArrayOutput = WidgetValue[]

export type ReactiveLibs = 'react'

export type ReactiveComponentType = (...args: any[]) => any;

export type ReactiveComponentsTypes = {
    type: ReactiveLibs,
    components: ReactiveComponentType[]
}

export type SingleExecutorType = Instance<{ executor: () => void }>
export type ExecutorsDecoratorOutputArray = SingleExecutorType[]
export type ExecutorsDecoratorOutput = Instance<{ executor: () => void }> | ExecutorsDecoratorOutputArray

export type SingleExecutorsProviderInput = [ServiceValue<SingleExecutorType>, () => void]
export type ExecutorsProviderInput = SingleExecutorsProviderInput[]
export type ExecutorsProviderOutput = (() => void)[]

export interface MainServiceInterface { run: () => void, name?: string }
export type MainServiceType = Instance<MainServiceInterface>
export type Vanilla<E> = {
    mainService: MainServiceType | MainServiceInterface
    executors?: E
}

interface ModuleOptions<W = undefined> {
  name?: string
  url: string
  reactiveScripts?: ReactiveComponentsTypes
  widgets?: W
}

export interface ModuleDecoratorOptionsOutput extends ModuleOptions<WidgetModuleArrayOutput> {
  vanilla?: Vanilla<ExecutorsDecoratorOutput>
}

export interface ModuleDecoratorOptionsInput extends ModuleOptions<WidgetModuleArrayInput> {
  vanilla?: Vanilla<ExecutorsProviderInput> & { setupFunction: () => void }
}

export interface ModuleDecoratorOptionsAdapt extends ModuleOptions<WidgetModuleArrayInput> {
  vanilla?: Vanilla<ExecutorsProviderOutput> & { setupFunction: () => void }
}

export interface Target {
    config: extensionConfigType
    setConfig(config: extensionConfigType): void
    getConfig(): extensionConfigType
}

export type DisableFeaturesDecoratorType<T, C> = {
  method: (...args: any) => any,
  features: ServiceValue<T> | null,
  link: C
}

type SetupManifest = (manifest?: ManifestParams) => void;

export interface IManifestModule {
    setup: SetupManifest
}

export type CustomManifestModulesType = Constructor<IManifestModule>[]

export interface IExtensionParams {
    // This property "widgets" is array of common modules which are going to be run in all URLs. You can use early downloaded widgets in your modules to linked them to specific logic in only one URL. (src/modules/*)
    widgets?: Constructor<Module>[] | []
    // Manifest configuration for extension setup
    manifest: ManifestParams
}

export interface IExtensionConfigurationParams extends IExtensionParams {
    runExtension: () => void
    customManifestModules: CustomManifestModulesType | []
}

type VersionString = `${number}.${number}.${number}`;
type BrowserAction = {
    default_icon?: string;
    default_popup?: string;
    default_title: string;
};
type URLSchema = "*://*/*" | "*://*.[a-zA-Z]+/*";
type HostPermissions = | "<all_urls>" | URLSchema;
type ChromeVersion = `${number}.${number}.${number}${"" | `.${number}`}`;
type Permissions =
    | "activeTab"
    | "tabs"
    | "alarms"
    | "background"
    | "bookmarks"
    | "clipboardRead"
    | "clipboardWrite"
    | "contentSettings"
    | "contextMenus"
    | "cookies"
    | "debugger"
    | "declarativeContent"
    | "desktopCapture"
    | "documentScan"
    | "downloads"
    | "enterprise.deviceAttributes"
    | "enterprise.hardwarePlatform"
    | "enterprise.platformKeys"
    | "experimental"
    | "fileBrowserHandler"
    | "fileSystemProvider"
    | "fontSettings"
    | "gcm"
    | "geolocation"
    | "hid"
    | "identity"
    | "idle"
    | "loginScreenStorage"
    | "management"
    | "nativeMessaging"
    | "notifications"
    | "pageCapture"
    | "platformKeys"
    | "power"
    | "printerProvider"
    | "privacy"
    | "processes"
    | "proxy"
    | "sessions"
    | "signedInDevices"
    | "storage"
    | "system.cpu"
    | "system.display"
    | "system.memory"
    | "system.storage"
    | "tabCapture"
    | "topSites"
    | "tts"
    | "ttsEngine"
    | "vpnProvider"
    | "wallpaper"
    | "webNavigation"
    | "webRequest"
    | "webRequestBlocking";

type ManifestKeys = {
    author?: string;
    chrome_settings_overrides?: any;
    chrome_url_overrides?: { [page: string]: string };
    commands?: { [command: string]: { suggested_key: { default: string }, description: string } };
    content_security_policy?: string;
    cross_origin_embedder_policy?: { value: string };
    cross_origin_opener_policy?: { value: string };
    default_locale?: string;
    devtools_page?: URLSchema;
    externally_connectable?: { matches: string[] };
    homepage_url?: URLSchema;
    incognito?: "spanning" | "split";
    minimum_chrome_version?: ChromeVersion;
    oauth2?: { client_id: string, scopes: string[] };
    offline_enabled?: boolean;
    omnibox?: { keyword: string };
    optional_permissions?: Permissions[];
    options_page?: string;
    options_ui?: { page: string, open_in_tab: boolean };
    permissions?: Permissions[];
    short_name?: string;
    storage?: { managed_schema: string };
    update_url?: URLSchema;
    version_name?: string;
    web_accessible_resources?: string[];
};

export type ManifestParams = ManifestKeys & {
    version: VersionString;
    description: string;
    action: BrowserAction;
    name: string;
    host_permissions: HostPermissions[];
};
