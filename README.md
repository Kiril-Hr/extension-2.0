# DevEx 2.0

[![npm version](https://img.shields.io/npm/v/devxtension.svg)](https://www.npmjs.com/package/devxtension)

DevEx (`devxtension`) is a TypeScript framework for building Chrome extensions with declarative modules, decorators, dependency injection and React. Its build tools turn module configuration into a Manifest V3 extension with content scripts and a background service worker.

The current public release is **devxtension@1.1.0**. [npm package](https://www.npmjs.com/package/devxtension/v/1.1.0) · [Advanced documentation](devxtension/README.md) · [Working minimal extension](examples/minimal) · [Historical v1 notes](docs/history/v1.md)

## Install and build an extension

```sh
npm install devxtension@1.1.0
```

Start with the complete [minimal example](examples/minimal): copy its files into a new project, copy `.env.example` to `.env`, then run `npm install`, `npm run typecheck` and `npm run build`. In Chrome, open `chrome://extensions`, enable Developer mode and choose **Load unpacked**, selecting the generated `dist` directory. Visit `https://example.com/` to see the module's message.

An extension project needs a `src/runner.ts` entrypoint, module sources under `src/modules/`, and TypeScript with `experimentalDecorators` enabled. The CLI commands are `devex-scripts build` and `devex-scripts dev`. The example includes the necessary package scripts and configuration.

## Public factory API

```ts
import { createExtensionFactory } from 'devxtension'
import { HelloModule } from './modules/hello'

const extension = createExtensionFactory([HelloModule])({
  params: {
    manifest: {
      name: 'DevEx hello',
      version: '1.0.0',
      description: 'A minimal DevEx extension',
      permissions: [],
      host_permissions: ['https://example.com/*'],
      action: { default_title: 'DevEx hello' }
    },
    widgets: []
  },
  customManifestModules: []
})

// Startup is automatic; keeping the controller is optional.
// extension.reSetup()
// extension.teardown()
```

`@ServiceDecorator` registers a service in the existing DI container. `@ModuleDecorator` declares a URL and either `vanilla: { mainService }` or `reactiveScripts: { type: 'react', components }`. Different modules can share services; each individual module uses one execution mode. Retrieve a service using `dependencyContainer.getService<typeof MyService>(MyService.name)`.

The returned `ExtensionLifecycle` controller reselects modules for the current URL with `reSetup()`, cleans previous module resources and preserves DI within the JavaScript context. Global `params.widgets` and `customManifestModules` initialize once, receive optional `reSetup(config)` notifications and stop at final `teardown()`. React roots are unmounted by module cleanup. Authors must release their own listeners, observers and other resources in synchronous teardown hooks.

## Manifest V3 and navigation

`params.manifest` is the primary Manifest source. The builder reads static data without executing the entrypoint; dynamic functions and arbitrary runtime expressions are unsupported. Legacy `extensionConfig.json` remains a fallback with explicit conflict diagnostics. Optional plain JavaScript backgrounds belong in `src/extensionOptions/backgrounds/`; assets belong in `src/extensionOptions/assets/`.

DevEx runtime URL rules differ from Chrome match patterns. The generator translates supported patterns and reports limitations, including Chrome's inability to restrict content-script injection to a port. Host permissions are not automatically added. Generated SPA navigation handling adds `webNavigation` where required. Live content-script contexts receive route notifications without reload; entering a matched route without an injected context can require a reload fallback.

DI is scoped to each JavaScript context, not shared between browser tabs. Teardown disposes the current instance; it does not disable the installed extension. React is supported; Vue, Svelte, a module marketplace and a starter-project generator are outside this release.

## Develop and verify DevEx

```sh
cd devxtension
npm ci
npm run build
cd ..
node tests/factory-product.cjs
node tests/factory-watch.cjs
```

The [verification workflow](.github/workflows/verify.yml) also runs real Chromium MV3 tests. See [release evidence](reports/release-2026-11-16/RELEASE.md). Existing `example/` and `test/` applications contain historical application code; they are preserved as fixtures and are not the recommended 2.0 starter. Generated extension directories and IDE state are excluded from Git.

This repository cleanup does not publish or change npm version 1.1.0. A local `npm pack` after cleanup can have a different file list from the immutable public 1.1.0 tarball; packaging improvements require a separately authorized future release.

## License

MIT, copyright Kiril-hr. See [LICENSE](LICENSE).
