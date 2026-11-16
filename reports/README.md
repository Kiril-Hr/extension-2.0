# Verification and release evidence

`release-2026-11-16/` contains the original factory integration, build, Manifest, browser and packaging evidence. It is retained to explain the release and its initial CI failures. These dated results are not a substitute for rerunning checks on current sources.

`cleanup-2026-11-16/` records the public-repository cleanup, secret/privacy scan scope, npm file list and fresh verification results. The cleanup keeps source fixtures and historical patches; it does not publish a new npm version.

The historical Manifest-conflict log has workstation paths replaced with `<workspace>` and `<user-home>`. Its original hash is recorded in the cleanup report, and the original exists in prior Git history. No error messages or failure outcomes were removed. The historical integration patch is deliberately byte-preserved.
