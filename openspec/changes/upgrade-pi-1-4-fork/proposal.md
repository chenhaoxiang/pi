## Why

The Owner requested the maintained Pi fork and local installation be upgraded to community 1.4.0, with affected maintained extension forks updated or repaired. The existing 1.3 installation and running sessions must remain recoverable.

## What Changes

- Merge exact community `v1.4.0` (`4a080252f06caf63a525d7873c5d94d3c23887e0`) into the reviewed maintenance branch, with ten public packages at `1.4.0-fork.1`.
- Retain fork update-channel protection, installer provenance, host peers, disconnect recovery and dependency-security resolutions; use the immutable 1.4.0 model snapshot.
- Update only audited affected extension forks and publish immutable assets after required review/CI. Install freshly downloaded verified assets side by side with rollback.
- Apply the available Vitest 4.1.12 and Vite 8.1.6 development security fixes. Retain and disclose the unresolved upstream Gondolin/node-forge advisory.

## Capabilities

### New Capabilities
- `maintained-pi-upgrade`: exact stable-source, retained-fork and reversible local-install requirements for this upgrade.

## Impact

Pi core source, generated dependency/installer locks, immutable Release assets and the default local launcher. Extension behavior and releases remain owned by their respective repositories. No provider credentials, real model prompts, production state, unrelated sessions or shared brokers are changed. No community npm/pi.dev publication or platform protection changes are authorized by this change.
