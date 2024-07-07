import {
    createExtensionFactory,
    extensionConfigType,
    Module
} from "../core";
import {IManifestModule} from "../core/coreInterfaces";
import {modules} from "./modules";

// fake imports
class ManifestModule implements IManifestModule {
    setup(): void {
        console.log("ManifestModule setup");
    }

    reSetup?(config: extensionConfigType): void {
        console.log("ManifestModule reSetup");
    }
} // test manifest custom logic
class Widget implements Module {
    setup(): void {
        console.log("Widget setup");
    }

} // test imported widget module
//

// show to user
createExtensionFactory(modules)({
    params: {
        manifest: {
            name: "MyExtension",
            version: "1.0.0",
            description: "This is my extension",
            permissions: ["activeTab", "storage", "tabs", "webNavigation"],
            host_permissions: ["<all_urls>"],
            action: {
                default_title: "My Extension"
            }
        },
        widgets: [ Widget ]
    },
    customManifestModules: [ ManifestModule ]
});

// TODO IMPORTANT:
//  [+] - Create reactive components (for first iteration - react) in module and process them in moduleDecorator via ReactiveComponentFactory (GPT) - !TEST!
//  [+] - Use background.js and changing the modules which depend on current URL. Modules will be linked with URLs where they are going to work via specific configuration object (GPT). It will be worked in SPA ? - !TEST!
//  [+] - Generalize interface of module
//  [+] - Change services to widgets in order to execute separated or outers modules and do their validation in provider (because our services are stored in dependency container and we don't need to store them twice)
//  [-] - Publish extension (https://www.npmjs.com/package/publish-browser-extension)
//  [-] - Use webextension-polyfill (https://www.npmjs.com/package/webextension-polyfill)
//  [-] - Create common object between scripts and popup (GPT)
//  [-] - Auto-reload extension in browser (https://stackoverflow.com/questions/2963260/how-do-i-auto-reload-a-chrome-extension-im-developing)

// Todo:
//  [-] - Change webpack to Vite
//      [-] - Rewrite logic in additionUpdater.js to separate URLs with their scripts in every content script
//      [-] - Re-use common core between modules-scripts bundles (https://stackoverflow.com/questions/26240463/how-do-i-re-use-code-between-content-scripts-in-a-chrome-extension)
//  [-] - Create template of project (https://bonsaiilabs.com/create-npx-starter-command/)

// Related projects:
// WXT: https://wxt.dev/guide/compare.html
// Plasmo: https://docs.plasmo.com/framework/storage
