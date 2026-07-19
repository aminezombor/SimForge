# Roadmap

## Delivery Policy

Each milestone begins by rereading persistent memory and naming requirements/tests. It
ends only after reproducible evidence, documentation/traceability/progress updates, a
working commit, and a risk report. The owner started MS1/MS2 on 2026-07-18.

## Two-Cycle Plan

### Cycle One: prove the thin vertical slice

| Milestone | Objective | Required outcome / gate |
| --------- | --------- | ----------------------- |
| MS0 - Documentation and architecture | Convert the master brief into persistent product memory, research, decisions, security/privacy, atomic traceability, tests, and an approved architecture. | Zero unmapped requirements; documentation committed; stop before code. |
| MS1 - Thin AI-to-Blender slice | Prove the risky seams, then connect one provider to one structured primitive action in Blender with activity and checkpointing. | Packaged Electron/storage spike; provider discovery/stream/tool probe; Blender connect/snapshot/mutate; OpenUSD author/reopen spike. Demonstrate one visible scene change. |
| MS2 - Enforced planning and scene truth | Implement modes, approvals, live revisions, manual-edit detection, and diffs. | Plan Mode mutation tests fail closed; approved Build action succeeds; stale mutation is rejected; reconnect refreshes truth. |
| MS3 - Deterministic validation | Add geometry rules, findings UI/reporting, safe local fixes, and recovery. | Known defects are caught; an allowed fix is reversible and revalidated; structural fix waits for approval. |
| MS4 - Primitive wheeled robot | Build a structured robot from primitives with materials, collisions, mass/physics metadata, and review renders. | Acceptance Stage A/B passes with recorded assumptions and checkpoint. |
| MS5 - Verified USD export | Produce quick and canonical packages, reopen them through OpenUSD, and generate machine/human reports. | First-cycle loop passes end to end: chat -> approved plan -> Blender -> scene truth -> validation -> checkpoint -> verified USD. |

### Cycle Two: complete the product and release candidate

| Milestone | Objective | Required outcome / gate |
| --------- | --------- | ----------------------- |
| MS6 - Embedded workspace and UX | Deliver `UX_WORKSPACE.md`: conversation rail, central mode-aware authoring surface, revision-stamped 3D inspector, context dock, timeline/history, Settings separation, and responsive waiting/error states. | The owner-directed workspace is integrated; embedded preview matches a known Blender revision and visibly reports staleness. |
| MS7 - Warehouse mobile manipulator | Add warehouse, mobile base, arm, gripper, sensor representation, improved robotics checks, and a deterministic defect/correction. | Full generated demo and final export pass reliably without hard-coded one-off logic. |
| MS8 - Imported robot path | Select a licensed asset, import to staging/`RobotGraph`, record conversion/provenance, modify, validate, and export. | Stage E passes if stable; failure cannot regress or block the generated P0 path. |
| MS11A - Isaac runtime and evidence | Detect a separately installed Isaac Sim, hand off the verified canonical package, run a deterministic headless task, and capture structured metrics, media, failures, logs, and provenance. | A real Isaac-compatible machine produces a reloadable experiment with retained source/export/runtime hashes; absent or unsupported Isaac fails clearly without disabling authoring. |
| MS11B - Closed simulation feedback loop | Analyze retained simulation evidence, propose a bounded correction, require exact owner approval, apply through Blender authority, re-export, rerun, compare, and retain the lineage. | AT-038 passes end to end with no model-only success claim and no unapproved mutation. |
| MS9A - Packaging and owner test candidate | Produce installer and portable build, clean-account setup, sample projects, Environment Doctor, uninstall/cleanup, and the exact owner test procedure. | Working release candidate passes deterministic, Blender, OpenUSD, Isaac, packaged-security, and clean-install checks; stop for owner hands-on validation. |
| MS9B - Final documentation, video, and submission | After owner validation, finalize README/judge copy, record the under-three-minute demo, complete submission text/checklist, and preserve the private `/feedback` ID. | Definition of hackathon done and every submission placeholder resolved. |

Freeze major architecture changes during cycle two unless a blocking defect is documented and the owner approves the change.

## Current Milestone Status

- MS0: accepted and committed.
- MS1: complete; packaged runtime discovery found the intended Nemotron model and the
  complete thin AI-to-Blender, storage, security, and OpenUSD compatibility evidence passes.
- MS2: complete; modes, exact approvals, jobs, live revisions, manual-edit diffs,
  stale rejection, checkpoint recovery, and controlled Python evidence pass.
- MS3: complete. Eighteen stable geometry/scene/topology/material/reference rules,
  persisted findings, safe preconditioned correction, exact structural approval,
  inverse undo, and complete approved checkpoint restore pass unit and real Blender
  evidence. Robotics/renders remain MS4; USD evidence remains MS5.
- MS4: complete. Versioned RobotGraph authoring, structured Blender materialization,
  stable sensor representation, explicit physical assumptions, deterministic robotics
  rules, exact-approved defect/correction, five-view hashed evidence, packaging, and the
  installed no-terminal shortcut pass.
- MS5: complete. Exact destination/overwrite approval, Blender staging, quick `.usdc`,
  canonical relative-reference layers, SHA-256 inventory, source/previews/notices,
  matching reports, embedded runtime, and deep relocated OpenUSD reopen pass.
- MS6: complete. The owner-approved three-column workspace, conversations, scoped memory,
  routing/settings, exact-revision GLB inspection, Blender selection linkage, stale state,
  comparisons, versions/timeline, responsive drawers, and privacy controls pass unit,
  real-Blender, browser, packaged-security, and recoverable-deletion evidence.
- MS7: complete. General robot/environment graphs, exact-approved assembly materialization,
  deterministic environment/robotics evidence, visible gripper defect/correction, six-view
  review, and robot-plus-environment USD pass in real Blender without architecture change.
- MS8: complete. A pinned BSD-3-Clause URDF converts to `RobotGraph`, receives an
  exact-approved camera modification, validates, renders, and exports with provenance.
  Real Blender also stages and exact-accepts/rejects the BLEND/USD/GLB/FBX/OBJ/STL matrix.
- MS11A: active. Implement the optional runtime doctor, canonical package handoff,
  deterministic real Isaac execution, retained metrics/media/logs, and experiment reload.
- MS11B: follows MS11A and closes the approved correction/re-export/rerun comparison loop.
- MS9A: follows the full simulation loop and ends at the owner hands-on validation gate.
- MS9B: intentionally waits for owner validation; it contains final documentation,
  demo-video recording, and submission.

## Post-Hackathon V1 (MS10)

Complete the guaranteed import subset with format fixtures; broaden providers and reusable skills/assets; support advanced global memory, multiple long-running jobs, Linux, deeper CAD conversion, richer sensor/robotics validation, and comprehensive packaging. Reconsider Tauri only with measured Electron constraints and a migration plan.

## Isaac Sim Feedback Loop (MS11A/MS11B, promoted before submission)

Add an optional Isaac adapter that imports canonical packages, applies simulator-specific
layers/configuration, runs deterministic tasks, captures structured logs/metrics/media,
detects failure conditions, requests evidence-grounded AI analysis, gates corrections,
reruns, compares metrics, and stores reloadable experiments. Core project, provider,
approval, validation, and history contracts remain reusable. Isaac Sim stays separately
installed so Blender authoring and verified neutral USD export still work without it.

## Acceptance Progression

- Stage A: primitive wheeled robot and scene-truth/checkpoint evidence (MS4)
- Stage B: materials, warehouse objects, collision/mass/physics/sensors/naming (MS4-MS7)
- Stage C: arm, joints, gripper, robotics review (MS7)
- Stage D: reopened portable USD package and reports (MS5/MS7)
- Stage E: licensed imported robot path (MS8, P1)
- Stage F: real Isaac Sim import/run/evidence (MS11A)
- Stage G: approved correction/rerun comparison and experiment reload (MS11B)

## Review Gates

1. MS0 documentation complete - stop and report.
2. Owner starts MS1/MS2 - complete on 2026-07-18.
3. MS1/MS2 risk spikes and acceptance pass - complete on 2026-07-18.
4. First-cycle vertical slice accepted before P1 viewport/polish.
5. Generated manipulator path stable before imported robot work.
6. Owner-approved scope expansion: complete MS11A/MS11B before the release candidate.
7. Clean-account release candidate and owner hands-on validation (MS9A).
8. Final documentation, demo video, and submission only after owner validation (MS9B).
