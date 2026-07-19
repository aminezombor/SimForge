# SimForge

SimForge is a Windows-first, local-first desktop tool for conversational robotics
authoring in a real Blender scene. MS1 through MS7 establish the complete first cycle,
the final workspace foundation, and the generated warehouse demonstration:
chat or an approved goal produces a structured Blender operation, the app captures
fresh scene truth, checkpoints before mutation, rejects stale work, and records an
auditable activity trail. Deterministic geometry findings can drive a preconditioned
safe correction, exact-approved structural correction, inverse undo, and full recovery.

Current milestone state: MS1 through MS7 are complete with deterministic, packaged,
real-Blender, and live NVIDIA evidence. Runtime discovery found the intended Nemotron
3 Ultra model and proved streamed text plus a non-executed no-op tool call. Eighteen
stable geometry/scene rules and approved complete checkpoint restore pass in Blender
4.5.11. A versioned primitive wheeled robot, robotics/physics/sensor rules, exact-approved
defect correction, and five lit revision/hash-stamped review views now pass. Exact-approved
quick and canonical USD exports include neutral physics/sensor layers, source/provenance,
machine and human reports, hashes, and deep relocated OpenUSD reopen evidence. The
owner-approved three-column workspace now adds persistent conversations, scoped memory,
capability-aware routing, an exact-revision Three.js/GLB inspector with Blender selection
linkage, responsive context drawers, named history, and packaged privacy controls. A
general `EnvironmentGraph` now joins the reusable `RobotGraph` path: the exact-approved
warehouse assembly contains 12 links, 11 joints, 3 sensors, and 15 collision-backed
environment objects. A visible gripper defect is detected and corrected under policy,
and the moved canonical USD reopens with robot and environment evidence passing. MS8 is
the licensed imported-robot path.

The product information architecture is documented in
[the workspace contract](docs/UX_WORKSPACE.md) and its MS6 implementation has passed
[visual and functional verification](docs/evidence/MS6_VERIFICATION.md).

## Repository Map

- `src/` - sandboxed React renderer, narrow preload bridge, Electron main services,
  provider adapters, policy, persistence, jobs, and Blender protocol
- `blender-extension/` - GPL-3.0-or-later Blender 4.5 LTS extension
- `sidecars/` - Apache-2.0 fixed OpenUSD authoring/verification worker
- `tests/` - unit, contract, bridge, security, and opt-in real-Blender tests
- `docs/` - persistent requirements, decisions, traceability, evidence, and progress

Project data is portable (`simforge.project.json`, `.simforge/project.sqlite`,
`scene/`, `scripts/`, `checkpoints/`, `exports/`, and `reports/`). Credentials stay
outside projects under Windows-protected `%LOCALAPPDATA%\SimForge` storage.

## Development

Prerequisites: Windows 11 x64, Node.js 24+, pnpm 11+, Python 3.13, and Blender
4.5 LTS for live integration.

```powershell
pnpm install
pnpm verify
pnpm start
pnpm package
pnpm package:extension
```

`pnpm verify` runs strict TypeScript, ESLint, Vitest, and the repository secret
scan. `pnpm package` creates `out/SimForge-win32-x64/SimForge.exe`.

Prepare and prove the pinned OpenUSD seam:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-usd.ps1
.\.venv-usd\Scripts\python.exe sidecars\usd_worker.py spike --output .\reports\usd-spike\scene.usda
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-usd-runtime.ps1
.\.tools\usd-runtime\python.exe sidecars\usd_worker.py doctor
```

Run the opt-in real Blender acceptance fixture:

```powershell
$env:SIMFORGE_BLENDER_PATH = 'C:\path\to\Blender 4.5\blender.exe'
pnpm exec vitest run tests/live/blender-live.test.ts --reporter=verbose
```

## One-click Local Test Build

After `pnpm verify`, `pnpm package`, and `pnpm package:extension`, install the
developer test build for the current Windows user:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-local-test.ps1
```

This verifies the prepared Blender 4.5.11 executable, installs the extension, and
creates **SimForge Hackathon** on the desktop. The shortcut starts SimForge and Blender,
auto-connects the authenticated local bridge, and leaves no terminal open. This is a
test convenience, not the future signed MS9 installer; Blender remains a separately
licensed executable. Follow [the MS1/MS2 foundation test](docs/MS1_MS2_MANUAL_TEST.md)
and [the MS3 validation/recovery test](docs/MS3_MANUAL_TEST.md).
Use [the MS4 robot/review test](docs/MS4_MANUAL_TEST.md) for the current installed build.
Use [the MS5 verified export test](docs/MS5_MANUAL_TEST.md) for quick/canonical USD.
Use [the MS7 warehouse test](docs/MS7_MANUAL_TEST.md) for the generated demonstration.

## Security and Licensing

The renderer has no Node/process/filesystem authority. The main process validates
narrow IPC, exact approvals, project paths, provider payloads, and the authenticated
loopback Blender protocol. Never paste keys into chat or commit them; use Provider
Settings. See [Security](docs/SECURITY.md) and [Privacy](docs/PRIVACY.md).

Desktop code is Apache-2.0. Blender-loaded code is GPL-3.0-or-later. See
[LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
