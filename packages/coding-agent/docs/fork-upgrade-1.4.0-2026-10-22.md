---
doc_type: report
project: pi
status: active
truth_mode: maintained
created: 2026-10-22
updated: 2026-10-22
owner: chx
---

# Pi 1.4.0-fork.1 synchronization

## Source and retained boundaries

Integrate exact community `v1.4.0` at `4a080252f06caf63a525d7873c5d94d3c23887e0` from maintained main `e57c80024`. All ten public workspace packages use `1.4.0-fork.1`, with exact internal dependency pins. Later community-main changes are not included. The single coordination change is `openspec/changes/upgrade-pi-1-4-fork/`; extension source and release decisions remain in their respective owner repositories.

Retain community self-update refusal and banner isolation, fork-owned installer URLs, exact-source release manifests/checksums, host-owned peer shims and dependency-security overrides. Community now also recognizes Codex disconnect wording: consolidate the duplicate phrase while retaining the fork's literal `stream closed before response\\.completed` matcher and its classifier/session recovery regressions. Preserve failed-attempt projection and completed tool results; accept upstream's separate truncated-tool-result recovery fix. The overlapping BOM import preserves both upstream `stripBom` and fork self-update guards.

The upstream removal of retired Baseten model tests is accepted; it removes no functioning provider implementation. Existing fixture assertions are not weakened. All other upstream changes, including telemetry/client identity, Durable scheduling/storage, CJK/dialog fixes, compaction output-cap removal and codemode worker admission, follow the exact tag.

## Model data and development security

Model data is the immutable community `pi-1.4.0-source.tar.gz`, SHA-256 `12b14a5d812e049a0b22449e2589ee7647c31f00f93bb97d8d25aff0e71920da`, matching both the Release digest and downloaded checksum entry. Fork CI deliberately updates its catalog pin to this snapshot. Do not hand-edit catalog metadata or claim mutable network refresh was tested.

The initial raw audit had five affected-package entries: two moderate and three high. Pin all Vitest development declarations to `4.1.12` and the root Vite resolution to `8.1.6`, after reviewing their security-patch notes. This fixes the manual/redirect mock registration and Vite editor/middleware advisories without a major toolchain upgrade. No runtime dependency, undici version or lifecycle-script allowlist is changed. The retained Gondolin/node-forge advisory still reports two high affected-package entries with no available registry fix; risk acceptance is not remediation. See the earlier [security record](fork-dependency-security-2026-10-08.md) for that retained boundary.

## Local validation and limits

- Lifecycle-disabled lock refresh/install, `npm run check`, complete `npm run build:offline`, daemon build and installer-lock generation/check passed.
- The first full provider-free run used a fixture below the user's home. Four coding-agent discovery/trust tests inherited ancestor skills; the remaining workspace suites passed, including native watcher tests. The fixture location was corrected to an owned OS `tmp/` subtree outside daily configuration ancestry. No test assertion or product code was changed to accommodate this environmental error. The corrected Node 22 run passed completely: 83 script tests plus 8,023 Vitest executions, and the complete TUI node:test suite (its dot reporter emits no count summary), zero failures. The counted subtotal is 8,106, not the whole suite count; Durable runs in both retention configurations. Provider-gated skips remain explicit. Native filesystem watcher tests passed in this run; no platform-specific waiver is needed.
- The first exact-head review found no code blocker; source wording and test-count notes were corrected. The reviewer could not execute git commands; the Driver separately verified merge parents and that the overlapping Baseten tests match v1.4.0 exactly. Initial Environments CI exposed an unbuilt new telemetry prerequisite; the model-catalog check needed the community release tag fetched into the fork clone. Both workflow defects are repaired without dropping checks in `.github/workflows/env.yml` (build telemetry before source tests) and `.github/workflows/publish-model-catalog.yml` (fetch only the needed stable community tag).
- Independent review, exact-head required CI, clean merged-source packaging, fresh Release download and installed loading are separate gates; this preparation record does not pre-sign them.

## Installation and activation

Publish only from reviewed clean merged main; never replace published tags/assets. Install verified Node assets into a new permanent `~/.pi/core-releases/1.4.0-fork.1` directory and preserve `1.3.0-fork.1` plus the previous launcher/package selections. Rebuild native assets at the exact clean committed release HEAD before packaging. Switch only verified default selections; do not modify credentials, live model settings, existing sessions, child processes or the shared Intercom broker. New disk contents do not prove active-session hot-load. Provider-free checks do not prove real-provider long-context reliability or manual terminal acceptance.

## Released and installed acceptance (2026-10-22)

- [PR #16](https://github.com/chenhaoxiang/pi/pull/16) merged normally as `632cd32ff189eb5407e2aeb81efce0366147c74f`. Exact reviewed head `d0b1da13920f1c2c30cac2bb50351b300e722658` passed required build-check-test/mcp-conformance, model catalog, Nix and cross-platform Environments. Post-merge CI [39735484272](https://github.com/chenhaoxiang/pi/actions/runs/39735484272) and Environments [39735484363](https://github.com/chenhaoxiang/pi/actions/runs/39735484363), plus the follow-on catalog and Nix workflows, completed successfully.
- The immutable [v1.4.0-fork.1 Release](https://github.com/chenhaoxiang/pi/releases/tag/v1.4.0-fork.1) targets that merge and has 16 assets. The exact clean merged source was rebuilt offline before native/Node packaging. Fresh download verified all SHA256SUMS entries. A partial upload remained a draft; after missing assets were uploaded and every server digest/size matched, it was published. No published asset or tag was replaced.
- New permanent installation: `~/.pi/core-releases/1.4.0-fork.1`; default launcher, Node CLI, native macOS ARM64 binary and selected/bare SDK report `1.4.0-fork.1`. Installed Node contents: 15,035 regular files and 9 symlinks; native contents: 220 regular files; all match the downloaded archives. macOS AppleDouble metadata entries (16,472 Node / 247 native) are excluded from ordinary-file counts because tar restores metadata rather than separate files.
- All 13 configured package extensions plus 7 manual adapter entries load under the new installed SDK: 20 entries, zero errors/warnings. Isolated installed Intercom/Compaction RPC returned state and commands, exit 0, zero stderr and zero model requests. Peer shims use a new immutable four-core-peer set. The standalone read-only preflight was refreshed from the reviewed source because its old helper incorrectly required removed chord; bare SDK identity is now asserted, not merely printed. Legacy optional chord and prior versioned module trees remain untouched.
- [Intercom PR #21](https://github.com/chenhaoxiang/pi-intercom/pull/21) / `0.18.0-fork.3` and [Compaction PR #22](https://github.com/chenhaoxiang/pi-better-compaction/pull/22) / `0.7.4-fork.4` are released, checksum-verified and selected. Their owner reports contain behavior/validation evidence. i18n/config stay exactly 2.12.0 in a minimal separate locked runtime bound to the new SDK; old npm resource trees are retained.
- Only the three matching package declarations and lastChangelogVersion changed in settings; other values remain semantically identical. Prior launcher/settings/SDK/checker selections and a compare-and-swap rollback script are preserved in the owner-only backup directory. Old `1.3.0-fork.1` and all old extension installations remain. No active Pi parent/child, shared Intercom broker, provider credential or unrelated service is restarted or changed.

## Inventory and remaining boundaries

Fourteen Pi-related owner projects were inspected. Apart from core, only Intercom had a new upstream code commit; Compaction needed a new immutable release for an already-merged runtime fix. Subagents 0.80.0-fork.1, Web Access 0.44.0-fork.1, Service Tier 0.1.7-fork.4, Messenger, question/todo and the original packages retain their compatible fixed selections. New development-only SDK pins do not by themselves justify republishing unchanged runtime code. Core community main's only post-tag commit at final readback was the next-cycle Unreleased heading; it is mirrored, not silently added to the release.

The earlier raw workspace audit still has the two known upstream Gondolin/node-forge affected-package entries. Redundant later raw-audit refreshes timed out; they are not presented as zero-finding runs. No real-provider, manual TUI, Windows native-binary or hot-reload acceptance is claimed. Fresh sessions use the new default; this performing session and other existing sessions may retain old loaded code.
