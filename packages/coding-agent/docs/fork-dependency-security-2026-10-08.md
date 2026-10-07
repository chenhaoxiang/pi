---
doc_type: report
project: pi
status: active
truth_mode: maintained
created: 2026-10-08
verified: 2026-10-08
verified_by: manual
ssot: true
owner: chx
---

# Dependency security maintenance

## Scope and decision

Repository: `chenhaoxiang/pi`, maintenance baseline `722fa44c70478bdb593e37722ddd45aa1a9d8cd8`. This change repairs the development workspace and the copyable sandbox example, not the running Pi installation.

A fresh raw `npm audit --json` reproduced 8 high and 1 critical findings. These are four root advisories plus dependent-package entries, not nine unrelated vulnerabilities. The owner selected remediation of the critical and six high entries, retaining the two node-forge/Gondolin high entries until an upstream fix is released. Do not add a dependency fork or claim that the remaining risk is eliminated.

## Resolutions

| Dependency path | Resolution | Advisory |
| --- | --- | --- |
| sandbox-runtime -> shell-quote | Root override `1.12.0`; duplicate the override in the standalone sandbox example manifest | [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) |
| Vitest -> Vite -> PostCSS -> source-map-js | Root override `1.2.2` | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| shx -> shelljs -> fast-glob -> micromatch -> braces | Pin shx to `0.3.4` in the root and every declaring workspace; its dependency tree does not contain braces | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |

The shx rollback is deliberate, not an unreviewed `audit fix --force`. Only `mkdir`, `cp`, `chmod` and `rm` are used here; globbed assets, recursive copy, paths with spaces and cleanup are regression-tested. The 0.4-only `--negate` and changed `sed -i` behavior are not used. Its older glob/inflight dependencies remain development-only, including their deprecation notices; this is not a general endorsement of old dependency versions. Reconsider this pin when the maintained braces chain has a verified fix.

Keep sandbox-runtime `0.0.26`, Gondolin `0.12.0`, public workspace versions and all existing test assertions unchanged. Refresh the lock without lifecycle scripts. The replacement build-tool tree also re-resolves development-only `is-core-module` and `hasown`; no new lifecycle-script dependency is introduced. The coding-agent production installer lock is unchanged and passes its generator check.

Root overrides are ignored when an example is copied and installed as a separate project. The sandbox manifest therefore carries its own shell-quote override. A fresh standalone install must confirm the resolved version and run its own audit. This does not update previously copied/installed sandbox extensions.

For a sandbox copied from the immutable `v1.0.4-fork.1` artifact, merge `"overrides": { "shell-quote": "1.12.0" }` into that copy's manifest, refresh its lock with `npm install --package-lock-only --ignore-scripts`, then reinstall with `npm ci --ignore-scripts` and verify resolution/audit before using it. A fresh unpinned copy may already resolve a fixed version through `^1.8.3`; do not infer that every old artifact copy is vulnerable, or that a new source pin has repaired an old locked installation.

## Verified results and limits

- Raw full-workspace and `--omit=dev` workspace audits both report **2 high / 0 critical** after remediation. They still exit 1; do not describe them as zero-vulnerability audits.
- Fresh standalone sandbox install resolves shell-quote `1.12.0` and reports zero vulnerabilities.
- `npm audit signatures --json` exits 0, with empty invalid/missing sets. Installs use `--ignore-scripts`.
- Eleven new dependency regressions cover all four line terminators after a comment, ordinary shell arguments, unchanged sandbox configuration APIs, bounded source-map offsets and ordinary mappings, build-tool commands and actual dependency resolution. The vulnerable quote output is never executed; the source-map denial-of-service regression runs in a heap/time-bounded child.
- `npm run check`, full `build:offline`, daemon build and installer-lock check pass. Use the existing verified release model-data snapshot, not mutable live prices.
- On macOS/Node 22, the full provider-free suite still reports two unchanged native watcher failures in `env-node-conformance.test.ts`; its focused 51-case recheck passes. An earlier overlong Unix socket fixture root also failed coordinator/listener cases; shorter independent fixtures and the subsequent full run pass those cases. Existing source and assertions are unchanged. Do not claim an all-green local native-watcher suite.
- Bind independent review and Linux CI to the exact candidate head and retain their results with the PR evidence once available. These are separate from owner-run local observations; do not claim external verification before it finishes. No reviewer private-runtime replay is implied.

## Remaining upstream debt

`@earendil-works/gondolin 0.12.0 -> node-forge 1.4.0` retains [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The registry currently publishes no fixed version; [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152) is still unmerged. The existing production-audit advisory acceptance is unchanged. A policy pass means an advisory was accepted, not fixed. Do not broaden that acceptance to other dependency paths or RSA usages.

Follow up when a fixed registry release is available: review its source/API changes, update only the affected dependency resolution, add verification-rejection and normal-certificate regressions, run raw workspace/production audits and applicable CI, and remove the existing acceptance only after it no longer matches.

## Delivery boundary

The immutable `v1.0.4-fork.1` assets, source tag, local launcher, active processes, credentials, provider routing and SAW deployment are not changed. No new release or installation is performed here. Future packaging must use a new fork revision; never replace an existing release asset. See [Fork maintenance](fork-maintenance.md) for source/release boundaries and [the installed snapshot](fork-installation-2026-10-08.md) for the existing installation.
