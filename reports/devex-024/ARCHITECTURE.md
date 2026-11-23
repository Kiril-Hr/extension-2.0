# DEVEX-024 · Development reload

The npm CLI owns one disposable browser session per development process. Webpack still builds the extension from the consumer's `src/runner.ts` and inline Manifest. DevEx Core, factory startup, decorators, DI and SPA routing retain their existing contracts.

## Alternatives

| Approach | Bundler and MV3 background | Content scripts and SPA | Permissions and integration cost |
| --- | --- | --- | --- |
| WXT | Vite-based dev server. Its injected background client uses a WebSocket and calls `runtime.reload()` for Manifest changes. | Registers or updates scripts through the scripting API. Selects a reload strategy by entrypoint. | Dynamic injection involves scripting access. Adopting its server, entrypoint model and injected client would replace parts of the existing build. [WXT build and dev mode](https://wxt.dev/guide/resources/how-wxt-works) |
| webpack-ext-reloader | Version 1.1.13 declares Webpack ^5.61.0. Its extractor recognizes MV3 `service_worker` and expects a matching Webpack entry. DevEx writes its worker separately. | Injects reload clients and can refresh pages running the plugin. An SPA page reload loses in-memory state. Its documentation does not establish preservation of a single designated tab. | Requires a reload server and different entry wiring. The sample requests broad content-script matches. The exact extra permission requirements for a DevEx port were not tested. [Plugin](https://github.com/SimplifyJobs/webpack-ext-reloader) · [Entry extractor](https://github.com/SimplifyJobs/webpack-ext-reloader/blob/master/src/utils/manifest.ts) |
| CRXJS | Vite plugin. MV3 module worker changes trigger a full extension reload. | HMR for supported content scripts. Standalone IIFEs need a host navigation. Dev-server modules add a separate development execution path. | Static injection uses Manifest matches. The exact development permissions depend on the selected mode. Adopting Vite and its loader is outside this MVP. [Worker](https://crxjs.dev/concepts/background/) · [Content scripts](https://crxjs.dev/concepts/content/) |
| DevEx MVP | Existing Webpack 5 watch and a full unpacked install/update over Chromium's private debugging pipe. | Reloads one retained page handle at its current URL, including an SPA history URL. Other tabs receive fresh content scripts on their next normal navigation. | Zero added Manifest permissions or host grants. Only the Node CLI depends on the browser driver. |

## Build and browser lifecycle

1. `dev.js` uses the existing Webpack development configuration. Its awaited `done` hook submits the generated Manifest, background and current compilation assets only after success. In watch mode, generator validation errors become compilation errors so the watcher can observe the fix. Production keeps the existing failure behavior.
2. `reload-controller.js` serializes updates. It copies successful outputs to a session-owned unpacked directory and removes assets dropped from a later compilation. Chrome reads that directory while the next build writes to the consumer's `dist`. An error build cannot replace the files used by the active extension. Another bundler could submit an output directory and a list of successful build assets to this controller.
3. `chromium.js` starts Playwright's full Chromium in a fresh persistent context with the browser sandbox enabled. Extension debugging is enabled only on that process via a pipe. The adapter awaits `Extensions.loadUnpacked`, verifies the stable extension ID, and waits for a newly activated CDP worker version at that extension's background URL before navigating or refreshing the designated page. The adapter subscribes before requesting installation. A stopped worker can have an activated registration. [Chromium Extensions protocol](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/)
4. Closing the browser, typing `q` and Enter, or a handled termination signal stops the watcher. The controller waits for ongoing work, closes the browser/context and removes its unpacked directory. Playwright owns the temporary profile and its process tree.

## Boundaries

The initial tab is blank unless the developer supplies an HTTP(S) `--url`. Closing that tab ends the managed session. A reload discards unsaved state in the designated page; its server must support direct navigation to the current SPA route. The profile and extension ID are session-scoped. A user who needs the earlier build-only loop can select `--watch-only`.

The browser executable must support CDP extension loading. Install the Chromium version paired with the driver via `npx --no-install playwright-core install chromium`, or set `DEVEX_CHROMIUM_PATH`. No browser download runs during package installation. `--headless` uses the full Chromium binary. The development watcher uses the existing Babel transform. Semantic TypeScript checking remains the consumer's separate typecheck step.
