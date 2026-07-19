# SimForge USD Readiness Report

- Export ID: `67ddf176-8289-4286-a2e2-3879fc735d96`
- Project: Licensed Robot Import (`f121cd28-6b10-4571-b742-83aa1a196b45`)
- Robot: `imported-ros-urdf-tutorial-r2d2-physics-78e6744b67ee`
- Environment: none (neutral placeholder layer)
- Blender scene revision: `2`
- Ready: **YES**
- Convention: Z-up, meters-per-unit 1.0, right-handed X-forward robot graph

## Deterministic USD Checks

- `USD-LAYERS-001`: **PASS**
- `USD-STAGE-001`: **PASS**
- `USD-CONVENTION-001`: **PASS**
- `USD-REFERENCES-001`: **PASS**
- `USD-ROBOT-001`: **PASS**
- `USD-PHYSICS-001`: **PASS**
- `USD-MATERIAL-001`: **PASS**
- `USD-SENSOR-001`: **PASS**
- `USD-ENVIRONMENT-001`: **PASS**

## Imported Asset Provenance

- Asset: ROS URDF Tutorial Physics Robot
- Format: `URDF`
- License: `BSD-3-Clause`
- Source commit: `050f1e47cfdb2c5f3eb0746bc15c57e6a870faef`
- Source SHA-256: `78e6744b67ee07138d370aeea24a6d43d7f7d77025853a995e9685ab41fef047`
- Import status: `STAGED`
- Disclosed conversions: 3
- Disclosed losses: 8

## Source Validation Summary

- Blockers: 0
- Errors: 0
- Warnings: 0
- Informational: 32

## Physical Assumptions

- URDF units are interpreted as meters, kilograms, and radians.
- COLLADA finger meshes are retained as contained source assets but approximated by explicit box primitives.
- RobotGraph v1 flattens visual/collision origins and full inertia tensors with every loss reported.
- The import is translated only on Z so its collision representation contacts the selected Z=0 support plane.
- The added camera is user-approved SimForge metadata, not source URDF data.

## Known Limitations

- Physical values marked ASSUMED are not measured hardware data.
- Primitive collision/contact checks are not simulator proof.
- Isaac Sim execution evidence is recorded separately and is never inferred from package validation.

Visual review is advisory. Deterministic Blender and OpenUSD checks are the evidence source.
Isaac Sim execution evidence is recorded separately and is never inferred from package validation.
