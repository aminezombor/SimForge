# MS4 Verification Evidence

## Scope

MS4 closes `AT-016`, `AT-022`, and `AT-023` for the generated primitive robot. It adds a
versioned RobotGraph, structured Blender materialization, deterministic robotics evidence,
exact-approved defect/correction, materialized visual review, and current packaged launch.

## Reproducible Commands

```powershell
pnpm verify
$env:SIMFORGE_BLENDER_PATH = "$env:LOCALAPPDATA\Programs\SimForge\blender\blender.exe"
$env:SIMFORGE_MS4_EVIDENCE_DIR = (Resolve-Path 'docs/evidence/ms4-review').Path
pnpm exec vitest run tests/live/blender-live.test.ts
pnpm package
pnpm package:extension
pnpm exec electron-fuses read --app out\SimForge-win32-x64\SimForge.exe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-local-test.ps1
```

Results on 2026-07-19:

- default verification: 28 passed, 2 opt-in live tests skipped; typecheck, ESLint, and
  secret scan passed across 105 files;
- real Blender 4.5.11: 2 tests passed in 8.92 seconds;
- MS4 path materialized 4 links, 3 joints, 4 collisions, 2 sensor frames and renderable
  sensor bodies; clean robotics blocker/error count was zero;
- an exact-approved raised right wheel produced `ROB-LINK-POSE-001`; another exact
  approval corrected it and revalidation cleared the finding;
- five lit views were written under a revision-unique project path, hashed, persisted,
  integrity-checked, and served through narrow IPC; temporary review objects were removed;
- human review rejected the initial blank and wheel-focused sensor frames, then accepted
  the final view showing the amber sensor mounted on the chassis;
- all nine Electron fuses matched policy; isolated combined renderer/credential smoke
  proved no Node globals, no remote window/navigation, restrictive CSP, protected secret
  lifecycle, no plaintext bytes, a separate database, and unchanged primary DB SHA-256;
- the current desktop icon launched the installed app and Blender with no visible terminal,
  and its authenticated loopback connection remained established at 37 seconds.

## Retained Visual Evidence

- `ms4-review/before-wheel-correction.png`
- `ms4-review/after-wheel-correction.png`
- `ms4-review/sensor-view.png`
- `ms4-review/evidence.json`

The manifest identifies Blender revisions and SHA-256 values. Images are advisory;
deterministic findings and human acceptance remain separate evidence.

## Honest Limits

- Physical values are explicit hackathon assumptions, not measurements.
- Primitive collision/contact rules are not simulator proof.
- Exported hierarchy/physics inspection begins MS5; imported robot integrity is MS8.
- A pre-fix credential smoke may have removed the normal NVIDIA key. No key was exposed;
  re-enter it through Settings before live provider use.
