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
- The first full provider-free run used a fixture below the user's home. Four coding-agent discovery/trust tests inherited ancestor skills; the remaining workspace suites passed, including native watcher tests. The fixture location was corrected to an owned OS `tmp/` subtree outside daily configuration ancestry. No test assertion or product code was changed to accommodate this environmental error. The corrected Node 22 run passed completely: 83 script tests plus 8,023 workspace test executions (8,106 total; Durable runs in both retention configurations), zero failures. Provider-gated skips remain explicit. Native filesystem watcher tests passed in this run; no platform-specific waiver is needed.
- Independent review, exact-head required CI, clean merged-source packaging, fresh Release download and installed loading are separate gates; this preparation record does not pre-sign them.

## Installation and activation

Publish only from reviewed clean merged main; never replace published tags/assets. Install verified Node assets into a new permanent `~/.pi/core-releases/1.4.0-fork.1` directory and preserve `1.3.0-fork.1` plus the previous launcher/package selections. Rebuild native assets at the exact clean committed release HEAD before packaging. Switch only verified default selections; do not modify credentials, live model settings, existing sessions, child processes or the shared Intercom broker. New disk contents do not prove active-session hot-load. Provider-free checks do not prove real-provider long-context reliability or manual terminal acceptance.
