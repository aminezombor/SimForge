# SimForge USD Readiness Report

- Export ID: `cd98d7bd-5cb7-4099-baa8-6cbe62235229`
- Project: Warehouse Manipulator (`230e3b1a-22a3-42ab-9155-47317d2e4532`)
- Robot: `simforge-warehouse-manipulator-v1`
- Environment: `simforge-warehouse-demo-v1`
- Blender scene revision: `3`
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

## Source Validation Summary

- Blockers: 0
- Errors: 0
- Warnings: 0
- Informational: 77

## Physical Assumptions

- Physical values are explicit demo assumptions, not measured hardware data.
- Z=0 is the warehouse support plane and X is robot-forward.
- Collision primitives are conservative approximations of the visual primitives.
- Drive forces and joint limits are prepared metadata and require downstream controller tuning.
- The warehouse is a generated demonstration workcell using primitive geometry.
- Z=0 is the support plane; stacked cargo support is visually and deterministically reviewed.
- Static collision geometry approximates shelving, pallets, cargo, floor, and safety structures.

## Known Limitations

- Physical values marked ASSUMED are not measured hardware data.
- Primitive collision/contact checks are not simulator proof.
- Isaac Sim execution evidence is recorded separately and is never inferred from package validation.

Visual review is advisory. Deterministic Blender and OpenUSD checks are the evidence source.
Isaac Sim execution evidence is recorded separately and is never inferred from package validation.
