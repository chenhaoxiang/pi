---
doc_type: runbook
project: pi
status: active
truth_mode: maintained
created: 2026-10-10
verified: 2026-10-10
verified_by: manual
---

# Local extension maintenance after Pi 1.1.0

This runbook coordinates the owner-authorized local maintenance after installing `1.1.0-fork.1`. It does not modify core provider routing, credentials, timeouts or session history. Extension behavior, releases and tests stay owned by their individual repositories.

## SDK peer identity

A hardcoded package-manager prefix can keep standalone scripts on a community SDK after the default launcher selects a maintained fork. The host's extension loader and subagent runner already have their own peer mappings; that does not repair a separate bare Node import.

Use `scripts/host-peer-shims.mjs` from this fork to resolve the actual Node launcher, validate the identified stable host and all five lockstep peer packages, then generate into a new directory:

```sh
node scripts/host-peer-shims.mjs --launcher /path/to/pi --out /new/permanent/shims/version
node scripts/host-peer-shims.mjs --launcher /path/to/pi --check /new/permanent/shims/version
```

For a native launcher, explicitly select the separately verified Node SDK host with `--host /path/to/package`. The tool never guesses a native binary's module tree. The `pi-ai` bare root uses the host compat export, matching Pi's extension mapping. Removed `pi-agent-core/node` is not recreated. Missing exports, version drift, arbitrary prereleases, unidentified packages and exports escaping their owner fail closed. Generated manifests carry an explicit shim marker and are rejected as hosts; a real host must declare its package-contained `bin.pi`, and launcher mode must match that exact realpath. The new output leaf is created exclusively in a trusted owner-owned parent (not group/world-writable); existing directories or symlinks fail instead of being reused.

Wrapper checks establish host selection and exact generated wrapper content, not cryptographic verification of every host byte. Core release checksum verification is separate. Record prior links/metadata before selecting a new shim set; retain old sets for running consumers. A subsequent core upgrade requires regenerating/selecting a new set, not editing an immutable set in place.

## Side-by-side npm resources

Install tested resource versions in a new permanent directory with exact direct dependencies and a lockfile. Use `--ignore-scripts --legacy-peer-deps` so host peers are not replaced. Load the resource entries through the current host SDK without starting a real-provider session; audit that effective runtime before changing settings. Replace only the matching package declarations, after comparing the current settings fingerprint against the backed-up version.

Current selected third-party versions are web-access `0.38.0`, powerline-footer `0.19.1` and rpiv-i18n `2.12.0`. The new runtime excludes `pi-mcp-adapter`; builtin MCP remains selected. Old module files are retained for already-running sessions and rollback, but retired resource/adapter declarations are not in the effective dependency tree. Zero findings in the selected runtime is not a claim that old backup bytes no longer contain affected dependencies.

## Ordered extension and service handover

The coordination contract is [local-plugin-upgrade-1-1-0](../../../openspec/changes/local-plugin-upgrade-1-1-0/proposal.md).

Debug artifact retention is inspected, not silently pruned. Run
`node scripts/check-local-debug-retention.mjs <artifact-root>` against a local artifact
root to report file count, bytes, files older than 14 days, symlink skips and the
2 GiB alert threshold. The checker uses metadata only, skips observed symlinks,
never reads or removes artifact bodies, and does not enforce a hard capacity cap;
rotation and deletion remain an explicit owner action. It is not a security
boundary against concurrent directory replacement.

1. Repair peer identity and read-only preflight.
2. Stage/validate/select web resources and retire the unused adapter.
3. Integrate/test/review/CI/release the maintained subagents fork; keep fallback, idle, host and wait contracts.
4. Integrate/test/review/CI/release the maintained compaction fork; preserve opaque-checkpoint and lazy-portability safety.
5. Migrate browser MCP services and extension contracts together; prove browser-side attachment separately from package freshness.
6. Back up and update the memory API/control plane; lock install references, pin the Hindsight coding-agent runtime and make debugging opt-in with read-only retention inspection.
7. Record canonical source, release assets, installed selection, live acceptance and rollback separately.

Use real reviewed merges for extension forks and a pure fast-forward community mirror. Do not publish community npm identities, replace released assets, or erase unrelated dirty caches. For browsers, keep normal-profile control distinct from isolated DevTools, explicit target pages and session ownership. Memory service changes need service/data rollback, not just a new version string.

## 2026-10-10 installed acceptance

- The selected core and all five bare SDK peers resolve `1.1.0-fork.1`; thirteen synthetic peer/retention regressions and `npm run check` pass. Existing core release assets are unchanged.
- The exact side-by-side npm resource tree and Playwriter tree each report zero current npm audit findings. Old installation bytes are retained, not claimed sanitized.
- Subagents `0.76.1-fork.3` and compaction `0.7.4-fork.1` were reviewed, merged, released with verified checksums and selected locally. Their source/CI/artifact/test limitations are owned by the [subagents acceptance report](https://github.com/chenhaoxiang/pi-subagents/blob/main/docs/maintenance/2026-10-10-community-performance.md) and [compaction acceptance report](https://github.com/chenhaoxiang/pi-better-compaction/blob/main/docs/maintenance/2026-10-10-community-0.7.4.md), not duplicated here.
- Playwriter MCP/CLI and relay select `0.8.0` with telemetry disabled. The manually loaded Chrome `0.8.0` extension is connected; an owned SDK connection bound that version and verified zero implicit pages, creating/navigating/reading none. An older `0.7.0` extension on another profile remains untouched. Multiple profiles require explicit selection. The old auto-enable variable is retired; no default `page` exists in 0.8. Codex Chrome `1.4.1` bridge reconnection is healthy. These checks do not claim real-site interaction acceptance.
- Hindsight API/control-plane `0.10.3` are staged with a verified pre-upgrade database archive, compatible dependency check and 14 profile/2 adapter offline tests. Per owner decision, live API, global control-plane and normal management scripts remain `0.10.2`; no migration or service switch is claimed. The Coding Agents runtime remains `0.8.0` with `autoUpdate=false`; tokens, bank routing, embedding dimensions and long-reasoning policy are unchanged. Hindsight's local owner runbook contains the held handover and rollback, not this public repository.
- Floating Git resources now use the verified installed commit or immutable fork tags. Dirty package caches were not reset. Daily compaction debug/payload/response logging is off and redaction remains enabled. The metadata-only inspection reports about 1.48 GiB of existing artifacts, without reading or deleting bodies; the 14-day/2 GiB defaults are alerts, not automatic rotation or a hard writer cap.

## Verification and restart boundaries

SDK shim regressions are synthetic and provider-free. Resource factory loading does not prove every TUI, provider or browser operation. Source tests, required CI, published downloads, installed SDK loading and real service health are different evidence layers.

Disk package selection does not hot-upgrade an active session. Keep old core/package files and let the owner restart settled sessions. Never force-stop unrelated children, remove raw sessions/opaque checkpoints, or treat a failed local platform fixture as a passing test. The prior full macOS suite limits remain reported; exact updated-head required CI is still mandatory before a fork release.

Local owner-only backups/rollback receipts belong under the agent backup directory. Do not commit their credentials, personal paths, session text or contents to this public repository. A staged service/runtime or manually loaded browser extension is not reported as live until its own health check proves activation.
