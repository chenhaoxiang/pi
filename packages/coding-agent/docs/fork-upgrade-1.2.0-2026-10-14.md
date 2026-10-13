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
