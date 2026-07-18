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

### Cycle Two: finish the submission

| Milestone | Objective | Required outcome / gate |
| --------- | --------- | ----------------------- |
| MS6 - Embedded workspace and UX | Add revision-stamped mini 3D inspection, selection linkage, timeline, richer chat/history, and improved waiting/error states. | Embedded preview matches a known Blender revision and visibly reports staleness. |
| MS7 - Warehouse mobile manipulator | Add warehouse, mobile base, arm, gripper, sensor representation, improved robotics checks, and a deterministic defect/correction. | Full generated demo and final export pass reliably without hard-coded one-off logic. |
| MS8 - Imported robot path | Select a licensed asset, import to staging/`RobotGraph`, record conversion/provenance, modify, validate, and export. | Stage E passes if stable; failure cannot regress or block the generated P0 path. |
| MS9 - Packaging and submission | Produce installer and portable build, clean-machine setup, sample project, complete README, evidence, rehearsed demo, submission copy, and checklist. | Definition of hackathon done and judge procedure pass from a clean account/machine. Remind owner to preserve `/feedback` ID. |

Freeze major architecture changes during cycle two unless a blocking defect is documented and the owner approves the change.

## Current Milestone Status

- MS0: accepted and committed.
- MS1: complete; packaged runtime discovery found the intended Nemotron model and the
  complete thin AI-to-Blender, storage, security, and OpenUSD compatibility evidence passes.
- MS2: complete; modes, exact approvals, jobs, live revisions, manual-edit diffs,
  stale rejection, checkpoint recovery, and controlled Python evidence pass.
- MS3: not started. No deterministic validation capability is claimed yet.

## Post-Hackathon V1 (MS10)

Complete the guaranteed import subset with format fixtures; broaden providers and reusable skills/assets; support advanced global memory, multiple long-running jobs, Linux, deeper CAD conversion, richer sensor/robotics validation, and comprehensive packaging. Reconsider Tauri only with measured Electron constraints and a migration plan.

## Isaac Sim V2 (MS11)

Add an optional Isaac adapter that imports canonical packages, applies simulator-specific layers/configuration, runs tasks, captures structured logs/metrics/media, detects failure conditions, requests AI analysis, gates corrections, reruns, compares metrics, and stores experiments. Core project, provider, approval, validation, and history contracts remain reusable.

## Acceptance Progression

- Stage A: primitive wheeled robot and scene-truth/checkpoint evidence (MS4)
- Stage B: materials, warehouse objects, collision/mass/physics/sensors/naming (MS4-MS7)
- Stage C: arm, joints, gripper, robotics review (MS7)
- Stage D: reopened portable USD package and reports (MS5/MS7)
- Stage E: licensed imported robot path (MS8, P1)

## Review Gates

1. MS0 documentation complete - stop and report.
2. Owner starts MS1/MS2 - complete on 2026-07-18.
3. MS1/MS2 risk spikes and acceptance pass - complete on 2026-07-18.
4. First-cycle vertical slice accepted before P1 viewport/polish.
5. Generated manipulator path stable before imported robot work.
6. Clean-machine acceptance and demo rehearsal before submission.
