# SimForge USD Readiness Report

- Export ID: `1627edf1-8fd3-47c1-b4d9-fbb1f13a1698`
- Project: Real Robot (`a1715f09-ef9b-4c63-b6e6-d54ec49331a7`)
- Robot: `simforge-primitive-wheeled-v1`
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

## Source Validation Summary

- Blockers: 0
- Errors: 0
- Warnings: 0
- Informational: 16

## Physical Assumptions

- Physical values are explicit hackathon assumptions, not measured hardware data.
- Z=0 is the support plane and X is robot-forward.
- Collision primitives intentionally approximate visual primitives.
- Drive force values are placeholders for downstream tuning and require human approval before behavioral use.

## Known Limitations

- Physical values marked ASSUMED are not measured hardware data.
- Primitive collision/contact checks are not simulator proof.
- Isaac Sim execution is a V2 extension and is not required for this export.

Visual review is advisory. Deterministic Blender and OpenUSD checks are the evidence source.
Isaac Sim execution is not required for this package.
