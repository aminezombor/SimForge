# MS8 Imported Robot and Native-Format Verification

## Scope

MS8 closes `AT-019` and `AT-020`: one pinned BSD-3-Clause URDF is copied, hash-checked,
converted to `RobotGraph`, exact-approved into Blender, meaningfully modified, validated,
reviewed, and exported. BLEND, USD, GLB, FBX, OBJ, and STL use isolated exact-approved
native staging and accept/reject decisions without weakening the generated P0 path.

## Reproducible Commands

```powershell
pnpm verify
$env:SIMFORGE_BLENDER_PATH = (Resolve-Path '.tools/blender-4.5.11/blender-4.5.11-windows-x64/blender.exe').Path
$env:SIMFORGE_MS8_EVIDENCE_DIR = (Resolve-Path 'docs/evidence/ms8').Path
pnpm exec vitest run tests/live/blender-live.test.ts --reporter=verbose
pnpm package
pnpm package:extension
pnpm audit --prod
pnpm exec electron-fuses read --app out/SimForge-win32-x64/SimForge.exe
```

## Results

- TypeScript, ESLint, 44 default tests, and the 168-file secret scan pass; all five real
  Blender 4.5.11 tests pass in 34.55 seconds.
- The licensed URDF creates 16 links, 15 joints, 16 collisions, and zero blocking/error
  findings. An unapproved camera change is denied; exact approval adds one head camera.
- Eight retained COLLADA uses are disclosed as box approximations. Source commit, license,
  paths, byte counts, hashes, conversions, losses, and modification travel with export.
- Canonical USD passes 12 checks and deep-reopens after moving; source, license, import
  report, machine validation, human report, notices, and hashes are present.
- Real Blender stages and accepts each native format, rejects a separate OBJ cleanly,
  creates 15 checkpoints, rejects a bridge path escape, and rejects source tampering after
  approval without changing the scene revision.
- The packaged app, extension ZIP, production dependency audit, renderer/credential/privacy
  smoke, all nine Electron fuses, and packaged sample-data inventory pass.
- Fresh packaged 1280 x 720 workspace/import captures retain the owner-approved three-column
  layout with no actionable visual regression.

## Retained Evidence

`docs/evidence/ms8/` contains acceptance/import/native-matrix JSON, before-delivery review
PNGs, USD manifest/validation/readiness report, packaged smoke, and production UI captures.
No provider credential or private session identifier is present.

## Honest Boundary

MS8 proves one contained URDF subset and self-contained native fixtures. It does not claim
general Xacro, MJCF, arbitrary package resolution, or multi-file native dependency support;
those remain mapped to `POST-HACKATHON-V1`. Isaac execution evidence begins in MS11A.
