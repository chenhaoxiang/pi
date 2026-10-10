## Ordered implementation

- [x] 1. Verify owners, installation facts and explicit authorization; record rollback scope.
- [x] 2. Repair SDK peers/preflight and run synthetic regressions plus bare-import validation.
- [x] 3. Stage/select web-access 0.38.0 and exact companion versions; retire unused adapter declarations and audit the active dependency tree.
- [x] 4. Integrate, review, CI-validate, release and install the subagents fork increment.
- [x] 5. Integrate, review, CI-validate, release and install the compaction fork increment.
- [x] 6. Migrate browser MCP services/extension contracts and prove browser-side connectivity without unrelated page actions.
- [x] 7. Back up and stage memory API/control plane; retain the live 0.10.2 service per owner decision. Lock remaining install refs and make debug logs opt-in with read-only retention inspection.
- [x] 8. Complete exact-source/source-doc reviews and canonical main readbacks; record installed/live boundaries and rollback.

## Completion boundaries

Core maintenance PR #7, subagents acceptance PR #21 and compaction acceptance PR #17 merged normally and their canonical main checkouts were fast-forwarded/read back. Exact final-head reviews/CI passed; prior failures are retained. Installed versions and release assets remain fixed, and active sessions were not forced to reload.

Hindsight 0.10.3 service activation is intentionally held by the owner, not an unperformed task reported complete. Live API/control-plane/scripts remain 0.10.2. Browser connection acceptance proves a correctly selected 0.8.0 extension and no implicit pages, not arbitrary site interaction.
