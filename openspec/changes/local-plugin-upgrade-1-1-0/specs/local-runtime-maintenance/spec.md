## ADDED Requirements

### Requirement: Host-owned SDK peers
The maintenance tool SHALL resolve the identified default Node Pi host and generate peer wrappers with that exact host version and runtime export targets. It SHALL reject unidentified hosts, arbitrary prereleases, missing peers, mismatched peer versions and exports outside their owner package.

#### Scenario: Stale Homebrew shim
- **WHEN** the launcher selects a maintained fork while an old shim points to a different community installation
- **THEN** a generated versioned set and read-only check identify the actual host, without replacing either core installation.

### Requirement: Staged installation and honest acceptance
Package changes SHALL use verified staged resources, preserve rollback and select only the authorized package references. Source, merge, artifact integrity, installed selection and live process state SHALL be reported separately.

#### Scenario: Active sessions during upgrade
- **WHEN** a new package is selected while an older session is active
- **THEN** the old runtime files remain and the session is not forcibly stopped; the install is not presented as proof of hot reload.

### Requirement: Maintenance keeps data and authority boundaries
Maintenance SHALL preserve provider credentials, raw sessions, opaque checkpoints, unrelated dirty state and configured long-reasoning policy. Browser and memory-service changes SHALL have explicit rollback and targeted verification.

#### Scenario: A component needs a technical prerequisite
- **WHEN** browser attachment or a memory-service backup cannot be completed safely
- **THEN** that action is reported blocked and other independent authorized maintenance continues.
