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

This maintenance slice integrates the exact community `v1.2.0` tag (`06a466935536f8c9bcacb2d5efc0fc021be1bdff`) into the maintained fork. Community `main` has later unreleased commits; those remain on the pure `upstream-main` mirror and are not included in this release baseline.

The maintained line is `1.2.0-fork.1`. The fork retains the bounded Responses disconnect recovery, failed-response projection rules, community self-update refusal, fork installer URLs and dependency-security overrides. The previous `1.1.0-fork.1` release remains available for rollback.

Community 1.2.0 removes the experimental client/protocol/server package stack and no longer ships the chord dependency in the coding-agent package. The merged fork therefore removes the retired package manifests and keeps the Pi 1.2.0 package graph; pi-subagents 0.78.0 is required for its corresponding chord-less host compatibility.

## Validation

- `npm ci --ignore-scripts` passed.
- `npm run check` passed, including pinned/runtime dependency checks, TypeScript, install-lock validation and browser smoke checks.
- `npm run build:offline` passed using the immutable community `pi-1.2.0-source.tar.gz` model-data asset; SHA-256: `ccfa08c4ae2ab4f744bcc7b5fe0ad47960b6d3dffde65e480bce215b83624dbd`.
- `npm run build:daemon --workspace packages/env` passed.
- The isolated full macOS suite was attempted. Its remaining failures are environment-bound watcher/trust/package-fixture failures and missing external `fd`/filesystem timing evidence; this report does not claim a full local suite pass. Required CI remains the release gate.

## Installation boundary

Build and release artifacts must be produced from the clean merged `main` commit, verified with the release manifest and `SHA256SUMS`, then installed into a new permanent versioned directory. The previous `1.1.0-fork.1` directory and launcher target remain the rollback point. Disk installation does not hot-reload an existing Pi process; do not force-restart active sessions.
