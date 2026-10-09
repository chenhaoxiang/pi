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

Upstream removed `coding-agent-consumer.mjs`. The fork packer now uses its replacements: `produceArtifactSet`, `installConsumer`, `smokeTestNpmConsumer` and `smokeTestCodingAgent`. Content-addressed artifacts are copied byte-for-byte to canonical flat release filenames required by the installer lock; the Node consumer resolves every internal package through those local tarballs. Three new guard regressions detect broken helper imports and validate the existing binary/output/options boundaries. A complete candidate pack verifies real package consumption outside the checkout.

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

Source review, final Linux CI, immutable tag/assets and installed runtime acceptance must be recorded after they actually complete. The source validation above is not a claim that publication or installation already happened. Install only freshly downloaded, checksum-verified release assets into a permanent `~/.pi/core-releases/1.1.0-fork.1` directory. Verify CLI/SDK, synthetic print/TUI and installed extension compatibility before atomically changing the default launcher. Preserve the old directory/launcher target; do not force-restart active Pi sessions.

See [fork maintenance](fork-maintenance.md) for distribution and rollback. Live-provider/long-context reliability, other native platforms, and hot-loading active processes are separate and are not established by provider-free acceptance.
