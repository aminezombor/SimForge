# MS7 Warehouse Manipulator Verification

## Scope

MS7 closes `AT-017` and the generated portions of `REQ-PROD-004/005` and
`REQ-VALIDATION-008/009`. It extends the general `RobotGraph` path with a versioned
`EnvironmentGraph`, exact-approved assembly materialization, deterministic `ENV-*`
rules, a visible gripper defect/correction, six-view review, and real environment USD.

## Reproducible Commands

```powershell
pnpm verify
$env:SIMFORGE_BLENDER_PATH = (Resolve-Path '.tools/blender-4.5.11/blender-4.5.11-windows-x64/blender.exe').Path
$env:SIMFORGE_MS7_EVIDENCE_DIR = (Resolve-Path 'docs/evidence/ms7').Path
pnpm exec vitest run tests/live/blender-live.test.ts -t "warehouse mobile manipulator assembly" --reporter=verbose
pnpm package
pnpm package:extension
pnpm exec electron-fuses read --app out/SimForge-win32-x64/SimForge.exe
```

## Results

- TypeScript, ESLint, 40 default tests, and the 143-file secret scan pass; three
  real-Blender tests are opt-in in the default suite.
- Blender 4.5.11 materializes 12 links, 11 joints, 12 collision bodies, 3 sensor frames,
  and 15 static warehouse objects with 15 collision representations.
- Fresh robotics/environment validation has zero blockers or errors. Moving one gripper
  finger emits `ROB-LINK-POSE-001`; exact-approved correction checkpoints the scene and
  clears the finding on reinspection.
- Human inspection confirms the defect is visible, the corrected gripper is symmetric,
  materials are legible, and the overview shows the complete workcell. Review images are
  revision-bound, hashed, and advisory.
- Canonical export includes real robot and environment geometry. Twelve USD checks pass,
  including articulation, physics, sensors, 15 environment identities, references,
  hashes, and deep reopen after moving the package.
- The packaged app and extension build successfully. Isolated renderer, credential, and
  privacy smoke passes; all nine Electron 43 fuses match policy.

## Retained Evidence

`docs/evidence/ms7/` contains before/after/overview PNGs, `acceptance.json`, the USD
manifest, machine validation, readiness report, and packaged-smoke result. No provider
credential or private session identifier is present.

## Honest Boundary

Physical values are explicit demonstration assumptions, not measured hardware data or
simulator proof. Imported-asset integrity remains MS8; Isaac execution remains V2.
