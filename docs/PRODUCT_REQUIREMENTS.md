# Product Requirements

## Document Status and Policy

- Status: Confirmed baseline
- Last updated: 2026-07-18
- Source: Complete master build brief and approved MS0 plan
- Change control: IDs are permanent. Change, deferral, reprioritization, or removal requires explicit owner approval and a linked decision.

Requirements describe outcomes and constraints, not implementation choices. Allowed priorities are `HACKATHON-P0`, `HACKATHON-P1`, `POST-HACKATHON-V1`, and `V2-ISAAC-SIM`. Delivery status and evidence are maintained in `REQUIREMENTS_TRACEABILITY.md`.

## Product and Demonstration

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-PROD-001 | Provide a standalone, local-first desktop application in which users create or prepare robotics assets and environments through conversational AI. | HACKATHON-P0 | Brief 4 |
| REQ-PROD-002 | Support the complete loop from idea and approved plan through Blender work, live inspection, deterministic validation, safe correction, explicit USD export, reinspection, and readiness report. | HACKATHON-P0 | Brief 4 |
| REQ-PROD-003 | Treat the real running Blender scene as authoritative and track what changed rather than relying on conversational memory. | HACKATHON-P0 | Brief 4, 13 |
| REQ-PROD-004 | Remain useful for robots, parts, materials, environments, imported assets, and engineering scenes rather than hard-coding the warehouse demonstration. | HACKATHON-P0 | Brief 6 |
| REQ-PROD-005 | Demonstrate a warehouse mobile manipulator containing a wheeled base, arm, gripper, sensor representation, warehouse objects, materials, collisions, physics metadata, hierarchy, joint preparation, and verified USD export. | HACKATHON-P0 | Brief 6 |
| REQ-PROD-006 | Make AI work transparent, reliable, approval-aware, and reversible for non-expert as well as engineering users. | HACKATHON-P0 | Brief 5 |
| REQ-PROD-007 | Use deterministic evidence and human approval for ambiguous design decisions; visual AI must not be the only source of truth. | HACKATHON-P0 | Brief 17 |
| REQ-PROD-008 | Preserve a future Isaac Sim build-test-analyze-correct-rerun loop without making it part of the hackathon implementation. | V2-ISAAC-SIM | Brief 4 |

## Operating Modes and Approval

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-MODE-001 | Normal Chat supports questions, exploration, scene discussion and inspection, small edits, troubleshooting, design decisions, and import/export requests. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-002 | Plan Mode may inspect files and Blender, analyze the scene, discuss options, estimate consequences, prepare validation criteria, and produce a plan. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-003 | Plan Mode must be technically unable to mutate Blender because mutating capabilities are withheld, not merely because the model is instructed not to act. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-004 | Build Mode may execute approved or permitted actions; small safe reversible changes may run directly while large, destructive, expensive, structural, or difficult-to-reverse actions require approval. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-005 | Goal Mode decomposes an outcome into visible tasks, asks only material questions, applies sensible minor defaults, and waits for plan approval. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-006 | Goal Mode shows progress, saves checkpoints, validates important stages, and pauses at agreed approval gates. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-007 | Goal jobs support pause, cancel, retry, rewind, branch, resume, and clear failure recovery. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-008 | Persist job state across restarts and allow continued chat while long local work runs. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-009 | Goal Mode never silently exports, publishes, deletes, replaces major work, installs dangerous dependencies, or makes major behavioral changes. | HACKATHON-P0 | Brief 7 |
| REQ-MODE-010 | Use approval gates for the initial plan, major design, visual review, physics/robotics configuration, USD readiness, and final destination/package; ask only when the answer materially affects outcome, cost, privacy, security, behavior, or reversibility. | HACKATHON-P0 | Brief 8 |

## AI Providers and Routing

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-AI-001 | Make NVIDIA the primary provider and support the user's NVIDIA API key. | HACKATHON-P0 | Brief 9 |
| REQ-AI-002 | Discover or validate available NVIDIA models at runtime rather than trusting remembered identifiers. | HACKATHON-P0 | Brief 9 |
| REQ-AI-003 | Safely probe required tool use, streaming, reasoning controls, vision, context, and output capabilities and record the observed capability matrix. | HACKATHON-P0 | Brief 9 |
| REQ-AI-004 | Handle primary-model unavailability with an understandable error and configured fallback behavior. | HACKATHON-P0 | Brief 9 |
| REQ-AI-005 | Provide Nemotron 3 Ultra as the intended primary planning model only when runtime discovery and probing confirm it is available and suitable. | HACKATHON-P0 | Brief 9 |
| REQ-AI-006 | Prove provider independence with an optional OpenAI provider when practical without weakening NVIDIA support. | HACKATHON-P0 | Brief 9 |
| REQ-AI-007 | Route work by capabilities such as orchestration, Blender scripting, vision, summarization, validation review, speed, cost, and fallback reasoning. | HACKATHON-P1 | Brief 9 |
| REQ-AI-008 | Allow manual provider/model selection, automatic routing, provider enable/disable, and preferred-model configuration. | HACKATHON-P1 | Brief 9 |
| REQ-AI-009 | Show which provider/model handled a task and a concise selection reason. | HACKATHON-P0 | Brief 9, 10 |
| REQ-AI-010 | Show usage and estimated cost where available and support provider budgets and fallback preferences. | HACKATHON-P1 | Brief 9 |
| REQ-AI-011 | Keep project data, tools, chat history, memory, plans, and stored events provider-neutral. | HACKATHON-P0 | Brief 9 |
| REQ-AI-012 | Route rendered-image review only to a model whose probed capabilities include vision; text-only models must not receive implied vision work. | HACKATHON-P0 | Brief 9, 17 |

## Transparency, Chat, and Memory Experience

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-UX-001 | Show current phase/task, tool, Blender action, inspected files, dependencies under consideration, scene changes, validation, errors/retries, provider/model, and deterministic local progress. | HACKATHON-P0 | Brief 10 |
| REQ-UX-002 | Use activity summaries, concise rationales, plans, decision records, tool descriptions, evidence, and action logs without claiming to expose hidden chain-of-thought or overwhelming the user. | HACKATHON-P0 | Brief 10 |
| REQ-UX-003 | Support multiple project-associated conversations with persistent history, rename, delete, and search. | HACKATHON-P0 | Brief 11 |
| REQ-UX-004 | Support edit-and-resend, response retry, stopping a running action, and branching from an earlier conversation point. | HACKATHON-P1 | Brief 11 |
| REQ-UX-005 | Support image and reference-file attachments with clear provenance and cloud-dispatch disclosure. | HACKATHON-P0 | Brief 11, 21 |
| REQ-UX-006 | Provide plan, task/progress, activity, scene-change, action/code, validation, and export-history views. | HACKATHON-P0 | Brief 11 |
| REQ-UX-007 | Provide context-size indication and manual/automatic context compaction without losing confirmed repository or project memory. | HACKATHON-P1 | Brief 11 |
| REQ-UX-008 | Separate project memory from global memory and let users inspect, edit, export, disable, or delete memory. | HACKATHON-P1 | Brief 11 |
| REQ-UX-009 | Provide undo/revision controls, useful empty and waiting states, friendly errors, and actionable recovery guidance. | HACKATHON-P0 | Brief 11 |
| REQ-UX-010 | Never store or display secrets in conversation history. | HACKATHON-P0 | Brief 11 |

## Projects and Local Data

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-DATA-001 | Support multiple saved projects whose data is locally owned and portable. | HACKATHON-P0 | Brief 12 |
| REQ-DATA-002 | Store each project's brief, conversations, memory, references, images/documents, plans, and decisions. | HACKATHON-P0 | Brief 12 |
| REQ-DATA-003 | Store Blender source, generated scripts, structured actions/history, scene snapshots, and validation results. | HACKATHON-P0 | Brief 12 |
| REQ-DATA-004 | Store dependencies, downloaded assets and attribution, physics/sensor configuration, exports, reports, and previews. | HACKATHON-P0 | Brief 12 |
| REQ-DATA-005 | Store named versions, branches, checkpoints, and persistent job state with recoverable relationships. | HACKATHON-P1 | Brief 12, 19 |
| REQ-DATA-006 | Design reusable libraries for robots, parts, materials, environments, sensors, validation rules, automation skills, export configurations, and future Isaac assets. | POST-HACKATHON-V1 | Brief 12 |

## Blender Collaboration

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-BLENDER-001 | Work against a real running Blender scene that the AI and human can edit collaboratively. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-002 | Read a fresh structured scene snapshot immediately before planning or executing scene-dependent work. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-003 | Detect manual edits, refresh stale state, and report meaningful scene differences. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-004 | Reject stale mutations and avoid overwriting manual work unexpectedly. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-005 | Create a recoverable checkpoint before risky Blender operations. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-006 | Keep application and Blender state synchronized while remaining responsive during long operations. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-007 | Recover clearly from disconnects or crashes and support relinking to an existing project where feasible. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-008 | Use structured, predictable tools for common scene operations. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-009 | Provide a controlled Blender Python fallback for operations not represented by structured tools. | HACKATHON-P0 | Brief 13 |
| REQ-BLENDER-010 | For generated Blender Python, display intent, log code/action, checkpoint risky execution, constrain scope, treat it as privileged, validate afterward, and promote repeated useful operations to structured skills where practical. | HACKATHON-P0 | Brief 13 |

## Embedded Workspace

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-VIEW-001 | Provide a useful embedded mini 3D inspection workspace where technically practical without attempting to replace Blender. | HACKATHON-P1 | Brief 14 |
| REQ-VIEW-002 | Support orbit, pan, zoom, selection, object identification, and hierarchy inspection. | HACKATHON-P1 | Brief 14 |
| REQ-VIEW-003 | Show dimensions, materials, meaningful scene updates, before/after comparison, and clear selection linkage, with a way to switch to Blender. | HACKATHON-P1 | Brief 14 |
| REQ-VIEW-004 | Indicate revision freshness and never present an embedded view that silently diverges from Blender. | HACKATHON-P1 | Brief 14 |

## Imports and External Reuse

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-IMPORT-001 | Architect for Blender, OBJ, FBX, GLB/GLTF, STL, PLY, USD variants, URDF, Xacro, MJCF, STEP/IGES, images, drawings, PDFs, documents, and specifications. | POST-HACKATHON-V1 | Brief 15 |
| REQ-IMPORT-002 | Guarantee the V1 focus subset of Blender, USD, GLB/GLTF, FBX, OBJ, STL, URDF, and MJCF with format-specific evidence before claiming support. | POST-HACKATHON-V1 | Brief 15 |
| REQ-IMPORT-003 | Demonstrate one licensed external NVIDIA or open-source robot through import, inspection, meaningful modification, validation, and export when it does not threaten the generated P0 path. | HACKATHON-P1 | Brief 23, 30 |
| REQ-IMPORT-004 | Report imported and converted content, information loss, unit/scale assumptions, material/hierarchy issues, source/license, and validation status. | HACKATHON-P1 | Brief 15 |
| REQ-IMPORT-005 | Evaluate external tools/assets for license, restrictions, activity, security, compatibility, platform support, burden, lock-in, reproducibility, and alternatives; pin versions, preserve attribution, isolate dependencies, and never silently execute untrusted code. | HACKATHON-P0 | Brief 16 |

## Scene Intelligence and Validation

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-VALIDATION-001 | Combine fresh Blender inspection, deterministic geometry/metadata checks, USD-stage inspection, rendered visual review, and human approval for ambiguity. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-002 | Validate units, scale, coordinate orientation, transforms, origins/pivots, bounding boxes, dimensions, and unapplied transforms where relevant. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-003 | Validate floating objects, ground contact, clearance, intersections, and penetration. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-004 | Validate duplicates, hidden/missing objects, normals, manifoldness, degeneracy, and excessive mesh complexity. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-005 | Validate material assignment, texture paths, external files, naming, and hierarchy consistency. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-006 | Produce materialized, lit review images with useful angles, close-ups, sensor views, before/after views, and reference comparison where applicable. | HACKATHON-P1 | Brief 17 |
| REQ-VALIDATION-007 | Do not use material-less viewport screenshots as evidence of final visual correctness. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-008 | Validate kinematic hierarchy, links/joints, axes, limits, types, articulation root, drives, mimic relationships, fixed/moving components, and exported hierarchy. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-009 | Validate collision geometry, self-collision considerations, static/dynamic bodies, ground contact, physics materials, and imported robot integrity. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-010 | Validate mass, center of mass, inertia, units/conventions, sensor frames, camera orientation, field-of-view metadata, and naming; mark physical assumptions instead of fabricating them. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-011 | After export, reopen the USD stage and validate references/assets, portability, layers/composition, units/up axis, hierarchy, physics/collision/mass/inertia/articulation/joint/material/sensor metadata. | HACKATHON-P0 | Brief 17 |
| REQ-VALIDATION-012 | Produce machine-readable validation results and a human-readable readiness report; a model's assertion is never export evidence. | HACKATHON-P0 | Brief 17 |

## Corrections and Recovery

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-FIX-001 | Automatically correct only changes that are clearly correct, safe, reversible, localized, non-creative, and non-destructive. | HACKATHON-P0 | Brief 18 |
| REQ-FIX-002 | Support safe fixes such as unambiguous transforms/normals, local references, naming conflicts, missing previews/export metadata, and simple ground contact, subject to rule preconditions. | HACKATHON-P0 | Brief 18 |
| REQ-FIX-003 | Require approval before changing design/proportions, joints/kinematics, appearance, layout, physical assumptions, collision strategy, sensors, files, dependencies, destination, or anything destructive/ambiguous. | HACKATHON-P0 | Brief 18 |
| REQ-FIX-004 | Log every automatic fix, make it undoable, and re-run the relevant deterministic validation. | HACKATHON-P0 | Brief 18 |
| REQ-HISTORY-001 | Reverse the latest safe SimForge or Blender action when an inverse operation exists. | HACKATHON-P0 | Brief 19 |
| REQ-HISTORY-002 | Checkpoints capture Blender/source, project metadata, task state, scripts, asset references, physics, validation, and important project files. | HACKATHON-P0 | Brief 19 |
| REQ-HISTORY-003 | Support meaningful named versions and branching from an earlier checkpoint. | HACKATHON-P1 | Brief 19 |
| REQ-HISTORY-004 | Show a timeline of what/when/actor/model/tool, validation status, checkpoint association, and export creation; do not rely on conversational undo alone. | HACKATHON-P1 | Brief 19 |

## USD Export

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-USD-001 | Never export without explicit user intent and approval of the operation, destination, overwrite, and final package creation. | HACKATHON-P0 | Brief 20 |
| REQ-USD-002 | Provide a convenient single-file quick USD export for inspection. | HACKATHON-P0 | Brief 20 |
| REQ-USD-003 | Provide a self-contained modular robotics-ready package with main entry point, geometry, materials, physics, robot structure, sensors/placeholders, and portable relative references. | HACKATHON-P0 | Brief 20 |
| REQ-USD-004 | Include attribution, dependencies, validation results, previews, human report, machine manifest, version, coordinate/unit conventions, known limitations, and assumptions. | HACKATHON-P0 | Brief 20 |
| REQ-USD-005 | Reopen and verify every produced artifact before reporting success. | HACKATHON-P0 | Brief 20 |
| REQ-USD-006 | Preserve or export the Blender source, project metadata, scripts/actions, and relevant version/branch information. | HACKATHON-P0 | Brief 20 |

## Privacy and Security

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-SECURITY-001 | Store projects locally by default and keep them portable. | HACKATHON-P0 | Brief 21 |
| REQ-SECURITY-002 | Before cloud processing, communicate what text/images/files or extracted content is sent, which provider/model receives it, and why. | HACKATHON-P0 | Brief 21 |
| REQ-SECURITY-003 | Provide project controls for visual/file upload, provider choice, cloud processing, memory, and logging where practical. | HACKATHON-P1 | Brief 21 |
| REQ-SECURITY-004 | Never send API keys, credentials, unrelated or environment files, or unnecessary private project content. | HACKATHON-P0 | Brief 21 |
| REQ-SECURITY-005 | Store provider secrets through an appropriate operating-system credential mechanism and never log or commit complete secrets. | HACKATHON-P0 | Brief 21 |
| REQ-SECURITY-006 | Restrict local services and never expose the Blender execution bridge broadly over the network. | HACKATHON-P0 | Brief 21 |
| REQ-SECURITY-007 | Treat generated/local code execution as privileged and protect source, logs, screenshots, demos, evidence, and submission materials from secret leakage. | HACKATHON-P0 | Brief 3, 21 |

## Platform and Installation

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-PLATFORM-001 | Support Windows first while avoiding unnecessary barriers to a future Linux release. | HACKATHON-P0 | Brief 22 |
| REQ-PLATFORM-002 | Provide a guided installer or packaged build, one-click normal launch, and a no-terminal normal-user experience. | HACKATHON-P0 | Brief 22 |
| REQ-PLATFORM-003 | Provide a reproducible developer build path plus clear uninstall/cleanup instructions. | HACKATHON-P0 | Brief 22 |
| REQ-PLATFORM-004 | Provide supported-version documentation, actionable failure messages, and an Environment Doctor. | HACKATHON-P0 | Brief 22 |
| REQ-PLATFORM-005 | Environment Doctor checks Blender/install integration, runtime, providers, GPU/driver where relevant, USD tools, extensions, permissions, ports, dependency health, and later Isaac readiness. | HACKATHON-P0 | Brief 22 |
| REQ-PLATFORM-006 | Do not require Isaac Sim for the hackathon release; an optional smoke test may exist only if it cannot threaten delivery. | HACKATHON-P0 | Brief 22 |

## Hackathon Submission

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-SUBMISSION-001 | Use Developer tools as the selected category unless later approved evidence supports a better category. | HACKATHON-P0 | Brief 3 |
| REQ-SUBMISSION-002 | Deliver a working project, judge-accessible repository, clear description, feature/architecture summaries, and complete README/setup/run instructions. | HACKATHON-P0 | Brief 3, 31 |
| REQ-SUBMISSION-003 | Include a sample project/data, judge-friendly deterministic test path, expected results, troubleshooting, limitations, supported platforms, and a path that does not require rebuilding. | HACKATHON-P0 | Brief 3, 31 |
| REQ-SUBMISSION-004 | Include project license, third-party notices, dependency inventory, attribution, screenshots, readiness-report example, roadmap, and testing evidence. | HACKATHON-P0 | Brief 3, 31 |
| REQ-SUBMISSION-005 | Produce a public YouTube demo shorter than three minutes with audio explaining the product and how Codex/GPT-5.6 were used. | HACKATHON-P0 | Brief 3, 32 |
| REQ-SUBMISSION-006 | Prepare a deterministic rehearsed demo, Devpost description, feature/technical summaries, shot list, narration, timing plan, and submission checklist. | HACKATHON-P0 | Brief 31, 32 |
| REQ-SUBMISSION-007 | Use this Codex session for most core implementation where practical, document important Codex decisions/acceleration, and privately preserve/remind the owner to submit the `/feedback` session ID. | HACKATHON-P0 | Brief 3, 31, 33 |

## Delivery Governance

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-GOV-001 | Treat this clean repository and its documentation as the implementation source of truth; do not inspect or copy an old implementation without explicit selected input. | HACKATHON-P0 | Brief 1, 2 |
| REQ-GOV-002 | Maintain every required persistent document and reread the memory set before major milestones. | HACKATHON-P0 | Brief 26, 28 |
| REQ-GOV-003 | Give every confirmed requirement a stable ID, allowed priority, named milestone, acceptance test, current status, and completion evidence. | HACKATHON-P0 | Brief 27 |
| REQ-GOV-004 | Work in small tested milestones with checkpoints, demonstrations, documentation updates, traceability, progress/Codex logs, focused commits, and risk reports. | HACKATHON-P0 | Brief 28 |
| REQ-GOV-005 | Do not claim completion without reproducible evidence or replace deterministic/integration tests with model self-evaluation. | HACKATHON-P0 | Brief 28 |
| REQ-GOV-006 | Run integration tests for mode enforcement, Blender connection/inspection/mutation/manual edits, recovery, validation/fixes, USD export/reinspection/missing references, provider fallback, and secret redaction. | HACKATHON-P0 | Brief 28 |
| REQ-GOV-007 | Execute two usage cycles: first prove chat-to-verified-USD with a primitive robot; then finish manipulator, warehouse, materials/sensors, recovery, polish, packaging, sample, demo, and submission without avoidable architecture churn. | HACKATHON-P0 | Brief 24 |
| REQ-GOV-008 | Research primary sources and reuse candidates before adoption, compare credible architectures, document assumptions/risks/deferred scope, and require owner approval before major implementation or scope change. | HACKATHON-P0 | Brief 25, 34 |

## V2 Isaac Sim Feedback Loop

Change-control note (2026-07-19, DEC-028): the owner promoted these requirements into
active pre-submission implementation. Their stable IDs and `V2-ISAAC-SIM` priority labels
remain unchanged; Isaac Sim remains optional for core authoring but installed-runtime
acceptance is required before the release-candidate review gate.

| ID | Confirmed requirement | Priority | Source |
| -- | --------------------- | -------- | ------ |
| REQ-V2-001 | Import the verified USD package into Isaac Sim and configure runnable simulation tasks. | V2-ISAAC-SIM | Brief 23 |
| REQ-V2-002 | Run simulations and capture logs, metrics, images/video, and explicit failure conditions. | V2-ISAAC-SIM | Brief 23 |
| REQ-V2-003 | Use AI to analyze simulation results, propose changes, and apply only approved corrections. | V2-ISAAC-SIM | Brief 23 |
| REQ-V2-004 | Rerun simulations, compare outcomes, and maintain reproducible experiment history. | V2-ISAAC-SIM | Brief 23 |

## Explicit Non-Requirements for the Hackathon

- Self-hosting Nemotron 3 Ultra.
- Replacing Blender with the embedded viewport.
- Treating visual/model opinion as deterministic proof.
- Running arbitrary generated Blender code without approval and recovery.
- Making Isaac Sim a required installation.
- Claiming complete CAD or all-format fidelity during the hackathon.
- Implementing multiple concurrent mutating jobs before the single-job path is stable.

## Change History

| Date | Requirement IDs | Change | Approval/decision |
| ---- | --------------- | ------ | ----------------- |
| 2026-07-18 | All | Extracted the complete master brief into 123 stable requirements and assigned priority tiers. | Approved MS0 plan; DEC-003 through DEC-014 |
