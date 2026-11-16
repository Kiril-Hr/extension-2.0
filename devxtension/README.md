# DevEx 2.0 — devxtension

TypeScript framework for Chrome extensions using services, DI and declarative modules.
Build the library with `npm ci` and `npm run build`; `npm pack` also rebuilds it.
Install the resulting `devxtension-1.0.3.tgz` in your extension project.

Your project needs `src/runner.ts` and `src/modules/`.
The public factory's `params.manifest` supplies the build-time Manifest and
the runtime custom manifest modules. `extensionConfig.json` remains a legacy
fallback, not a required second copy.
Add scripts `"build": "devex-scripts build"` and `"dev": "devex-scripts dev"`.
Assets in `src/extensionOptions/assets/` and plain JavaScript backgrounds in
`src/extensionOptions/backgrounds/` are optional. Build output is `dist/`;
load that folder as an unpacked extension in Chrome.

Legacy `extensionConfig.json` (needed only when the entrypoint has no factory manifest):

```json
{
  "name": "DevEx example",
  "version": "1.0.0",
  "description": "Example extension",
  "action": { "default_title": "DevEx" },
  "host_permissions": ["https://example.com/*"]
}
```

Example `src/modules/hello.ts`:

```typescript
import { ServiceDecorator, ModuleDecorator } from 'devxtension';

@ServiceDecorator
class HelloService {
  run() { console.log('DevEx module started'); }
}

@ModuleDecorator({
  url: 'https://example.com/*',
  vanilla: { mainService: HelloService }
})
export class HelloModule {}
```

Example `src/runner.ts`:

```typescript
import { createExtensionFactory, Module, IManifestModule, ManifestParams, extensionConfigType } from 'devxtension';
import { HelloModule } from './modules/hello';

class Widget implements Module {
  setup() { /* initialize shared functionality */ }
  reSetup(config: extensionConfigType) { /* optional route notification */ }
  teardown() { /* release owned listeners/observers */ }
}
class ManifestModule implements IManifestModule {
  setup(manifest?: ManifestParams) { console.log(manifest?.name); }
  reSetup(config: extensionConfigType) { /* optional route notification */ }
  teardown() { /* release owned resources */ }
}

const extension = createExtensionFactory([HelloModule])({
  params: {
    manifest: {
      name: 'DevEx example', version: '1.0.0', description: 'Example extension',
      permissions: ['storage'], host_permissions: ['https://example.com/*'],
      action: { default_title: 'DevEx' }
    },
    widgets: [Widget]
  },
  customManifestModules: [ManifestModule]
});
// Startup is automatic. Keeping this returned controller is optional.
// extension.reSetup();   // select modules for the current URL again
// extension.teardown();  // dispose this instance and its owned resources
```

The builder reads static manifest data without executing the entrypoint.
Inline objects, local constants, relative JSON and TypeScript constants are
supported. Executable/dynamic manifest expressions fail explicitly.
When a legacy JSON also exists, conflicting values fail the build; legacy-only
fields remain available with migration diagnostics. `widgets` and
`customManifestModules` are optional.

Enable `experimentalDecorators`, `esModuleInterop` and `jsx: "react"` in
TypeScript. Public types are exported from `devxtension`.
`dependencyContainer.getService<typeof MyService>(MyService.name)` retrieves a
singleton. DI survives `ExtensionCoreModule.reSetup()`.

The factory controller delegates route cleanup/recreation to this existing Core.
Global widgets and custom manifest modules run setup once, receive optional
reSetup notifications with the filtered configuration, and stop at final teardown.
Their content-script scope includes the already declared host_permissions, so
globals also start on permitted pages with no active route. No host permission
is added for this purpose. Without declared hosts they are limited to module
URL scopes; a configuration with neither scope fails explicitly.
Shared global/module widgets initialize once while at least one owner is active.
Module-only widgets stop when the last route owner leaves. Lifecycle hooks are
synchronous. Authors release their own external resources in teardown hooks.
Calling teardown twice is safe; calling reSetup after teardown throws. Reusing
one curried factory to configure again first tears down its previous instance.
DI remains the existing singleton container per JavaScript context; teardown
does not clear registrations belonging to other extension instances.

In Chrome, background route notifications and popstate/hashchange trigger factory
reSetup without reloading an already active content-script context. Notifications
for the same URL are deduplicated. First SPA entry into a matched route from an
uninjected page uses a tab-reload fallback. Teardown disposes the current factory
instance; it does not uninstall or disable the Chrome extension.

A module is **either** vanilla **or** `reactiveScripts: {type:'react', components:[View]}`.
React TSX is supported. Different modules can share DI services. React roots
are unmounted by module teardown; module authors release their own listeners
and observers in `teardown()`. With the lower-level `ExtensionCoreModule`, use
`ExtensionConfig` to select modules for the current URL before `setup()`.

DevEx runtime URL rules remain separate from Chrome match patterns: `*.domain`
excludes the root domain, `/` selects all paths, a final `*` selects a path
prefix, query/hash are ignored, and protocol/port must match. The generator
converts these rules and reports limitations. Chrome cannot restrict ports;
default-port patterns therefore produce an explicit injection warning and
runtime filtering remains necessary. Explicit non-default ports and path
patterns that cannot be translated safely fail the build. Root exclusions
that overlap another module are reported explicitly. Host permissions are
never automatically added. `webNavigation` is added only for generated URL
navigation handling. Module URLs must be string literals or local constants;
unsupported dynamic/imported URL expressions fail explicitly.

`dev --watch` regenerates the manifest/background after factory manifest, config, module URL,
asset and background changes. Unknown CLI commands and build errors return a
nonzero status. No Vue, Svelte or module platform is included.

## Historical v1 notes (not the current API reference)

# How to use app application and create a new functionality easier

# How does it work

  Architecture of the extension based on `module-controller-service` architecture, but it was decided to get rid of controllers because their part of functionality overloads the main logic.
  First of all, you need to understand the runner file is main file with logic of running the application.
  There you can see decorator `@ExtensionConfig` which serves in order to select needed module for current URL while app is working in browser.
  All modules are in `modules/index.ts` where they export to runner.ts in config object which contains modules which extension is going to use on the webpages.
  You don't need to change or modify this main module.
  Your modification and changes have to be in modules directory.
  Modules from `modules/index.ts` is running by `ExtensionCoreModule` which is the point of running selected module or modules.
  
### 1. Create a new module:

  1. Go to module file and create new directory which has to be called as the main file of your new module in it.\
  2. Use decorator whose name is ModuleDecorator. There you need to put your services and the function of running your module logic in the params object.\
  3. There is another option which is called `executors`. It proposes to execute in browser additional logic of your module, besides your main function of running.\
  4. Create a directory types and there create file using name of your module without part of "Module" and instead write "Interfaces" and another one which is "Types" in name instead of "Module".\
    4.1 In interfaces file create `AllInterfaces` interface where put a property object which contains properties of all interfaces for services in your module. Property name must be equal to name of interface.\
    4.2 All interfaces have to extend `GeneralServiceInterface`.\
  5. Put in generic type AllInterfaces property object interfaces.\
  6. After all operation when your module is ready for testing you need to export it to module/index.ts and put in array of modules.\

### 2. Create a new service:

  1. When you created your module directory and module of functionality, or you want to add a new service to existing module, go to services directory or create the service directory.\
  2. There create a new class and name it using name of module to which it belongs. Replace a part of name module with services in order to indicate its functionality purpose. (Module to Service)\
  3. The class has to implement appropriate interface from directory types/[...Interfaces]\
  4. if your service has a lot of logic divide it into parts in other services and use injection to include that parts to your main service.\
  
## How to use with one bundle or how you can run the app
  
  1. Go to `package.json`, and you will see build script and dev script.\
  2. The first run build version, after use dev version to develop.\ 

## About core part
    
  ### Core uses decorators whose logic described in files, but you can see it if you hover cursor over decorator name.
  ### If you want to add a new logic to core you need to notice team lead of extension about your plans.
