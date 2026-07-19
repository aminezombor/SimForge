# MS4 Working Checkpoint — 2026-07-19

## Status

MS4 is implemented far enough for deterministic and live integration testing, but it is
not accepted or complete. This file is the restart point for the next work session.

## Implemented

- Versioned, contract-validated primitive wheeled `RobotGraph` with stable link, joint,
  collision, material, sensor, mass, center-of-mass, and inertia identities.
- Structured Blender robot materialization and exact-approved link-pose correction.
- Deterministic robotics/physics/sensor validation combined with the MS3 geometry channel.
- Revision-bound policy, checkpoints, narrow IPC, persisted review manifests, path
  containment, and SHA-256 image integrity checks.
- Renderer controls for proposal approval, robot build, validation, and review rendering.

## Verification Retained

`pnpm verify` passed on 2026-07-19:

- 28 tests passed; 2 live Blender tests were intentionally skipped by default.
- TypeScript and ESLint passed.
- Secret scan passed across 104 repository files.

Earlier opt-in Blender execution passed both live tests. The MS4 test created a clean
metric scene, materialized four links, three joints, four collisions, and two sensors,
introduced an approved raised-wheel defect, detected `ROB-LINK-POSE-001`, corrected it
through another exact approval, and revalidated successfully.

Retained evidence is in `docs/evidence/ms4-review/`. The before/after three-quarter
images show the wheel correction. The retained sensor view is blank and is therefore not
acceptable visual evidence.

## Resume Checklist

1. Fix the sensor-view camera/composition and rerun the opt-in live test with retained
   evidence; visually inspect every required view.
2. Hide or disable proposal/build actions after a robot is already materialized.
3. Rerun `pnpm verify` and the real Blender acceptance test.
4. Package the app and extension, run renderer/security smoke tests, and refresh the
   desktop test installation without opening terminal windows.
5. Complete MS4 decisions, architecture, traceability, acceptance tests, manual guide,
   progress, and verification evidence.
6. Commit MS4 complete only after those gates pass; then reread persistent memory before
   beginning MS5.

## Repository / Publishing

The checkpoint is on branch `main`. No Git remote is configured, so it cannot be pushed
until the owner supplies or selects a repository destination.
