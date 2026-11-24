# DEVEX-025 · Stage 2B.5 · Consolidated integration

The consolidated integration is tracked in [PR #17](https://github.com/Kiril-Hr/extension-2.0/pull/17). The base at review was `65a5c8bb0203aa1016630805de8d4bf950017427`. The PR merge record supplies the exact merge SHA. The [PR checks](https://github.com/Kiril-Hr/extension-2.0/pull/17/checks) and [main workflow runs](https://github.com/Kiril-Hr/extension-2.0/actions?query=branch%3Amain) record pre-merge and post-merge results. Match both to the corresponding head SHA.

## Integrated commits and evidence

| PR | Verified original head | Contribution |
| --- | --- | --- |
| [#13](https://github.com/Kiril-Hr/extension-2.0/pull/13) | `6d913c305ca261d31b61df51b5a4cdd3f03bf01b` | Typed transport and opt-in package subpath |
| [#14](https://github.com/Kiril-Hr/extension-2.0/pull/14) | `99fd5373151933c26cd3c8ba9cdd42e5edeba78b` | Packaged Chromium smoke. The original commit joins the consolidated ancestry with a tree-identical merge because `e6eb79b` already carried its changes. |
| [#15](https://github.com/Kiril-Hr/extension-2.0/pull/15) | `d5fcadb9f881baed05da3a407341112e37b20aed` | Packaged TypeScript and MV3 verification, JSON shape correction and cleanup regression coverage |
| [#16](https://github.com/Kiril-Hr/extension-2.0/pull/16) | `3ab56aa1afe277854dd019a329442447055b3b37` | Watch-test stabilization and first-request diagnostics |
| [#17](https://github.com/Kiril-Hr/extension-2.0/pull/17) | `ceddb861b007d9062b1d072e229b6fc6eb43ccc6` | Native and Typed comparison with controlled CPU load, stopped workers and plain Chromium |

The [performance audit](STAGE_2B_PERFORMANCE.md) came from local commit `4d3c916`. The [receiver capacity investigation](STAGE_2B_CAPACITY.md) and its mock-based fixture came from `dfa4f94`. Both commits were cherry-picked with source provenance. The capacity fixture lives in the reports directory, outside the runtime package and CI entry points.

## Accepted limitations

- The default five-second timeout settles the client locally. The remote outcome may be unknown, and a handler may execute after the client has timed out.
- The transport performs no automatic retry or replay. Application retries of side-effecting commands need an explicit idempotency policy.
- Receiver admission slots remain occupied until the actual handler promise settles or the realm exits. Client timeout, abort and endpoint disposal do not release active work.
- Chromium 141 can miss the deadline under sustained CPU contention with either Native or Typed messaging. The tested Chrome 158 configuration passed the corresponding matrix. [Stage 2B.2D evidence](STAGE_2B_2D.md)
- Receiver cancellation and validation optimization remain separate backlog items. Further measurement should establish realistic callback retention and CPU headroom across supported desktop configurations.

## Integration verification

Candidate CI, Historical CI and the PR-triggered release dry run must succeed on the consolidated head. The dry run verifies and packages the candidate with the publish job skipped. Post-merge Candidate and Historical runs must test the merge SHA. If a post-merge release run is dispatched, its only mode is dry-run.

The Stage 2B production tree is identical to the previously verified PR #17 baseline. The diff against the original main adds the Messaging transport and its package exports while retaining the existing Core, factory API, permissions, release workflow, historical directories and npm version.

## Stage 2C scope

The approved implementation plan identifies worker-build and content ownership as the next integration boundary. Bring an opt-in worker entry and synchronous registration into the existing generators. Retain legacy background fragments, track the worker asset and imports in the production and Dev Reload Webpack snapshots, and bind widget-based content registrations to existing lifecycle ownership. Share contract types across realm entrypoints. Verify an independent installed consumer, equivalent Manifest scope for factory-only consumers, one receiver per realm, worker isolation from DOM imports, and one route handler after repeated reSetup. [Implementation plan](IMPLEMENTATION_PLAN.md)

Stage 2C requires separate authorization. Receiver cancellation, validation optimization, route-aware bundling, shared Core bundles, module registry analysis, Manifest single-source-of-truth work and DEVEX-020 fall outside this scope.
