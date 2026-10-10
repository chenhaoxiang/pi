## Context

The machine mixes immutable releases, npm resources, git main sources and browser bridges. A disk version does not establish what an active process loaded.

## Decisions

1. Derive SDK identity from the resolved default launcher, not a fixed package-manager prefix. Validate peer identities, versions, exports and wrapper bytes; fail closed on drift. Generate into a new version directory and retain old sets.
2. Install npm resources in a new permanent directory with exact direct versions and a lockfile. Only select it after offline loading and audit; old module files stay for active sessions.
3. Community integration uses real merges on fork main, never pure-mirror replacement. Each extension owns source regressions, release provenance and installation acceptance.
4. Browser connection and package freshness are separate facts. Change only owned bridge/extension state; avoid restarting daily Chrome or accessing unrelated pages.
5. Memory-service updates require verified backup and a service-specific handover; a failed technical prerequisite does not block unrelated approved work. Per owner decision, 0.10.3 remains staged while the live service and ordinary management scripts keep 0.10.2.
6. Debug logs are opt-in. Retention inspection is metadata-only with 14-day/2 GiB alert defaults; no artifact deletion, unattended pruning or hard writer cap is introduced.

## Non-goals

No automatic model/provider probes, paid requests, credential rotation, session deletion, blanket cache cleanup, new approval ledger, third-party CLI delegation, V3 work or global timeout reduction.

## Risks

Active sessions retain older extension definitions until settled restart. Browser extension reattachment and memory workers may require a brief maintenance interval. Report source, release, installed selection and live acceptance separately.
