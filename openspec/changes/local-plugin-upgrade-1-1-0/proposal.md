## Why

The installed core is 1.1.0-fork.1, but standalone SDK peer shims still resolved community 1.0.4 and selected extensions/MCP services have maintenance updates. The owner authorized sequential remediation, preserving active sessions and rollback.

## What Changes

- Identify the default Node host and generate/check versioned host-owned peer wrappers.
- Install and select a pinned side-by-side web resource runtime; retire the unused adapter declaration without erasing old runtime files.
- Integrate reviewed community increments into the maintained subagents and compaction forks, retaining their contracts and publishing verified immutable assets.
- Migrate browser MCP components together, with explicit page selection, no automatic blank tabs, per-session ownership and telemetry disabled.
- Back up and stage the memory service/control plane; the owner-held live service remains 0.10.2. Lock install references and make debug logging opt-in, with metadata-only retention alerts instead of automatic pruning.

## Capabilities

### New Capabilities
- `local-runtime-maintenance`: explicit host identity, bounded staged validation and recoverable package/service changes.

### Modified Capabilities
None in the core API. Fork-specific behavior contracts remain owned by each extension repository.

## Impact

Core maintenance scripts/docs only; installed local packages and MCP/service configuration are explicit deployment actions, not changes to provider credentials, routing or core recovery. No community npm/pi.dev publication. Existing running core installations are not overwritten.
