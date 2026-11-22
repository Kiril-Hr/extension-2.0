# Minimal DevEx 2.0 extension

This example uses the public npm release `devxtension@1.1.0` and the current factory API.

1. Copy this directory into a new project.
2. Copy `.env.example` to `.env`. No variables are required; this avoids the legacy dotenv loader's missing-file message.
3. Run `npm install`, `npm run typecheck`, then `npm run build`.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select `dist/`.
5. Visit `https://example.com/`. The page displays **Hello from DevEx 2.0**.

`npm run dev` watches source changes. The example owns only its inserted element and removes it during module teardown. It requests access to `https://example.com/*`; DevEx adds `webNavigation` for SPA route handling. No storage or all-sites permission is requested.

The source in `src/modules/hello.ts` demonstrates a decorated service, URL module configuration and DI access during cleanup. `src/runner.ts` automatically starts the extension using `createExtensionFactory(modules)(config)`. See the [root README](../../README.md) for lifecycle and Manifest limitations.
