# DEVEX-022 · Stage 2B.1 · Safe release cutover preparation

Base: `880556b526830816223bd7f328e51535a8c345b3`. Release infrastructure: `120aa06b4567781abd6723188062a4e64c6e4ecd`. Draft [PR #8](https://github.com/Kiril-Hr/extension-2.0/pull/8).

## Release gates

The release workflow uses the reusable Windows candidate workflow for `packages/runtime`. It exercises clean build, TypeScript/public API checks, isolated npm installs, regression, CLI/watch and both Chromium MV3 suites. Ubuntu consumes the same candidate tarball, checks its SHA-256 and SRI, compares its actual file list to the packaging whitelist result and checks metadata against `packages/runtime/package.json`. Registry availability is recorded during dry run. Candidate pack paths derive the version from the selected package. The checkout keeps version 1.1.0.

Manual dispatch defaults to dry-run and is restricted to the default branch. Pull requests exercise the same dry-run jobs. Only an explicit publish dispatch on the default branch after successful verify/package can enter the npm environment with OIDC permission. That job rechecks the registry and publishes the verified tarball with provenance. Subsequent registry verification waits for availability, installs the exact version in an independent consumer, validates installed SRI against the archive, typechecks and builds its MV3 extension.

The historical protection still compares committed content against `88779392dde75602c2b37f6620df06145396a697`. It covers devxtension/, example/, test/ and verify.yml. This preparation PR explicitly changes release.yml and removes only that path from the guard. `git diff --exit-code 8877939 HEAD -- devxtension example test .github/workflows/verify.yml` returned 0. The packages/runtime diff against the Stage 2B.1 base also returned 0.

## Verification

| Check | Result |
| --- | --- |
| Local prepare-runtime-release.cjs against the tested Stage 2A artifact | Exit 0, 59 entries, devxtension@1.1.0, public registry reports existing version. |
| Local --require-unpublished on the verified artifact | Exit 1 with an explicit refusal to publish existing 1.1.0. |
| Local archive altered by one byte | Exit 1 on digest mismatch before creating release output. |
| Registry propagation regression | Exit 0, 4/4 deterministic tests for retries, fatal error, timeout and wrong version. |
| GitHub Release dry run | Candidate and package jobs succeeded, publish skipped. |

SHA-256: `9397241b85e60270f5ec5103636b303264b4961b0f125ff5cd5914e3155ca2c2`.

[Release dry run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45085189904) · [Verified release artifact](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45085189904/artifacts/14778967219) · [Historical CI on branch push](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45085170012)

## Stage 2B.2 review

- Select an unpublished semantic version and update candidate metadata, lockfile and release documentation together after author approval. The publish preflight intentionally blocks current 1.1.0.
- Verify npm Trusted Publisher for owner Kiril-Hr, repository extension-2.0, workflow filename release.yml and environment npm. The configuration must permit direct npm publish. Verify any deployment protections for the npm environment. The job uses GitHub-hosted runners, Node 24 and npm 11. [npm Trusted Publishing requirements](https://docs.npmjs.com/trusted-publishers/)
- The PR run exercises dry run with read-only workflow permissions. The OIDC exchange, provenance publication and post-publication SRI check require a future authorized real release. If registry propagation stalls after a successful publish, verify the immutable public version independently before considering a retry. Stage 2B.1 performed no publication or merge.
