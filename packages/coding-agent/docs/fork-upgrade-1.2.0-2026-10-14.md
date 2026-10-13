---
doc_type: report
project: pi
status: active
truth_mode: maintained
created: 2026-10-14
updated: 2026-10-14
ssot: true
owner: chx
---

# Pi 1.2.0-fork.1 upgrade

## Source and retained boundaries

This maintenance slice integrates the exact community `v1.2.0` tag (`06a466935536f8c9bcacb2d5efc0fc021be1bdff`) into the maintained fork. Community `main` has later unreleased commits. Only three upstream validation/packaging fixes are selected after the exact tag: `0a8cfff4cbcbbdb0071ebe056f1fcb5710e7fcf0` (remove obsolete Nix chord/esbuild assumptions), `d6370b72d0a478a31741a6c44ae7ecdcbd01d0fd` (CI listing timeout and translated-daemon platform expectations), and `de022efd6176e7d394e6ae9fc87e22c44f55b3ca` (wait for the actual foreground command). Other unreleased changes remain on the pure `upstream-main` mirror and are not included.

The maintained line is `1.2.0-fork.1`. The fork retains the bounded Responses disconnect recovery, failed-response projection rules, community self-update refusal, fork installer URLs and dependency-security overrides. The previous `1.1.0-fork.1` release remains available for rollback.

Community 1.2.0 removes the experimental client/protocol/server package stack and no longer ships the chord dependency in the coding-agent package. The merged fork therefore removes the retired package manifests and keeps the Pi 1.2.0 package graph; pi-subagents 0.78.0 is required for its corresponding chord-less host compatibility.

## Validation

- `npm ci --ignore-scripts` passed.
- `npm run check` passed, including pinned/runtime dependency checks, TypeScript, install-lock validation and browser smoke checks.
- `npm run build:offline` passed using the immutable community `pi-1.2.0-source.tar.gz` model-data asset; SHA-256: `ccfa08c4ae2ab4f744bcc7b5fe0ad47960b6d3dffde65e480bce215b83624dbd`.
- `npm run build:daemon --workspace packages/env` passed.
- The isolated full macOS suite was attempted. A first fixture root under the real home and a PATH without `fd` produced 15 coding-agent failures; using a root outside private/resource ancestry and the existing fd/rg binaries removed those failures. The subsequently added report briefly failed the orphan-document test until the docs index link was added; that exact documentation regression was rerun successfully. Remaining local watcher failures are retained as unpassed platform evidence, not rewritten as successes.
- Independent review found that the retained SDK shim helper required removed chord. The helper now permits only stable 1.2+ undeclared chord omission, retaining old-host/declared-missing/version-drift checks; 11 shim regressions pass.
- Exact-head CI found upstream 1.2.0 Nix and environment test assumptions that already have the three community fixes listed above. They are cherry-picked with upstream author/commit provenance preserved; all other community changes remain excluded. Required updated-head CI remains the release gate.

## Installation boundary

Build and release artifacts must be produced from the clean merged `main` commit, verified with the release manifest and `SHA256SUMS`, then installed into a new permanent versioned directory. The previous `1.1.0-fork.1` directory and launcher target remain the rollback point. Disk installation does not hot-reload an existing Pi process; do not force-restart active sessions.

## Release and installed acceptance

[PR #10](https://github.com/chenhaoxiang/pi/pull/10) merged normally to `98ce58456bba4bf77f57625be753b727f4035310`. The final reviewed head was `f2e16078f4b079775a474d35696ccfc9999dd6b6`; independent review used `codex-local/deepseek-flash:high` and reported no P0/P1. Head CI/Nix/Environments runs `38480940138` / `38480939940` / `38480939985` passed. Exact merge CI `38482381051` and Environments `38482381102` passed. The pre-fix primary failure was independently identified from GitHub annotation `115575305146` as `terminal.test.ts:97` (expected sleep, observed sh), not inferred from its truncated log.

The immutable [v1.2.0-fork.1 release](https://github.com/chenhaoxiang/pi/releases/tag/v1.2.0-fork.1) has 16 assets; a fresh download verified all 15 SHA256SUMS entries. Offline/native rebuild and packaging used the clean exact merge source. Native macOS ARM64 startup and Node CLI/SDK report `1.2.0-fork.1`; packed consumer policy checks passed.

| Asset | SHA-256 |
| --- | --- |
| Node consumer | `1bedff10d1a14f723386add8986c5515539b7a29d2f27a1b0146846eeb9dcddc` |
| macOS ARM64 native | `c6c3207bdc9223095ddf76dc70de3b3c84c4fe6cf95453714695b1ddadefe759` |
| Source manifest | `85bbf6d450fc707c63b8954045a9b11a88bd5d5260bf97769292c1e9c8a486d4` |

The performing session installed the freshly downloaded Node consumer at `~/.pi/core-releases/1.2.0-fork.1`, switched the default launcher after isolated RPC/SDK acceptance, and selected new 1.2 SDK shims. The downloaded archive was compared against all 15,053 installed ordinary files and 9 symlinks; zero mismatches. Eight existing/new package factories load under the new core with zero loader errors and no provider prompt/session start. Subagents and Fast command discovery also passes under isolated new-core RPC with zero provider requests.

The third-party npm resource versions were not upgraded: they were copied side by side into a new permanent runtime so four SDK peer links can target the new host without changing files used by old processes. Only those three resource declarations plus the already validated subagents/service-tier selections changed; unrelated settings, credentials and another session's endpoint-memory update were preserved. Existing core/resource/shim sets remain. Owner-only rollback receipts are in the agent backup directory; raw settings/backups are not public artifacts.

SAW's fixed core manifest path was updated to the new installation. After explicit refresh, it reports community new versions 0, core `1.2.0-fork.1`, subagents `0.78.0-fork.1` and Fast `0.1.7-fork.2`. Its one remaining fork-sync notice is the core comparison against newer community main (22 graph commits, including selected fixes replayed without importing their ancestry); the pure mirror is current. This does not mean the stable release update failed and is not cleared by installing unreleased main.

No active Pi process/child was forced to restart. These are source, artifact, installed-file and provider-free loading results, not real-provider/long-context/TUI/browser acceptance or proof that an existing session hot-loaded the new installation.
