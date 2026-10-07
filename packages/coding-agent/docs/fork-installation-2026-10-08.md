---
doc_type: report
project: pi
status: completed
truth_mode: snapshot
created: 2026-10-08
verified: 2026-10-08
verified_by: owner-session
owner: chx
ssot: false
---

# 1.0.4-fork.1 release and installed acceptance

This snapshot is an attestation by the owner session that performed the release and install, not an independently reproduced runtime audit. CI/review, test counts, upload recovery, rollback receipts and smoke outcomes are owner-recorded; the independent reviewer checked their consistency and source safety without replaying private runtime operations.

## Shared release

- Community baseline: v1.0.4 / `7c10bd4337495ee613f2224843ecdf349b80d1df`.
- Reviewed source PRs [#1](https://github.com/chenhaoxiang/pi/pull/1) and [#2](https://github.com/chenhaoxiang/pi/pull/2) normally merged; immutable release source/tag: `48065977e5ce337738902fdcbf8a4dea9c00e28f` / [v1.0.4-fork.1](https://github.com/chenhaoxiang/pi/releases/tag/v1.0.4-fork.1).
- Fresh exact-clean-HEAD offline/native rebuild and production `--binary` pack all exited 0. Release contains 19 assets (18 covered files plus SHA256SUMS); GitHub server digests and afresh/resumed downloads all matched. Failed initial parallel upload remained a draft; missing assets were uploaded sequentially and verified before publication, never replacing a public asset/tag.
- Production Node SDK/CLI and macOS ARM64 native versions both equal 1.0.4-fork.1. Both print-mode and controlled interactive bounded no-tool replies using the owner's configured `codex-local/gpt-6.1-sol` provider/model passed. Other native platforms and live 700k requests are not validated.

## Local install

Downloaded verified Node consumer is in a permanent version directory under `~/.pi/core-releases/1.0.4-fork.1`. The default Pi launcher now resolves to that directory and `pi --version` returns 1.0.4-fork.1. Global offline extension/provider loading exited 0 with no loader errors.

The community 1.0.4 package files and prior launcher target remain preserved; an owner-only rollback receipt and original settings copy are under `~/.pi/agent/backups/core-fork-1.0.4-20261008`. Only the required compiled pi-subagents declaration changed to [0.76.1-fork.2](https://github.com/chenhaoxiang/pi-subagents/releases/tag/v0.76.1-fork.2); unrelated settings remained byte-identical. Actual installed host alias resolution returned no missing peers.

Active sessions/children were not force-restarted. A previously started process may still hold old modules; open/restart a settled Pi session for the new core. Disk installation is not hot-load evidence.

## Limits and maintenance

Remote build/check/test and MCP CI on reviewed source head `f606c5248067d9c1701f19b21cfcc1e1d2a227a3` passed before its ordinary merge to release source `48065977…`; this later docs commit is not the release source. Owner recorded those checks, with independent DeepSeek Flash high review and recorded rechecks. Modified coding-agent tests were 2709 passing / 50 provider skips; scripts 42 passing. Earlier complete isolated local runs passed; later unchanged native durable watch conformance on local macOS/Node26 was unstable. Those failures remain recorded and are not claimed fixed or unconditionally green.

`upstream-main` was fast-forwarded to pure community `f10993bc7f28145df1375f3ff39c7f5c4cfc05f0` at this snapshot. Maintenance main intentionally remains the approved stable baseline plus fork work. Mirror freshness is not authorization to merge unreleased community changes or overwrite this release.

The fork fixes missing bounded recovery, not the initial upstream disconnect or long-context reliability. See [maintenance and rollback](fork-maintenance.md).
