---
doc_type: runbook
project: pi
status: active
truth_mode: maintained
created: 2026-10-07
updated: 2026-11-10
ssot: true
owner: chx
---

# Maintained Pi fork

## Source and versions

- Fork: `chenhaoxiang/pi`; community: `earendil-works/pi`.
- `main` is our reviewed maintenance/release branch. The `1.5.2-fork.1` source candidate integrates exact community tag `v1.5.2`, commit `b4afdddf44e059c67ccf5097e5317d913521b470`, while retaining fork retry, transport, security and update-channel safeguards. Later community-main commits are not included. Prior fork releases remain immutable rollback history.
- `upstream-main` is a pure community mirror. The initial fork's 40 post-release community commits were preserved on this mirror, not included in the first maintenance baseline. Update it only by fast-forward; preserve divergence instead of force-pushing.
- Configure `upstream` as read-only, with push URL `DISABLED`. Community synchronization and fork release changes require isolated branches, tests, independent review and normal PR merges.
- The 11 public workspace packages share `1.5.2-fork.1`. This source candidate retains the run-scoped scheduled execution and compaction host contracts; release publication, installed payloads and loaded sessions remain separate evidence. The existing `1.5.0-fork.4` SDK and immutable release assets must remain available. Future releases retain `<community-base>-fork.<positive revision>` naming and immutable v-prefixed tags.

Platform protection for the maintenance and mirror refs is specified in [branch protection](fork-branch-protection.md). Its rollout does not publish or hot-reload a release.

## Disconnect recovery

Problem: an upstream/proxy may report `stream error: stream disconnected before completion: stream closed before response.completed`. Community 1.0.4 did not classify this as transient, even when automatic retry was enabled.

The fork adds only `stream disconnected before completion` and `stream closed before response.completed` wording to the existing classifier. The period in `response.completed` is literal. It retains quota exclusions, cancellation handling and context-overflow handling; the current retry budget/backoff defaults are described below.

A failed assistant attempt remains in raw history but is omitted from subsequent model projection. Completed tool results remain; partial tool calls in the failed response are not executed. A synthetic session regression verifies these boundaries.

This repairs recovery, not the upstream transport. It does not change provider routing, model limits, compression thresholds or total-request/idle timeouts, and does not prove that 700k-token production requests are reliable.

## Rate-limit help URLs (1.5.0-fork.2)

Transient TPM/RPM throttles can include a billing help URL even when the account has not exhausted its quota. Retry classification ignores HTTP/WebSocket URL contents before testing error keywords, so `/account/billing` cannot turn a throttle into a terminal account-limit error. A nonempty URL marker retains transport wording such as `request to <url> failed, reason:`; raw diagnostics and retry-event messages remain unchanged.

Actual quota/billing exhaustion, subscription limits, cancellation and context-overflow handling remain intact. This does not make every HTTP 429 retryable or change the retry budget, stepped delays or consecutive-error circuit breaker.

## Codex response phase guard

Codex requests now use a separate pre-response deadline, defaulting to 120 seconds: SSE waits for response headers, while WebSocket waits for its first protocol event. This bounds a request stuck before the provider acknowledges it without applying a total runtime limit after that acknowledgement, so long model thinking remains valid. The existing agent-level automatic retry budget and stepped backoff are unchanged; timeout errors remain transient retry candidates and include redacted phase timing diagnostics (`waiting_response_headers`, `waiting_first_event`, or `streaming`). Set `retry.provider.responseHeadersTimeoutMs` to `0` only when a route deliberately needs an unbounded pre-response wait.

## Stepped retry defaults (1.4.0-fork.2)

Agent retries default to 600 attempts, excluding the initial request. At the default `baseDelayMs: 1000`, intervals are 1, 3, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 30, 35, 40, 50, 60, 70, 80, 90, then 100 seconds; later intervals stay at 100 seconds. `maxAgentDelayMs` defaults to 100000. A consecutive-equivalent-error circuit breaker defaults to 12 failures (the first failed attempt counts) and stops a persistent identical outage before the 600-attempt budget spins; set `retry.maxConsecutiveSameErrorRetries` to `0` only when that guard is deliberately not wanted. The shared helper also applies to compaction and branch-summary retries. Existing explicit settings override defaults; no installation step should silently rewrite provider/model or retry settings. See [settings](settings.md#network-and-retries).

Success, cancellation and non-retryable error handling are unchanged. The complete 600-retry success/exhaustion paths and cancellation during a 100-second sleep are covered by faux-provider tests with virtual time; no paid provider calls are needed. These tests prove local behavior, not upstream availability. Source merge, immutable Release publication, fresh-download checksum validation and installed loading remain separate acceptance steps.

## Native scheduled execution

The additive `session.scheduledExecution` / optional `ctx.scheduledExecution` capability v1 binds one scheduled custom turn to exact job/attempt/session/epoch/revision metadata. It applies finite run-only retry/elapsed budgets, native safe-boundary checkpoints and acknowledged closure without changing global retry settings or requiring a successful final model summary. Cancellation keeps ownership until native tools and explicitly owned handles actually close; persistence failure holds attention rather than authorizing replay. Existing `ctx.abort(): void` and ordinary interactive work remain separate. See [SDK contract](sdk.md#native-scheduled-custom-turns).

The additive `unattendedInputGuardVersion=1` lets the exact native run protect direct/nested/late-registered questions before extension tool hooks. A cooperating scheduler can detach only its own legacy guard while that exact capability owns the turn, avoiding false hook effects on builtin reads without exempting arbitrary third-party callbacks. Missing capability or uncertain identity retains the legacy guard.

This is a source/synthetic capability slice of the Schedule-owned `resilient-serial-scheduling` Change, not evidence that new releases, loaded sessions, schema4 migration or natural/business acceptance are complete. Do not enable a resilient Schedule job on an unsupported host or force-reload an active session.

## Validation

1. Hydrate public model catalog data using the versioned source generator, then run `npm run check` and `npm run build:offline`. No handwritten generated-model changes or dependency upgrades are needed.
2. Build the environment daemon with `npm run build:daemon --workspace packages/env` before the full suite.
3. Run `./test.sh` with an independent temporary root outside source/package resolution and daily project configuration ancestry. The wrapper starts with an empty environment, synthetic HOME and no provider credentials. Vitest and Node test runners are bounded to two workers to keep native filesystem watcher timing predictable under load. Never weaken assertions to accommodate a polluted fixture root.
4. Run new disconnect/classifier, session/tool-recovery and installer-lock regressions, retaining existing tests unchanged.
5. Build/pack and validate the Node consumer outside the repository. Check both bundled CLI and SDK versions. For the local macOS binary, freshly rebuild compiled assets at the exact clean committed release HEAD, then use `build-binaries.sh --skip-install --skip-build --platform darwin-arm64` and verify startup separately. Record that same-HEAD build command/exit status with the artifact hashes; version metadata alone is not binary-to-source proof.
6. Review the exact commit and run applicable CI before merge/release. Record platform/request smoke tests separately from provider-free tests; do not infer real long-context reliability from synthetic fixtures.

Fork CI uses the same credential-free `./test.sh` wrapper, including its two-worker bound; community CI retains direct `npm test`. This keeps every test and assertion while avoiding unbounded worker pressure on GC and child-process fixtures.

Fork CI hydrates provider data from the immutable community `v1.5.2` source release asset, verifies SHA-256 `da14b72e5d674959b64fc541e4a9241ac9fcdfa243431479119d3edb598b2231`, and runs `build:offline` plus every existing check and test. This explicit catalog refresh includes the 1.5.2 model metadata; do not retain an older catalog while claiming full 1.5.2 model support. This prevents an unrelated docs PR from changing test input through live catalog/pricing drift. Community CI retains its live generator. Catalog updates remain explicit generator changes: review the resulting metadata and update the CI snapshot pin deliberately when releasing it. Do not edit generated prices or weaken assertions to make a live catalog pass. The pin does not change runtime catalog refresh behavior or retroactively alter the published release.

## 1.5.2 synchronization notes

The candidate merges the exact stable tag into maintenance history (395 community commits since v1.5.0), not unpublished community main. All 11 public packages and internal registry pins use `1.5.2-fork.1`; root and fork-URL installer locks are regenerated. Fork CI retains the protected `build-check-test` and `mcp-conformance` producers rather than splitting the required test producer into optional parallel jobs. No community publication channel is enabled.

Chord v2 moved from `next` / `next-node` to the root / `node` source paths. The stale-lock and protocol-close fixes overlap community equivalents; the fork's pending-discovery/dependency-install protection is combined with upstream file-move rebuild detection. The upstream ordinary-prompt preflight reservation also excludes native scheduled admission until the ordinary prompt releases it. Existing retry, scheduled-input and compaction tests remain authoritative; no installed Schedule/Compaction runtime is changed by this sync.

Undici remains exactly `8.12.3`; no undici update is performed. The catalog is the source-owner-generated v1.5.2 snapshot, not handwritten metadata or a live pricing refresh. Local macOS fixture timing and Node/npm-version validation limits must be recorded with actual commands; Linux exact-head CI is separate from future clean same-HEAD native/Node artifact builds. This stage neither merges the PR nor publishes, installs or activates a runtime.

Local preparation passes `npm run check`, `build:offline`, the two-job daemon build, p2's separate check and 63 focused fork regressions. The first full macOS `./test.sh` attempt is not a pass: it reports Chord filesystem-watch failures and reaches the command's 900-second bound during coding-agent tests. A minimal fresh-directory `fs.watch` probe receives no create/write events on either Node 22.23.2 or 26.13.0 on that host. Node 26/npm 12 additionally fails Chord's git-install and `npm pack --json` fixtures; the unchanged 14-test install file passes on Node 22/npm 10. Keep these limits distinct from exact-head Linux CI and later native acceptance; no assertions are disabled.

The regenerated coding-agent installer lock's audit reports zero findings. The whole workspace audit still reports two high findings through the retained sandbox example's `sandbox-runtime` / nested Zod 3 path (`GHSA-mrhx-c7xc-m3w5`); the advisory offers no patched Zod 3 release. No cross-major override, advisory suppression or claim of a fully remediated sandbox is introduced by this sync.

## 1.5.0 synchronization notes

The new pi-schema workspace is included in exact dependency pins and fork-owned installer assets. The maintained sandbox example and its security fixtures remain available even though community 1.5.0 removed that example; shx remains development-only for the existing security regression. Undici 8.12.3 retains the community runtime update after review of its HTTP/2 timeout-connection and queued-request async-context fixes. The development Vite override, lock and clean installation are aligned at community 8.3.4 after review of its HMR, preload, CSS, watcher and non-major dependency changes.

Provider-free macOS validation exposed ENOTSOCK stale lock handling and a WebSocket close frame discarded by an immediate terminate. The fork retains fail-closed stale-lock behavior and preserves an already-started protocol close (including 1009). Plugin installs refresh pending discovery metadata. Darwin fixture writes allow queued file events to settle before taking snapshots; assertions are unchanged. Use a real, non-symlink temporary root such as `/private/tmp` for path-sensitive fixtures. Source, CI, release, download and installed loading are verified separately; these notes do not claim publication or active-session activation.

## Dependency security maintenance

Review the [dependency security record](fork-dependency-security-2026-10-08.md) when refreshing the development lock or copying the sandbox example. Its two node-forge/Gondolin high findings describe that historical dependency tree. The 1.5.0 candidate's Gondolin 0.14.0 update removes the old node-forge path; that is not a zero-vulnerability claim for other dependencies or proof that old installations changed. Raw audits and accepted-advisory policy results are different. Source maintenance does not overwrite the installed immutable release.

## Distribution

Do not run `release:patch`, `release:minor` or `npm publish` against the community namespace. Do not write community pi.dev/R2 release markers. Community publication jobs are repository-identity guarded; this fork uses GitHub Release artifacts.

After building, run `node scripts/pack-fork-release.mjs --out <new-directory-outside-checkout> --binary <tested-native-archive>` from a clean committed source. `--candidate` is only for local validation and emits no source/release provenance. This command composes the upstream `produceArtifactSet`, `installConsumer` and consumer smoke helpers and installs with local tarball overrides. It copies content-addressed build tarballs to the canonical release filenames expected by the fork installer lock; both refer to the same bytes. This prevents accidentally resolving community dependencies for an unpublished fork version. Generated installer locks use fixed GitHub Release URLs when `piConfig.forkRepository` is declared; ordinary community locks retain registry URLs and all external dependency pins.

Every release includes the 11 public workspace tarballs, Node consumer archive, tested local binary archive, installer-lock pair, source provenance and `SHA256SUMS`. The tested native archive in this release is macOS ARM64; Windows has no native-archive acceptance in this fork packer and would require separately verified Node consumption. Downloaded release assets and checksum entries use flat filenames; the Node consumer archive also retains its internal tarballs directory for local overrides. A release manifest records repository, version, v-tag, exact source commit, community baseline and tarball SHA-256. Publish assets only after source review/CI; download them afresh and verify their checksums before installation. Never replace an existing tag or published asset. Fork workspace entries in the generated installer lock do not contain npm integrity hashes; verifying the downloaded manifest and complete `SHA256SUMS` before installing is mandatory, not an optional substitute for source version matching.

## Installation and rollback

Do not use the community `pi update`/`pi update --self` or pi.dev installer for a fork. Use pinned releases from this fork; `PI_SKIP_VERSION_CHECK=1` can suppress the inherited community notice in source/preparation builds. The final recovery/validation follow-up disables the community release query/banner for canonical maintained fork versions, and refuses self-update before any installer/package-manager command, including --force. Explicit extension updates stay separate; this is not an automatic fork updater.

Install into a permanent versioned user-owned directory and change only the default launcher after verification. Preserve the prior launcher target and installation; do not replace files beneath running Pi processes. Do not change provider credentials or unrelated extension configuration.

Before switching, verify installed extension compatibility. In particular, older pi-subagents host-alias checks reject fork-version strings and need the maintained strict-fork host recognition fix; arbitrary beta/unknown versions must remain fail-closed.

Rollback restores the saved launcher target and, if changed, the previous pi-subagents package declaration. A disk update is not proof that an active process has reloaded. Restart a Pi session only when its work is settled.

The [1.0.4-fork.1 installed snapshot](fork-installation-2026-10-08.md) records the performing owner's release/runtime attestation separately from this maintained contract.

SAW may associate the core installation with its package repository and fixed release manifest/tag. Such a reference is not a full installed-file integrity proof or a claim that every active process is running the new version.
