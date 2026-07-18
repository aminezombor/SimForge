# Acceptance Tests

## Status

Acceptance tests are pending the confirmed product requirements. Define tests before implementing their milestones.

## Test Register

| Test ID | Requirement IDs | Scenario | Preconditions | Procedure | Expected result | Status | Evidence |
| ------- | --------------- | -------- | ------------- | --------- | --------------- | ------ | -------- |
| _AT-Pending_ | _Pending_ | _To be defined_ | _Pending_ | _Pending_ | _Observable outcome_ | Draft | — |

Allowed statuses: Draft, Approved, Ready, Passing, Failing, Blocked.

## Test Design Rules

- Use stable IDs (`AT-001`, `AT-002`, ...).
- Test observable outcomes, not private implementation details.
- Include the main success path and meaningful failure or recovery paths.
- Make procedures repeatable on every supported platform.
- State required sample data, accounts, network access, and environment configuration.
- Keep secrets out of procedures, output, screenshots, and evidence.
- Link automated tests where possible and document necessary manual judge checks.

## Judge-Friendly Test Procedure

_Provide a short, deterministic procedure that starts from documented setup and demonstrates the complete P0 experience._

## Evidence Retention

_For each passing test, link reproducible command output, artifact paths, screenshots, recordings, or commit identifiers in the register and traceability matrix._
