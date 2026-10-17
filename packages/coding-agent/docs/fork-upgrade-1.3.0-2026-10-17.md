---
doc_type: report
project: pi
status: active
truth_mode: maintained
created: 2026-10-17
updated: 2026-10-17
owner: chx
---

# Pi 1.3.0-fork.1 synchronization

## Scope and source

Integrate exact community tag `v1.3.0` at `71023aec1546d6d677a65669c5665c0927ce0dd0` into the maintained fork, from fork main `0d1de82716bbb2cc939340917f76ac8d6b6f11f4`. Later unreleased community commits are not included except the two selected validation fixes cherry-picked with provenance: `14ff455a0aaa5cf20f75a0326beb14ff59c9bd98` for deterministic env differential coverage and `99fe1489707f9f6accbef4377be79ef0544c42f2` for updated Xiaomi model fixtures. The ten public workspace packages use `1.3.0-fork.1`; upstream's new exact internal dependency pins are retained with the fork version.

Retain Responses disconnect recovery, failed-attempt projection/tool-result preservation, community self-update refusal, fork installer asset URLs and dependency-security overrides. No provider credentials, model configuration or sharing preferences are changed by installation. Community model-switching, cache, parsing, tool restoration, codemode worker, Chord and Durable changes follow the exact tag.

## Validation

- Dependency hydration with lifecycle scripts disabled, `npm run check`, `npm run build:offline` and environment-daemon build passed.
- Model data comes from immutable community `pi-1.3.0-source.tar.gz`, SHA-256 `7761ae59cb6d84c1e162d3d638f81816c66d3f75862e941432ea2d7a8e3bf40f`. Fork CI pins that same asset; generated catalog data is not hand-edited.
- The full isolated local macOS suite was run. Agent, AI, Chord, Codemode, Coding Agent, Evals, MCP, Telemetry and TUI passed. Durable and Env retain ten native filesystem-watch failures; this is not an all-green local suite. Existing assertions are unchanged except exact upstream changes.
- Exact-head independent review, required platform CI, clean-main packaging, fresh Release download and installed loading remain separate gates, recorded when actually completed.

## Delivery and rollback boundary

Publish immutable fork assets only from reviewed, clean, merged main. Install the freshly downloaded and checksum-verified Node consumer beside the retained `1.2.0-fork.1` installation. New SDK resources must not rewrite links or files used by old sessions. Switch only verified default launcher/package selections and preserve rollback receipts. Do not force-restart active parents, children or the shared Intercom broker. Source/build success is not release, installation, runtime hot-load or real-provider acceptance.

## Release and installed acceptance (2026-10-17)

- PR #12 merged normally at `fda1390c4a42d8b637c9fc6915e581351f8e757b`; all required CI and Environments checks passed. The immutable [v1.3.0-fork.1 Release](https://github.com/chenhaoxiang/pi/releases/tag/v1.3.0-fork.1) contains 16 assets. Fresh download verification passed against `SHA256SUMS`; the Node archive, native macOS ARM64 archive, workspace tarballs, installer pair and manifest all matched.
- The permanent core installation is `~/.pi/core-releases/1.3.0-fork.1`; archive comparison found 31,543 files and 9 symlinks with zero mismatches. `pi --version` reports `1.3.0-fork.1`; isolated RPC returned state/command responses with zero provider requests and no stderr. SDK peer shims were generated and checked for the exact host.
- The four maintained packages were installed side by side from freshly downloaded, checksum-verified Release assets. Subagents (1,353 files), Web Access (105 files) and Intercom (42 files) matched their archives byte-for-byte; the new host loaded the five changed/new-runtime extension entries with zero loader errors/warnings. Web routing/User-Agent/invalid-config installed smoke checks passed without model calls.
- Local settings changed only the matching package selections, `lastChangelogVersion`, runtime sidecar path and core monitor path. `web-search.json` stayed byte-identical; all other non-package settings remained semantically unchanged against the owner-only backup. A rollback script and prior core/package trees remain under the owner-only backup directory. No active Pi session, child or shared broker was restarted.
- SAW `pi-maintenance` was refreshed after installation. It reports the four installed fork versions, verified release provenance and zero stable release updates; Pi's 16 newer community-main commits remain an explicit fork-sync notice, not an unreviewed install target.
