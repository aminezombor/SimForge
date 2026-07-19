# MS5 Verification Evidence

## Scope

MS5 closes `AT-028`, `AT-029`, and `AT-030`, completing the first-cycle path. It adds
exact export scope approval, Blender staging, neutral OpenUSD composition, quick flattening,
atomic destination promotion with rollback, deep relocated reopen, and machine/human
readiness reports.

## Reproducible Commands

```powershell
pnpm verify
$env:SIMFORGE_BLENDER_PATH = "$env:LOCALAPPDATA\Programs\SimForge\blender\blender.exe"
$env:SIMFORGE_MS5_EVIDENCE_DIR = (Resolve-Path 'docs/evidence/ms5-usd').Path
pnpm exec vitest run tests/live/blender-live.test.ts --reporter=verbose
pnpm package
pnpm package:extension
pnpm exec electron-fuses read --app out\SimForge-win32-x64\SimForge.exe
& out\SimForge-win32-x64\resources\usd-runtime\python.exe `
  out\SimForge-win32-x64\resources\sidecars\usd_worker.py doctor
```

Results on 2026-07-19:

- strict TypeScript, ESLint, 31 default tests, and a 117-file secret scan pass; two real-Blender
  tests remain opt-in in the default suite;
- real Blender 4.5.11 acceptance passes in 12.61 seconds for the prior scene/recovery/robot path plus denied
  unapproved export, tamper denial, denied overwrite, approved overwrite, quick export,
  canonical export, machine/report agreement, package move, and deep reopen;
- the canonical package includes seven composed USD layers, Blender source, project
  manifest, activity history, available generated scripts, review images, validation
  JSON, readiness Markdown, dependency notice, and a role/size/SHA-256 inventory;
- OpenUSD verifies Z-up/meters, contained relative assets, root composition, articulation,
  physics links/joints/collisions, materials, sensors, all hashes, and moved portability;
- the packaged resource reports Python 3.13.14, usd-core 26.5, and UsdPhysics available;
- packaged renderer/credential smoke passes in an isolated profile and all nine Electron
  fuses match policy;
- the reinstalled desktop shortcut opens four Electron processes and one Blender process,
  establishes the bridge with zero new visible terminal windows, removes seven historical
  stale descriptors on startup, and leaves zero descriptors/processes after graceful exit.

## Retained Machine Evidence

- `ms5-usd/acceptance.json`
- `ms5-usd/manifest.json`
- `ms5-usd/validation-results.json`
- `ms5-usd/readiness-report.md`

The acceptance record contains `USD-DEEP-REOPEN-001`, `USD-PORTABILITY-001`, and
`movedReopen: true`. Reports explicitly state that model assertions are not evidence.

## Security Correction

An installed-launch diagnostic accidentally displayed one ephemeral loopback descriptor.
The exact installed app and Blender processes were stopped immediately, revoking the
session; no provider credential was involved or committed. Investigation found normal
Electron quit did not await asynchronous bridge cleanup. Graceful shutdown now waits,
startup removes dead/expired/malformed descriptors, and integration coverage proves a
fresh token is issued without logging descriptor contents.

## Honest Limits

- Physical values remain labeled assumptions and are not simulator proof.
- The package is neutral OpenUSD/UsdPhysics; Isaac execution remains V2.
- Signing, clean-account installation, upgrade/uninstall, and release-wide license audit
  remain MS9.
