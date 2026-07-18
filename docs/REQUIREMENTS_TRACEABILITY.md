# Requirements Traceability

## Purpose

Maintain an auditable path from each confirmed requirement to delivery and verification. Add every confirmed requirement immediately; never remove a row to hide deferral or failure.

| ID | Requirement | Priority | Planned milestone | Acceptance test | Status | Evidence |
| -- | ----------- | -------- | ----------------- | --------------- | ------ | -------- |
| _Pending_ | _Awaiting confirmed requirements_ | _Pending_ | _Unplanned_ | _Unspecified_ | Proposed | — |

## Field Rules

- **ID:** Stable requirement ID matching `PRODUCT_REQUIREMENTS.md`.
- **Requirement:** Concise outcome; preserve the approved meaning.
- **Priority:** One of `HACKATHON-P0`, `HACKATHON-P1`, `POST-HACKATHON-V1`, or `V2-ISAAC-SIM`.
- **Planned milestone:** A milestone ID from `ROADMAP.md`.
- **Acceptance test:** One or more test IDs from `ACCEPTANCE_TESTS.md`.
- **Status:** Proposed, Confirmed, Planned, In progress, Implemented, Verified, Blocked, or owner-approved Deferred.
- **Evidence:** Test output, screenshot, recording, file, commit, or other reproducible proof.

## Audit Checklist

- Every confirmed requirement appears exactly once as a primary row.
- Every confirmed requirement maps to an approved milestone and acceptance test.
- Every verified requirement has current evidence.
- Priority, status, and wording agree with requirements and scope documents.
- Deferral or scope change links to explicit owner approval in `DECISIONS.md`.
