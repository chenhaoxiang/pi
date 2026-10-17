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

Integrate exact community tag `v1.3.0` at `71023aec1546d6d677a65669c5665c0927ce0dd0` into the maintained fork, from fork main `0d1de82716bbb2cc939340917f76ac8d6b6f11f4`. Later unreleased community commits are not included. The ten public workspace packages use `1.3.0-fork.1`; upstream's new exact internal dependency pins are retained with the fork version.

Retain Responses disconnect recovery, failed-attempt projection/tool-result preservation, community self-update refusal, fork installer asset URLs and dependency-security overrides. No provider credentials, model configuration or sharing preferences are changed by installation. Community model-switching, cache, parsing, tool restoration, codemode worker, Chord and Durable changes follow the exact tag.

## Validation

- Dependency hydration with lifecycle scripts disabled, `npm run check`, `npm run build:offline` and environment-daemon build passed.
- Model data comes from immutable community `pi-1.3.0-source.tar.gz`, SHA-256 `7761ae59cb6d84c1e162d3d638f81816c66d3f75862e941432ea2d7a8e3bf40f`. Fork CI pins that same asset; generated catalog data is not hand-edited.
- The full isolated local macOS suite was run. Agent, AI, Chord, Codemode, Coding Agent, Evals, MCP, Telemetry and TUI passed. Durable and Env retain ten native filesystem-watch failures; this is not an all-green local suite. Existing assertions are unchanged except exact upstream changes.
- Exact-head independent review, required platform CI, clean-main packaging, fresh Release download and installed loading remain separate gates, recorded when actually completed.

## Delivery and rollback boundary

Publish immutable fork assets only from reviewed, clean, merged main. Install the freshly downloaded and checksum-verified Node consumer beside the retained `1.2.0-fork.1` installation. New SDK resources must not rewrite links or files used by old sessions. Switch only verified default launcher/package selections and preserve rollback receipts. Do not force-restart active parents, children or the shared Intercom broker. Source/build success is not release, installation, runtime hot-load or real-provider acceptance.
