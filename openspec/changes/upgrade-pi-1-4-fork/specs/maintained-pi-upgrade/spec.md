## ADDED Requirements

### Requirement: Exact community baseline with retained maintenance behavior
The maintained release SHALL integrate exact community v1.4.0 and version all ten public workspace packages as 1.4.0-fork.1, preserving fork security, release-channel and disconnect recovery behavior.

#### Scenario: Upstream and fork overlap
- **WHEN** community changes overlap fork retry or installer changes
- **THEN** existing fork regressions and upstream regressions pass without weakening assertions, and duplicate retry phrases are consolidated without removing the literal response.completed matcher

### Requirement: Reviewed immutable distribution
The release SHALL originate from clean reviewed merged source, pass applicable CI, include immutable source provenance and SHA256SUMS, and use fork-owned GitHub Release assets rather than community publication channels.

#### Scenario: Release installation
- **WHEN** a new local default is selected
- **THEN** the assets have been freshly downloaded and checksum-verified, the installed bytes and SDK/CLI versions are verified, and the previous launcher and package selection remain recoverable

### Requirement: Preserve active processes and configuration
The upgrade SHALL NOT overwrite the existing installation, force-restart active sessions or the shared Intercom broker, change credentials, or silently change unrelated model/extension configuration.

#### Scenario: Mixed-version sessions
- **WHEN** the default launcher is switched to the new release
- **THEN** existing processes retain their prior code and new sessions use the selected release; disk installation is not described as runtime hot-load

### Requirement: Risk-matched dependency and extension verification
Validation SHALL use provider-free isolated fixtures and distinguish local native-platform limitations from required Linux CI. Affected extension forks SHALL retain their own review, release and installation contracts.

#### Scenario: Audit reports unresolved upstream advisory
- **WHEN** Gondolin/node-forge has no published fix
- **THEN** the finding remains disclosed as unresolved, while available bounded development security fixes are applied and verified
