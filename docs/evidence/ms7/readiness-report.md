# SimForge USD Readiness Report

- Export ID: `bca43e2f-f15d-4186-8c01-c5d503f0607a`
- Project: Warehouse Manipulator (`d1566a48-e4f5-4428-ba41-b4a413ecd31d`)
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
- Isaac Sim execution is a V2 extension and is not required for this export.

Visual review is advisory. Deterministic Blender and OpenUSD checks are the evidence source.
Isaac Sim execution is not required for this package.
