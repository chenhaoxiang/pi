## ADDED Requirements

### Requirement: Enforce reviewed maintenance updates
The maintained main branch SHALL require a pull request, resolved review threads and successful
build-check-test and mcp-conformance checks from GitHub Actions15368 against current main.
It SHALL disallow deletion/non-fast-forward, require zero human approvals and grant no standing bypass.

#### Scenario: Required checks have not succeeded
- **WHEN** a main-targeting PR has missing, pending or failed required checks
- **THEN** the platform SHALL prevent its merge under the normal Owner/automation identity.

#### Scenario: A reviewed up-to-date candidate passes
- **WHEN** the exact reviewed candidate satisfies required checks and thread resolution
- **THEN** it SHALL be eligible for an ordinary merge without a second-human approval.

### Requirement: Preserve the independent community mirror
Upstream-main SHALL have separate history protection without main's PR/check requirements.

#### Scenario: A legitimate community fast-forward is available
- **WHEN** the mirror update is a fast-forward
- **THEN** the main-only required checks SHALL NOT apply to that ref.

### Requirement: Keep rollout evidence separate from release state
The rollout SHALL preserve prior configuration, verify active rules and record a controlled PR,
without destructive main tests, credential changes, publication or resident-session reload.

#### Scenario: An API mutation has an uncertain result
- **WHEN** request delivery is ambiguous
- **THEN** the operator SHALL read back actual state before retrying or declaring completion.
