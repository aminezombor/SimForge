# Requirements Traceability

## Purpose and Field Rules

This matrix is the delivery ledger for every confirmed requirement. IDs and meanings match `PRODUCT_REQUIREMENTS.md`; rows are never removed to conceal failure or deferral.

Allowed priorities: `HACKATHON-P0`, `HACKATHON-P1`, `POST-HACKATHON-V1`, `V2-ISAAC-SIM`. Allowed statuses: Not started, Researched, Planned, In progress, Blocked, Implemented, Tested, Accepted, Deferred with approval. Evidence is required before Tested or Accepted.

| ID | Requirement | Priority | Planned milestone | Acceptance test | Status | Evidence |
| -- | ----------- | -------- | ----------------- | --------------- | ------ | -------- |
| REQ-PROD-001 | Standalone local-first conversational robotics desktop app | HACKATHON-P0 | MS1 | AT-006, AT-034 | Planned | - |
| REQ-PROD-002 | Complete approved plan-to-verified-USD loop | HACKATHON-P0 | MS5 | AT-016, AT-021, AT-024, AT-029, AT-030 | Planned | - |
| REQ-PROD-003 | Real Blender scene is authoritative and changes are tracked | HACKATHON-P0 | MS2 | AT-012, AT-013 | Planned | - |
| REQ-PROD-004 | General product beyond warehouse example | HACKATHON-P0 | MS7 | AT-017, AT-020 | Planned | - |
| REQ-PROD-005 | Complete warehouse mobile-manipulator demonstration content | HACKATHON-P0 | MS7 | AT-017 | Planned | - |
| REQ-PROD-006 | Transparent, reliable, approval-aware, reversible automation | HACKATHON-P0 | MS3 | AT-008, AT-010, AT-026 | Planned | - |
| REQ-PROD-007 | Deterministic evidence and human approval for ambiguity | HACKATHON-P0 | MS3 | AT-021, AT-022, AT-025 | Planned | - |
| REQ-PROD-008 | Preserve future Isaac feedback loop outside hackathon | V2-ISAAC-SIM | MS11 | AT-038 | Planned | `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` |
| REQ-MODE-001 | Normal Chat supports required discussion and requests | HACKATHON-P0 | MS2 | AT-008, AT-010 | Planned | - |
| REQ-MODE-002 | Plan Mode supports read-only inspection and planning | HACKATHON-P0 | MS2 | AT-009 | Planned | - |
| REQ-MODE-003 | Plan Mode is technically non-mutating | HACKATHON-P0 | MS2 | AT-009 | Planned | - |
| REQ-MODE-004 | Build Mode gates risky actions and permits safe actions | HACKATHON-P0 | MS2 | AT-010 | Planned | - |
| REQ-MODE-005 | Goal Mode decomposes work and asks only material questions | HACKATHON-P0 | MS2 | AT-011 | Planned | - |
| REQ-MODE-006 | Goal Mode shows progress, checkpoints, validation, and gates | HACKATHON-P0 | MS2 | AT-011 | Planned | - |
| REQ-MODE-007 | Goal jobs pause/cancel/retry/rewind/branch/resume | HACKATHON-P0 | MS2 | AT-011 | Planned | - |
| REQ-MODE-008 | Jobs persist across restart while chat remains usable | HACKATHON-P0 | MS2 | AT-011 | Planned | - |
| REQ-MODE-009 | Goal Mode never performs restricted actions silently | HACKATHON-P0 | MS2 | AT-009, AT-010, AT-011 | Planned | - |
| REQ-MODE-010 | Approval gates occur only at material decision points | HACKATHON-P0 | MS2 | AT-010, AT-025, AT-029 | Planned | - |
| REQ-AI-001 | NVIDIA-first provider with user key | HACKATHON-P0 | MS1 | AT-003, AT-004 | Planned | - |
| REQ-AI-002 | Runtime NVIDIA model discovery/validation | HACKATHON-P0 | MS1 | AT-004 | Planned | - |
| REQ-AI-003 | Runtime capability probes and records | HACKATHON-P0 | MS1 | AT-004 | Planned | - |
| REQ-AI-004 | Clear unavailability and fallback behavior | HACKATHON-P0 | MS1 | AT-004, AT-005 | Planned | - |
| REQ-AI-005 | Nemotron selected only when discovered and suitable | HACKATHON-P0 | MS1 | AT-004 | Planned | - |
| REQ-AI-006 | Optional OpenAI provider proves independence | HACKATHON-P0 | MS1 | AT-005 | Planned | - |
| REQ-AI-007 | Capability-based model routing | HACKATHON-P1 | MS6 | AT-005 | Planned | - |
| REQ-AI-008 | Manual/automatic provider and model controls | HACKATHON-P1 | MS6 | AT-005, AT-032 | Planned | - |
| REQ-AI-009 | Visible provider/model and selection reason | HACKATHON-P0 | MS2 | AT-005, AT-008 | Planned | - |
| REQ-AI-010 | Usage/cost, budget, and fallback controls | HACKATHON-P1 | MS6 | AT-005 | Planned | - |
| REQ-AI-011 | Provider-neutral stored project/chat/tool data | HACKATHON-P0 | MS1 | AT-005, AT-006 | Planned | - |
| REQ-AI-012 | Vision work only reaches probed visual models | HACKATHON-P0 | MS4 | AT-004, AT-022 | Planned | - |
| REQ-UX-001 | Visible phase/task/tool/action/files/dependencies/results/provider/progress | HACKATHON-P0 | MS2 | AT-008 | Planned | - |
| REQ-UX-002 | Concise operational rationale without chain-of-thought claims | HACKATHON-P0 | MS2 | AT-008 | Planned | - |
| REQ-UX-003 | Multiple persistent project conversations with lifecycle/search | HACKATHON-P0 | MS6 | AT-007 | Planned | - |
| REQ-UX-004 | Edit/resend/retry/stop/branch conversation controls | HACKATHON-P1 | MS6 | AT-007 | Planned | - |
| REQ-UX-005 | Image/reference attachments with provenance and disclosure | HACKATHON-P0 | MS6 | AT-007, AT-032 | Planned | - |
| REQ-UX-006 | Plan/task/activity/change/action/validation/export views | HACKATHON-P0 | MS6 | AT-008, AT-027 | Planned | - |
| REQ-UX-007 | Context indication and safe compaction | HACKATHON-P1 | MS6 | AT-007 | Planned | - |
| REQ-UX-008 | Distinct controllable project/global memory | HACKATHON-P1 | MS6 | AT-007, AT-032 | Planned | - |
| REQ-UX-009 | Undo/revisions/empty/wait/error/recovery experience | HACKATHON-P0 | MS6 | AT-008, AT-026 | Planned | - |
| REQ-UX-010 | No secrets in conversation history | HACKATHON-P0 | MS1 | AT-003, AT-007 | Planned | - |
| REQ-DATA-001 | Multiple locally owned portable projects | HACKATHON-P0 | MS1 | AT-006 | Planned | - |
| REQ-DATA-002 | Store brief/chat/memory/references/docs/plans/decisions | HACKATHON-P0 | MS1 | AT-006, AT-007 | Planned | - |
| REQ-DATA-003 | Store Blender source/scripts/actions/snapshots/validation | HACKATHON-P0 | MS2 | AT-006, AT-012, AT-026 | Planned | - |
| REQ-DATA-004 | Store dependencies/assets/attribution/physics/sensors/exports/reports/previews | HACKATHON-P0 | MS5 | AT-006, AT-029, AT-030, AT-036 | Planned | - |
| REQ-DATA-005 | Store named versions/branches/checkpoints/job state | HACKATHON-P1 | MS6 | AT-011, AT-026, AT-027 | Planned | - |
| REQ-DATA-006 | Reusable libraries for robotics authoring resources | POST-HACKATHON-V1 | MS10 | AT-037 | Planned | - |
| REQ-BLENDER-001 | Collaborate with a real running Blender scene | HACKATHON-P0 | MS1 | AT-012 | Planned | - |
| REQ-BLENDER-002 | Fresh structured snapshot before scene-dependent work | HACKATHON-P0 | MS1 | AT-012, AT-013 | Planned | - |
| REQ-BLENDER-003 | Detect manual edits, refresh, and show diffs | HACKATHON-P0 | MS2 | AT-013 | Planned | - |
| REQ-BLENDER-004 | Reject stale mutations and preserve manual work | HACKATHON-P0 | MS2 | AT-013 | Planned | - |
| REQ-BLENDER-005 | Checkpoint before risky Blender operations | HACKATHON-P0 | MS1 | AT-012, AT-026 | Planned | - |
| REQ-BLENDER-006 | Synchronize while remaining responsive | HACKATHON-P0 | MS2 | AT-011, AT-012 | Planned | - |
| REQ-BLENDER-007 | Recover/relink after disconnect or crash | HACKATHON-P0 | MS2 | AT-014 | Planned | - |
| REQ-BLENDER-008 | Structured tools for common operations | HACKATHON-P0 | MS1 | AT-012, AT-016 | Planned | - |
| REQ-BLENDER-009 | Controlled Blender Python fallback | HACKATHON-P0 | MS2 | AT-015 | Planned | - |
| REQ-BLENDER-010 | Generated Python is explained/logged/gated/scoped/validated/reusable | HACKATHON-P0 | MS2 | AT-015, AT-031 | Planned | - |
| REQ-VIEW-001 | Useful embedded mini 3D inspection workspace | HACKATHON-P1 | MS6 | AT-018 | Planned | - |
| REQ-VIEW-002 | Orbit/pan/zoom/select/identify/hierarchy controls | HACKATHON-P1 | MS6 | AT-018 | Planned | - |
| REQ-VIEW-003 | Dimensions/materials/updates/comparison/selection/Blender switch | HACKATHON-P1 | MS6 | AT-018 | Planned | - |
| REQ-VIEW-004 | Revision freshness and no silent divergence | HACKATHON-P1 | MS6 | AT-018 | Planned | - |
| REQ-IMPORT-001 | Architecture accommodates full broad import/reference list | POST-HACKATHON-V1 | MS10 | AT-037 | Planned | `docs/ARCHITECTURE.md` extension contract |
| REQ-IMPORT-002 | Complete guaranteed V1 focus subset with evidence | POST-HACKATHON-V1 | MS10 | AT-019, AT-020, AT-037 | Planned | - |
| REQ-IMPORT-003 | One licensed external robot import/modify/validate/export path | HACKATHON-P1 | MS8 | AT-020 | Planned | - |
| REQ-IMPORT-004 | Import/conversion/loss/units/material/hierarchy/license/status report | HACKATHON-P1 | MS8 | AT-019, AT-020 | Planned | - |
| REQ-IMPORT-005 | Evaluate, pin, attribute, isolate, and secure external reuse | HACKATHON-P0 | MS0/MS9 | AT-031, AT-036 | Researched | `docs/RESEARCH.md`, `docs/DEPENDENCIES_AND_LICENSES.md` |
| REQ-VALIDATION-001 | Combine scene, deterministic, USD, visual, and human evidence | HACKATHON-P0 | MS3 | AT-021, AT-022, AT-023, AT-030 | Planned | - |
| REQ-VALIDATION-002 | Validate units/orientation/transforms/origins/bounds/dimensions | HACKATHON-P0 | MS3 | AT-021 | Planned | - |
| REQ-VALIDATION-003 | Validate contact/clearance/intersections/penetration | HACKATHON-P0 | MS3 | AT-021 | Planned | - |
| REQ-VALIDATION-004 | Validate duplicates/visibility/existence/topology/complexity | HACKATHON-P0 | MS3 | AT-021 | Planned | - |
| REQ-VALIDATION-005 | Validate materials/textures/files/naming/hierarchy | HACKATHON-P0 | MS3 | AT-021 | Planned | - |
| REQ-VALIDATION-006 | Materialized multi-view visual review | HACKATHON-P1 | MS4 | AT-022 | Planned | - |
| REQ-VALIDATION-007 | No material-less screenshot as final evidence | HACKATHON-P0 | MS4 | AT-022 | Planned | - |
| REQ-VALIDATION-008 | Validate kinematic/joint/articulation structure | HACKATHON-P0 | MS4 | AT-023 | Planned | - |
| REQ-VALIDATION-009 | Validate collision/body/contact/physics/import integrity | HACKATHON-P0 | MS4 | AT-023 | Planned | - |
| REQ-VALIDATION-010 | Validate physical/sensor/convention data and mark assumptions | HACKATHON-P0 | MS4 | AT-023 | Planned | - |
| REQ-VALIDATION-011 | Reopen and deeply validate USD stage/package | HACKATHON-P0 | MS5 | AT-029 | Planned | - |
| REQ-VALIDATION-012 | Machine and human reports; model assertion is not evidence | HACKATHON-P0 | MS5 | AT-030 | Planned | - |
| REQ-FIX-001 | Auto-fix only clear safe reversible local non-creative changes | HACKATHON-P0 | MS3 | AT-024, AT-025 | Planned | - |
| REQ-FIX-002 | Rule-gated safe correction set | HACKATHON-P0 | MS3 | AT-024 | Planned | - |
| REQ-FIX-003 | Approval for design/behavior/physical/file/dependency/export ambiguity | HACKATHON-P0 | MS3 | AT-025 | Planned | - |
| REQ-FIX-004 | Log, undo, and revalidate automatic fixes | HACKATHON-P0 | MS3 | AT-024, AT-026 | Planned | - |
| REQ-HISTORY-001 | Undo latest safe action | HACKATHON-P0 | MS3 | AT-024, AT-026 | Planned | - |
| REQ-HISTORY-002 | Complete recoverable project checkpoint | HACKATHON-P0 | MS3 | AT-026 | Planned | - |
| REQ-HISTORY-003 | Named versions and checkpoint branching | HACKATHON-P1 | MS6 | AT-027 | Planned | - |
| REQ-HISTORY-004 | Actor/tool/model/validation/checkpoint/export timeline | HACKATHON-P1 | MS6 | AT-027 | Planned | - |
| REQ-USD-001 | Explicit export/destination/overwrite/package intent | HACKATHON-P0 | MS5 | AT-028, AT-029 | Planned | - |
| REQ-USD-002 | Verified single-file quick USD | HACKATHON-P0 | MS5 | AT-028 | Planned | - |
| REQ-USD-003 | Portable modular robotics-ready package | HACKATHON-P0 | MS5 | AT-029 | Planned | - |
| REQ-USD-004 | Package provenance/dependencies/results/previews/reports/manifest/conventions/limits | HACKATHON-P0 | MS5 | AT-029, AT-030, AT-036 | Planned | - |
| REQ-USD-005 | Reopen and verify every artifact | HACKATHON-P0 | MS5 | AT-028, AT-029 | Planned | - |
| REQ-USD-006 | Preserve/export source/project/scripts/actions/version | HACKATHON-P0 | MS5 | AT-029 | Planned | - |
| REQ-SECURITY-001 | Local-first portable project storage | HACKATHON-P0 | MS1 | AT-006, AT-032 | Planned | - |
| REQ-SECURITY-002 | Accurate cloud payload/provider/purpose disclosure | HACKATHON-P0 | MS1 | AT-032 | Planned | - |
| REQ-SECURITY-003 | Project controls for uploads/providers/cloud/memory/logging | HACKATHON-P1 | MS6 | AT-032 | Planned | - |
| REQ-SECURITY-004 | Never send secrets/unrelated/environment/unneeded private data | HACKATHON-P0 | MS1 | AT-003, AT-032 | Planned | - |
| REQ-SECURITY-005 | OS-protected secrets and no secret log/commit | HACKATHON-P0 | MS1 | AT-003 | Planned | - |
| REQ-SECURITY-006 | Restricted local services and loopback Blender bridge | HACKATHON-P0 | MS1 | AT-031 | Planned | - |
| REQ-SECURITY-007 | Privileged execution and secret-safe source/evidence/submission | HACKATHON-P0 | MS2 | AT-015, AT-031, AT-035 | Planned | - |
| REQ-PLATFORM-001 | Windows-first without needless future Linux barrier | HACKATHON-P0 | MS1/MS9 | AT-033, AT-037 | Planned | - |
| REQ-PLATFORM-002 | Installer/portable build, one-click no-terminal launch | HACKATHON-P0 | MS9 | AT-033, AT-034 | Planned | - |
| REQ-PLATFORM-003 | Developer build and uninstall/cleanup instructions | HACKATHON-P0 | MS9 | AT-033, AT-034 | Planned | - |
| REQ-PLATFORM-004 | Supported versions, actionable errors, Environment Doctor | HACKATHON-P0 | MS9 | AT-033 | Planned | - |
| REQ-PLATFORM-005 | Complete Environment Doctor checks | HACKATHON-P0 | MS9 | AT-033 | Planned | - |
| REQ-PLATFORM-006 | Isaac Sim is not a V1 hard dependency | HACKATHON-P0 | MS9 | AT-033, AT-034 | Planned | `docs/ARCHITECTURE.md` |
| REQ-SUBMISSION-001 | Developer tools category | HACKATHON-P0 | MS9 | AT-035 | Planned | `docs/HACKATHON_SCOPE.md` |
| REQ-SUBMISSION-002 | Working project/repository/description/README/setup | HACKATHON-P0 | MS9 | AT-034, AT-035 | Planned | - |
| REQ-SUBMISSION-003 | Sample, judge test, expected results, troubleshooting, platform, no rebuild | HACKATHON-P0 | MS9 | AT-034 | Planned | - |
| REQ-SUBMISSION-004 | License/notices/inventory/screenshots/report/roadmap/test evidence | HACKATHON-P0 | MS9 | AT-030, AT-035, AT-036 | Planned | - |
| REQ-SUBMISSION-005 | Public narrated demo under three minutes with Codex/GPT-5.6 use | HACKATHON-P0 | MS9 | AT-035 | Planned | - |
| REQ-SUBMISSION-006 | Rehearsed demo and complete submission copy/checklist | HACKATHON-P0 | MS9 | AT-035 | Planned | - |
| REQ-SUBMISSION-007 | Primary Codex session, acceleration log, private feedback-ID reminder | HACKATHON-P0 | MS9 | AT-035, AT-039 | Planned | `docs/CODEX_USAGE_LOG.md` |
| REQ-GOV-001 | Clean repository/docs are source of truth; no prior code | HACKATHON-P0 | MS0 | AT-002 | Tested | `AGENTS.md`, Git tree |
| REQ-GOV-002 | Maintain and reread persistent documents | HACKATHON-P0 | MS0-MS11 | AT-001, AT-039 | Tested | `AGENTS.md`, complete `docs/` tree |
| REQ-GOV-003 | Every requirement has ID/priority/milestone/test/status/evidence | HACKATHON-P0 | MS0 | AT-001 | Tested | This matrix; completeness audit |
| REQ-GOV-004 | Small milestone workflow with checkpoint/test/docs/commit/risks | HACKATHON-P0 | MS0-MS11 | AT-039 | Planned | MS0 evidence in `docs/PROGRESS.md` |
| REQ-GOV-005 | No completion without reproducible non-model-only evidence | HACKATHON-P0 | MS0-MS11 | AT-039 | Planned | `AGENTS.md`, test policy |
| REQ-GOV-006 | Required integration-test coverage | HACKATHON-P0 | MS1-MS9 | AT-003 through AT-036 | Planned | `docs/ACCEPTANCE_TESTS.md` |
| REQ-GOV-007 | Two-cycle delivery strategy | HACKATHON-P0 | MS1-MS9 | AT-039 | Planned | `docs/ROADMAP.md` |
| REQ-GOV-008 | Primary research, alternatives, risks, approval before implementation | HACKATHON-P0 | MS0 | AT-001, AT-036, AT-039 | Tested | `docs/RESEARCH.md`, `docs/DECISIONS.md`, approved plan |
| REQ-V2-001 | Isaac imports package and configures tasks | V2-ISAAC-SIM | MS11 | AT-038 | Planned | `docs/ARCHITECTURE.md` extension point |
| REQ-V2-002 | Run simulations and capture evidence/failures | V2-ISAAC-SIM | MS11 | AT-038 | Planned | - |
| REQ-V2-003 | AI analysis and approved correction | V2-ISAAC-SIM | MS11 | AT-038 | Planned | - |
| REQ-V2-004 | Rerun, compare, and retain experiment history | V2-ISAAC-SIM | MS11 | AT-038 | Planned | - |

## Master Brief Coverage

| Brief section | Persistent coverage |
| ------------- | ------------------- |
| 1. Codex role and technical ownership | `AGENTS.md`; REQ-GOV-001, REQ-GOV-008 |
| 2. Clean-build rule | `AGENTS.md`; REQ-GOV-001; AT-002 |
| 3. Hackathon context | REQ-SUBMISSION-001 through REQ-SUBMISSION-007; submission checklist |
| 4. Product vision | REQ-PROD-001 through REQ-PROD-008; product vision |
| 5. Target users | `PRODUCT_VISION.md`; REQ-PROD-006 |
| 6. Demonstration goal | REQ-PROD-004, REQ-PROD-005; AT-017 |
| 7. Operating modes | REQ-MODE-001 through REQ-MODE-009 |
| 8. Approval gates | REQ-MODE-010; AT-010, AT-025, AT-029 |
| 9. AI architecture | REQ-AI-001 through REQ-AI-012; architecture/provider contract |
| 10. AI transparency | REQ-UX-001, REQ-UX-002; AT-008 |
| 11. Chat experience | REQ-UX-003 through REQ-UX-010; AT-007, AT-008 |
| 12. Project and memory model | REQ-DATA-001 through REQ-DATA-006; architecture data model |
| 13. Blender collaboration | REQ-BLENDER-001 through REQ-BLENDER-010; AT-012 through AT-015 |
| 14. Embedded workspace | REQ-VIEW-001 through REQ-VIEW-004; AT-018 |
| 15. Input/import support | REQ-IMPORT-001 through REQ-IMPORT-004; AT-019, AT-020, AT-037 |
| 16. External tools/assets/open source | REQ-IMPORT-005; research and dependency inventory |
| 17. Scene intelligence/validation | REQ-VALIDATION-001 through REQ-VALIDATION-012; AT-021 through AT-023, AT-029, AT-030 |
| 18. Automatic correction | REQ-FIX-001 through REQ-FIX-004; AT-024, AT-025 |
| 19. Checkpoints/history/branches | REQ-HISTORY-001 through REQ-HISTORY-004; AT-026, AT-027 |
| 20. Export behavior | REQ-USD-001 through REQ-USD-006; AT-028 through AT-030 |
| 21. Privacy/security | REQ-SECURITY-001 through REQ-SECURITY-007; security/privacy documents |
| 22. Platform/installation | REQ-PLATFORM-001 through REQ-PLATFORM-006; AT-033, AT-034 |
| 23. Priority tiers | `HACKATHON_SCOPE.md`; priority column in this matrix |
| 24. Two-cycle strategy | REQ-GOV-007; roadmap |
| 25. Required research | REQ-GOV-008, REQ-IMPORT-005; research inventory |
| 26. Persistent documentation | REQ-GOV-002; complete required file set |
| 27. Requirements traceability | REQ-GOV-003; this matrix |
| 28. Development/execution rules | REQ-GOV-004 through REQ-GOV-006; `AGENTS.md`; AT-039 |
| 29. Suggested milestones | `ROADMAP.md` MS0-MS9 |
| 30. Acceptance progression | AT-016, AT-017, AT-020, AT-023, AT-029, AT-030 |
| 31. Repository submission content | REQ-SUBMISSION-002 through REQ-SUBMISSION-007; checklist |
| 32. Demo design | `DEMO_SCRIPT.md`; AT-035 |
| 33. Definition of hackathon done | P0 trace rows; checklist final gate; AT-034 through AT-036 |
| 34. First task | MS0 document set, decisions, audit, and stop gate |

## Completeness Audit

The automated/document review for MS0 must confirm:

- Product requirement rows: 123
- Traceability rows: 123
- Duplicate or missing requirement IDs: 0
- Invalid priorities, milestones, statuses, or acceptance-test references: 0
- Requirements without a milestone or acceptance test: 0
- Master brief numbered sections reviewed: 34 of 34
- Explicit future-tier requirements retained: all `POST-HACKATHON-V1` and `V2-ISAAC-SIM` rows

Final verified counts and commands are recorded in `PROGRESS.md` before the MS0 commit.
