---
doc_type: runbook
project: pi
status: active
truth_mode: maintained
created: 2026-10-07
updated: 2026-10-08
ssot: true
owner: chx
---

# Maintained Pi fork

## Source and versions

- Fork: `chenhaoxiang/pi`; community: `earendil-works/pi`.
- `main` is our reviewed maintenance/release branch. The first release is based on community tag `v1.0.4`, commit `7c10bd4337495ee613f2224843ecdf349b80d1df`.
- `upstream-main` is a pure community mirror. The initial fork's 40 post-release community commits were preserved on this mirror, not included in the first maintenance baseline. Update it only by fast-forward; preserve divergence instead of force-pushing.
- Configure `upstream` as read-only, with push URL `DISABLED`. Community synchronization and fork release changes require isolated branches, tests, independent review and normal PR merges.
- Public workspace packages share `1.0.4-fork.1`. Future releases retain `<community-base>-fork.<positive revision>` naming and immutable v-prefixed tags.

## Disconnect recovery

Problem: an upstream/proxy may report `stream error: stream disconnected before completion: stream closed before response.completed`. Community 1.0.4 did not classify this as transient, even when automatic retry was enabled.

The fork adds only `stream disconnected before completion` and `stream closed before response.completed` wording to the existing classifier. The period in `response.completed` is literal. It retains the existing retry budget/backoff, quota exclusions, cancellation handling and context-overflow handling.

A failed assistant attempt remains in raw history but is omitted from subsequent model projection. Completed tool results remain; partial tool calls in the failed response are not executed. A synthetic session regression verifies these boundaries.

This repairs recovery, not the upstream transport. It does not change provider routing, model limits, compression thresholds or total-request/idle timeouts, and does not prove that 700k-token production requests are reliable.

## Validation

1. Hydrate public model catalog data using the versioned source generator, then run `npm run check` and `npm run build:offline`. No handwritten generated-model changes or dependency upgrades are needed.
2. Build the environment daemon with `npm run build:daemon --workspace packages/env` before the full suite.
3. Run `./test.sh` with an independent temporary root outside source/package resolution and daily project configuration ancestry. The wrapper starts with an empty environment, synthetic HOME and no provider credentials. It bounds Vitest to two workers to keep native filesystem watcher timing predictable under load. Never weaken assertions to accommodate a polluted fixture root.
4. Run new disconnect/classifier, session/tool-recovery and installer-lock regressions, retaining existing tests unchanged.
5. Build/pack and validate the Node consumer outside the repository. Check both bundled CLI and SDK versions. For the local macOS binary, freshly rebuild compiled assets at the exact clean committed release HEAD, then use `build-binaries.sh --skip-install --skip-build --platform darwin-arm64` and verify startup separately. Record that same-HEAD build command/exit status with the artifact hashes; version metadata alone is not binary-to-source proof.
6. Review the exact commit and run applicable CI before merge/release. Record platform/request smoke tests separately from provider-free tests; do not infer real long-context reliability from synthetic fixtures.

Fork CI hydrates provider data from the immutable `v1.0.4-fork.1` pi-ai release asset, verifies its pinned SHA-256, and runs `build:offline` plus every existing check and test. This prevents an unrelated docs PR from changing test input through live catalog/pricing drift. Community CI retains its live generator. Catalog updates remain explicit generator changes: review the resulting metadata and update the CI snapshot pin deliberately when releasing it. Do not edit generated prices or weaken assertions to make a live catalog pass. The pin does not change runtime catalog refresh behavior or retroactively alter the published release.

## Distribution

Do not run `release:patch`, `release:minor` or `npm publish` against the community namespace. Do not write community pi.dev/R2 release markers. Community publication jobs are repository-identity guarded; this fork uses GitHub Release artifacts.

After building, run `node scripts/pack-fork-release.mjs --out <new-directory-outside-checkout> --binary <tested-native-archive>` from a clean committed source. `--candidate` is only for local validation and emits no source/release provenance. This command composes the existing `packReleasePackages` and consumer smoke helpers and installs with local tarball overrides. This prevents accidentally resolving community dependencies for an unpublished fork version. Generated installer locks use fixed GitHub Release URLs when `piConfig.forkRepository` is declared; ordinary community locks retain registry URLs and all external dependency pins.

Every release includes the 13 public workspace tarballs, Node consumer archive, tested local binary archive, installer-lock pair, source provenance and `SHA256SUMS`. The tested native archive in this release is macOS ARM64; Windows has no native-archive acceptance in this fork packer and would require separately verified Node consumption. Downloaded release assets and checksum entries use flat filenames; the Node consumer archive also retains its internal tarballs directory for local overrides. A release manifest records repository, version, v-tag, exact source commit, community baseline and tarball SHA-256. Publish assets only after source review/CI; download them afresh and verify their checksums before installation. Never replace an existing tag or published asset. Fork workspace entries in the generated installer lock do not contain npm integrity hashes; verifying the downloaded manifest and complete `SHA256SUMS` before installing is mandatory, not an optional substitute for source version matching.

## Installation and rollback

Do not use the community `pi update`/`pi update --self` or pi.dev installer for a fork. Use pinned releases from this fork; `PI_SKIP_VERSION_CHECK=1` can suppress the inherited community notice in source/preparation builds. The final recovery/validation follow-up disables the community release query/banner for canonical maintained fork versions, and refuses self-update before any installer/package-manager command, including --force. Explicit extension updates stay separate; this is not an automatic fork updater.

Install into a permanent versioned user-owned directory and change only the default launcher after verification. Preserve the prior launcher target and installation; do not replace files beneath running Pi processes. Do not change provider credentials or unrelated extension configuration.

Before switching, verify installed extension compatibility. In particular, older pi-subagents host-alias checks reject fork-version strings and need the maintained strict-fork host recognition fix; arbitrary beta/unknown versions must remain fail-closed.

Rollback restores the saved launcher target and, if changed, the previous pi-subagents package declaration. A disk update is not proof that an active process has reloaded. Restart a Pi session only when its work is settled.

The [1.0.4-fork.1 installed snapshot](fork-installation-2026-10-08.md) records the performing owner's release/runtime attestation separately from this maintained contract.

SAW may associate the core installation with its package repository and fixed release manifest/tag. Such a reference is not a full installed-file integrity proof or a claim that every active process is running the new version.
