# Public repository cleanup

Started 2026-11-16; completed verification 2026-11-17 (Europe/Kiev).
Branch: codex/public-repository-cleanup. PR: https://github.com/Kiril-Hr/extension-2.0/pull/3
Base: a66c533cb467c236f69d1a2d876c7312a9ca041f. No merge, force-push, version change or npm publication.

## Documentation and license

- Added the root README, a complete minimal extension installed from public npm 1.1.0, its build instructions and a verified npm version badge (HTTP 200, 1.1.0). No unverified build/license badge was added.
- Package README now refers to the actual public 1.1.0, explains factory startup/controller, decorators, DI, global participants, React cleanup, Manifest V3, static configuration, URL translation and limitations. Original v1 author notes were moved intact into docs/history/v1.md.
- Existing MIT package metadata and available license history were inspected; no LICENSE text was present. The author supplied copyright holder Kiril-hr in response to the MIT confirmation question. Added standard MIT text to root and package; did not invent a different license.

## Tracking cleanup and history retention

Removed 19 tracked files: 5 root IDE files, 4 package IDE files, 5 example/dist files and 5 test/dist files. Exact paths: removed-tracked-files.txt. git rm --cached preserved their local copies. No example source, core source, test source or fixture configuration was deleted.

Ignore rules now cover IDE state, generated output, local release worktrees, environment credentials, npm authentication files, key/cookie files and scratch test output. The non-sensitive .env.example remains trackable.

The historical integration patch and all release reports remain. patches/README.md and reports/README.md explain their scope. One Manifest-conflict log has only workstation paths normalized; the original SHA256 is recorded in audit-log-original-hash.json and original bytes remain in prior Git history. No Git history rewrite was performed. The historical patch retains its original bytes and historical local paths deliberately.

## Security findings

Gitleaks 8.30.1 was downloaded from its official release and its archive checksum verified. Redacted scans found no exposed credentials in all available refs/full Git history (15 changesets, approximately 6.38 MB of diffs), the current tracked snapshot, ignored example environment files, the actual cleanup package and the immutable public 1.1.0 package. Empty redacted reports are included. A supplemental bounded-pattern scan inspected historical blobs/current files for credential fields, private-key markers, email and workstation paths without emitting matching values.

No actual access token, API key, password, private key, authentication cookie or configuration credential was identified. No specific revocation is indicated by these results. This is a content audit, not proof that secrets never existed: unavailable/unreachable remote objects, external accounts/storage and third-party dependency internals are outside scope.

Privacy: historical workstation paths and Git author metadata remain in history. The current active browser test now resolves Playwright from an environment override or workspace-local tools. The retained historical patch still contains old workstation paths; this is documented rather than silently rewriting an archival patch. Maintainer email values and historical user paths are not repeated in this report.

Permissions: the new starter requests only https://example.com/*, with generated webNavigation validated in Chromium. The loopback factory fixture retains storage/webNavigation needed by its real tests. Legacy example/ and test/ request all_urls plus activeTab/storage/tabs/webNavigation, broader than their visible Meet route. These unverified application workflows are preserved as historical fixtures; narrowing them requires corresponding end-to-end application tests and is not claimed complete. They are not the recommended starter.

## Packaging

Ran npm pack --dry-run --json, preserving raw stdout/stderr separately because the existing prepack copy script prints before npm's JSON array. The normalized exact file list is npm-pack-dry-run.json and npm-pack-files.txt. Both the actual local tarball and the immutable public tarball were extracted and scanned.

Cleanup file list: 59 files, versus 132 in public 1.1.0. Excluded 74 internal compiled fixture/VM-test files and added LICENSE; npm-filelist-diff.json records the exact difference. Runtime JS, declarations, relative source maps, CLI, required build tools, README and package metadata remain. Package version stays 1.1.0. These source packaging improvements are not retroactively applied to the immutable public release; a future publication needs separate authorization and version selection.

The archive reports the Windows CLI mode as 0644. npm's bin-links installation makes bin targets executable on supported platforms and creates Windows shims (https://github.com/npm/bin-links/blob/main/lib/fix-bin.js). Verified the LF shebang, bin metadata and real execution through npm exec, including nonzero exit on an invalid command. Existing production builds also execute the installed CLI. No restrictive exports map or dependency/API changes were introduced.

## Verification

PASS: clean build, TypeScript noEmit, regression, lifecycle_cleanup, service_collisions, url_routing, react_mounting, react_cleanup, integration_contract, runtime-contract, manifest-conversion, factory-lifecycle, factory-manifest, npm pack, fresh independent candidate consumer install, public API types and production consumer Webpack/MV3 build. Every intended installed runtime file remains byte-compared; excluded internal fixtures are explicitly asserted absent.

PASS: dev watch regeneration, explicit conflict exit, restored production build, background VM regression; all nine real factory Chromium scenarios. PASS: minimal example public npm install, strict TypeScript, production build and real Chromium injection/SPA cleanup. Only its remote example.com document is fulfilled with deterministic HTML by Playwright; framework/Core/DI/Chrome APIs are real.

Initial verification issues were corrected transparently: npm prepack stdout required separation from its JSON; a Unix executable-bit assumption was replaced with the actual npm binary execution contract on Windows; the minimal test now waits for service-worker route-listener registration before testing SPA navigation. The first minimal attempt timed out before that readiness wait. No framework runtime was changed to make these tests pass.

The clean-checkout GitHub workflow now runs packaging checks and builds/tests the documented minimal example. This is also the definitive check that removed generated directories are not hidden build prerequisites. Local generated files remain on disk as requested.

## Remaining risks and exclusions

- No confirmed exposed credentials; scanner and Git-history scope limitations above still apply.
- Broad legacy application permissions and historical path/author metadata are retained and documented.
- The public npm 1.1.0 README/file list remains unchanged until a separately authorized release.
- Registry-propagation draft PR #2 remains separate; this cleanup does not merge it or republish 1.1.0.
- Author-owned external listeners must still be cleaned in synchronous teardown hooks; DI remains per JavaScript context. No unsupported framework features were added.
