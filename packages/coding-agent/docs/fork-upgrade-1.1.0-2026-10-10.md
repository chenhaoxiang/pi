---
doc_type: report
project: pi
status: active
truth_mode: maintained
created: 2026-10-10
updated: 2026-10-10
ssot: true
owner: chx
---

# Pi 1.1.0-fork.1 upgrade

## Source and retained boundaries

The owner authorized upgrading the maintained fork and the local installation to `1.1.0-fork.1`. Merge exact community `v1.1.0` (`abe508e1b89912adde45528136c3221eb69acdd7`) into maintenance `main`; do not include later unreleased community commits. Preserve the merge ancestry and previous immutable `v1.0.4-fork.1` assets.

All 13 public packages and their internal dependency specifiers use `1.1.0-fork.1`. Retain bounded Responses disconnect retry, exclusion of abandoned partial responses/tool calls, community self-update refusal/banner suppression, fork installer GitHub URLs and community publication identity guards. Retain shell-quote/source-map-js overrides and the standalone sandbox override. Community 1.1.0 independently adopts the existing shx 0.3.4 security pin. No provider credentials, routing, session history or extension package declarations change.

## Integration adaptations

Upstream removed `coding-agent-consumer.mjs`. The fork packer now uses its replacements: `produceArtifactSet`, `installConsumer`, `smokeTestNpmConsumer` and `smokeTestCodingAgent`. Candidate artifact metadata has `source: null`; only a clean committed production pack emits release source provenance. Content-addressed artifacts are copied byte-for-byte to canonical flat release filenames required by the installer lock; the Node consumer resolves every internal package through those local tarballs. Three new guard regressions detect broken helper imports and validate the existing binary/output/options boundaries. A complete candidate pack verifies real package consumption outside the checkout.

Pi 1.1.0 requires the concrete timed assistant stream. The synthetic disconnect regression uses `createAssistantMessageEventStream`; its recovery, projection and exactly-once tool assertions remain unchanged. No upstream tests are weakened.

CI and local builds use the model-data directory from the immutable community source release `pi-1.1.0-source.tar.gz`, SHA-256 `63b17b48b855e36e64c5013523acd48131ffcfa90ae48fe2f3e6fa9fe3d0da32`. This includes 1.1.0 classifier/model metadata without mutable live catalog drift. Existing generated model source is not hand-edited.

## Local validation

- Node 22.23.2: full `npm run check`, offline package build, daemon build and installer-lock check passed.
- Fork/script focused regressions: 21 passed. Candidate package pack, SDK import policy smoke and bundled/unbundled CLI version checks passed; all 13 public tarballs exist at the new fork version.
- Full isolated `./test.sh`: 62 script tests passed; coding-agent 2746 passed / 50 provider-dependent skips; AI 1339 passed / 864 provider-dependent skips. Other package suites passed except the unchanged macOS watcher/SSH fixtures below.
- The initial missing-fd failures were test PATH setup, not a code regression; including the existing fd/rg binaries made every coding-agent test pass without source/assertion changes.
- macOS full suite remains nonzero: one Node watcher case, one daemon watcher case and six localhost SSH fixture cases failed in the second run. SSH connections reset during handshake with the system sshd; watcher event delivery is timing-sensitive. The daemon/SSH source and tests match community 1.1.0 (and the earlier baseline) byte-for-byte. Do not claim an all-green macOS full suite. Release requires the exact candidate's independent review and applicable Linux CI, recorded in its PR.
- Raw workspace audit: 2 high / 0 critical, unchanged node-forge/Gondolin advisory `GHSA-86w9-cpqp-85rv`; it still exits 1. Registry signature audit exits 0 with no invalid/missing signatures. The accepted advisory is not fixed.

## Release and installation acceptance

[PR #5](https://github.com/chenhaoxiang/pi/pull/5) normally merged to release source `c03cd2ced58f1d8b6865abeca9b31e4f2b34c634`. Final candidate `0358d9a9e8ef99512420460fd4c322b128c624cc` passed independent fresh-context source review with zero blockers and no remaining major/minor findings. Reviewer and Driver used the same `gpt-6.1-sol` model; this was independent-context review, not heterogeneous-model review. The [final review record](https://github.com/chenhaoxiang/pi/pull/5#issuecomment-6086526464) distinguishes read-only source inspection from parent-executed validation.

Exact candidate [Linux/MCP CI 37969962143](https://github.com/chenhaoxiang/pi/actions/runs/37969962143), exact merge [Linux/MCP CI 37970938454](https://github.com/chenhaoxiang/pi/actions/runs/37970938454), and merge [environment CI 37970938350](https://github.com/chenhaoxiang/pi/actions/runs/37970938350) succeeded. At publication readback, the release source had 42 completed success/skipped check runs and no failing/pending checks. The pure community mirror was fast-forwarded to the exact v1.1.0 commit; fork main retained its own history.

The [immutable v1.1.0-fork.1 release](https://github.com/chenhaoxiang/pi/releases/tag/v1.1.0-fork.1) was published at `2026-10-09T18:40:58Z` (2026-10-10 local time), with 19 assets: 13 public tarballs, Node consumer, macOS ARM64 native archive, two installer-lock files, release manifest and checksum file. Its annotated tag peels to `c03cd2ced58f1d8b6865abeca9b31e4f2b34c634`; this acceptance follow-up is not the release source. Production offline/native rebuild and pack ran freshly at that exact clean source commit. All 19 server asset digests matched local files; a fresh full download matched all 18 entries in SHA256SUMS. Proxy upload timeouts left the draft unpublished; missing files were uploaded with command-scoped direct networking, preserving already verified assets. No global proxy configuration or published asset was replaced.

| Asset | SHA-256 |
| --- | --- |
| Node consumer | `ca5f36ec9e2ec839d7b9d3b8f397db4896315e018ee2c2e8378f7b6647703e48` |
| macOS ARM64 native | `821d8bf132ef29761dd0254cc3e8e9774b0696ab530c155239cf841442875967` |
| release-manifest.json | `40189ff31d3b7c22e6a086994b89401006d1eeeaa0bf6261ba4d8213f9fa5af1` |

The performing session installed the freshly downloaded verified Node consumer at `~/.pi/core-releases/1.1.0-fork.1`. Installed CLI and SDK both return `1.1.0-fork.1`; downloaded native CLI does too. Node and downloaded native print-mode and controlled tmux interactive synthetic replies completed. Personal offline extension/provider discovery reported zero loader errors; the existing pi-subagents package resolved all 12 host aliases with no missing peers. These checks do not claim live-provider reliability or reviewer replay of private configuration.

Only after acceptance, `/opt/homebrew/bin/pi` was atomically switched to the new Node launcher. `pi --version` returned `1.1.0-fork.1`; user settings hashes before/after matched. The `1.0.4-fork.1` directory and launcher target still exist and its CLI still returns the old version. Owner-only rollback receipt: `~/.pi/agent/backups/core-fork-1.1.0-20261010/rollback-receipt.json`. Rollback restores the saved previous symlink target; no extension declaration rollback is needed because none changed. Existing Pi processes were not restarted or overwritten, and may still hold the old core. Open/restart a settled session to use the new installation.

See [fork maintenance](fork-maintenance.md) for distribution and rollback. Live-provider/long-context reliability, other native platforms, and hot-loading active processes are separate and are not established by provider-free acceptance.
