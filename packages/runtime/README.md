# DevEx 2.0 — devxtension

TypeScript framework for Chrome extensions using services, DI and declarative modules.
Build the library with `npm ci` and `npm run build`; `npm pack` also rebuilds it.
The current public release is **1.1.0**. Install it with `npm install devxtension@1.1.0`.
For a complete, runnable starter example, see [examples/minimal](https://github.com/Kiril-Hr/extension-2.0/tree/main/examples/minimal).
Local packs made from unreleased cleanup changes are not a replacement for the immutable public 1.1.0 artifact.

Your project needs `src/runner.ts` and `src/modules/`.
The public factory's `params.manifest` supplies the build-time Manifest and
the runtime custom manifest modules. `extensionConfig.json` remains a legacy
fallback, not a required second copy.
Add scripts `"build": "devex-scripts build"` and `"dev": "devex-scripts dev"`.
Assets in `src/extensionOptions/assets/` and plain JavaScript backgrounds in
`src/extensionOptions/backgrounds/` are optional. Build output is `dist/`;
load that folder as an unpacked extension in Chrome.

## Development reload in the source candidate

Install a tarball built from this branch in the consumer. The published 1.1.0 CLI uses the earlier watcher. From the consumer with the candidate installed, run:

```sh
npx --no-install playwright-core install chromium
npm run dev -- --url https://example.com/
```

After the first successful compilation, the CLI opens a disposable Chromium profile. Each successful rebuild loads the unpacked extension again and refreshes the same test tab at its current URL. With no `--url`, navigate the initial blank tab to a matching page. Other tabs stay open. Type `q` and Enter or press Ctrl+C to close the session. Use `--watch-only` for compilation alone or `--headless` for automation.

Set `DEVEX_CHROMIUM_PATH` to select a compatible Chrome/Chromium executable. Managed mode requires CDP `Extensions.loadUnpacked` over a pipe. Webpack reports syntax and Manifest errors in the terminal and keeps watching. TypeScript checking remains a separate consumer command.

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

`devex-scripts dev` regenerates the manifest/background after factory manifest, config, module URL,
asset and background changes. Unknown CLI commands and build errors return a
nonzero status. No Vue, Svelte or module platform is included.


## History and license

[Historical v1 notes](https://github.com/Kiril-Hr/extension-2.0/blob/main/docs/history/v1.md) are archived separately; use the factory API above for 2.0.

MIT, copyright Kiril-hr. See LICENSE in this package. The public 1.1.0 metadata declared MIT; the license text and documentation changes in this branch require a separately authorized future release to appear on npm.
