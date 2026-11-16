# DevEx 1.1.0 release preparation

Repository: https://github.com/Kiril-Hr/extension-2.0
Branch: codex/github-npm-1.1.0
Base: 2343bf9cdb320aeff5b134a9e8273eb7de290795 (existing GitHub main).
Source: locally verified factory integration 725b3a5 and demo 6f0dc1c.

The local workspace and GitHub repository have unrelated histories and different root layouts. The PR preserves GitHub history and its existing devxtension/, example/, test/ layout. Core/build fixes were copied into devxtension/; verification paths were adapted. Original uncommitted workspace changes are excluded and preserved. The original archive is untouched.

Candidate: devxtension@1.1.0. Public registry latest was 1.0.3 on 2026-11-16; 1.1.0 is a backward-compatible feature release. Existing main/types/bin contracts remain; no restrictive exports map was introduced. Existing dependency versions remain locked. React remains optional as in the author package. npm files includes dist; prepack performs a clean build.

Packaging fix: fresh Windows checkout produced CRLF in the CLI shebang; npm installation normalized only its first newline, causing the strict package byte comparison to fail. CLI source now uses LF and .gitattributes enforces LF. The comparison was retained. Tracked stale upstream dist is removed from Git tracking; build/prepack regenerates it.

The factory API, decorators, DI, vanilla/reactive separation and lifecycle are preserved. No replacement architecture or Personal AI Tube code was added.

## Authorization and release sequence

1. Review the PR and its DevEx verification checks. Explicit author approval is required before merging. No force-push or merge is performed by preparation.
2. In GitHub repository Settings → Environments, create npm. Configure required reviewers where your GitHub plan supports them.
3. As a maintainer of devxtension on npmjs.com, open package Settings → Trusted publishing → GitHub Actions. Set owner Kiril-Hr, repository extension-2.0, workflow filename release.yml (filename only), environment npm. Enable direct npm publish if the form offers Allowed actions. Save. Do not send tokens in chat or add token secrets.
4. After approved merge, run Actions → Publish DevEx → Run workflow on main. The workflow refuses other branches, reruns verification, and publishes through OIDC with provenance. It uses a GitHub-hosted runner, Node 24 and npm 11 (npm requires >=11.5.1 for trusted publishing).
5. The post-publish step installs the exact public version into a fresh temporary project, checks strict TypeScript/public factory contracts, builds with the published CLI and verifies Manifest V3. It must pass before release is declared ready. A failed post-publish check does not undo npm publication; diagnose and release a new version rather than attempting to overwrite it.

Official setup reference: https://docs.npmjs.com/trusted-publishers/

Local npm whoami returned ENEEDAUTH. Local npm login is unnecessary for the preferred OIDC path. GitHub connector permissions and Git dry-run push confirmed repository access. npm account-side configuration has not been verified.

Until an actual registry publish and independent public install pass, 1.1.0 is a candidate and npm install devxtension@1.1.0 must not be presented as an available release. Existing npm 1.0.3 does not contain the new integration.
