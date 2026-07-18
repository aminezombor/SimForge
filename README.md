# SimForge

SimForge is a Windows-first, local-first desktop tool for conversational robotics
authoring in a real Blender scene. MS1 and MS2 establish the safe vertical slice:
chat or an approved goal produces a structured Blender operation, the app captures
fresh scene truth, checkpoints before mutation, rejects stale work, and records an
auditable activity trail.

Current milestone state: MS1 and MS2 are complete with deterministic, packaged,
real-Blender, and live NVIDIA evidence. Runtime discovery found the intended Nemotron
3 Ultra model and proved streamed text plus a non-executed no-op tool call. Validation,
robot generation, and verified USD export begin in MS3-MS5.

## Repository Map

- `src/` - sandboxed React renderer, narrow preload bridge, Electron main services,
  provider adapters, policy, persistence, jobs, and Blender protocol
- `blender-extension/` - GPL-3.0-or-later Blender 4.5 LTS extension
- `sidecars/` - Apache-2.0 OpenUSD compatibility worker
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

Bootstrap and prove the pinned OpenUSD seam:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-usd.ps1
.\.venv-usd\Scripts\python.exe sidecars\usd_worker.py spike --output .\reports\usd-spike\scene.usda
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
licensed executable. Follow [the MS1/MS2 manual test](docs/MS1_MS2_MANUAL_TEST.md).

## Security and Licensing

The renderer has no Node/process/filesystem authority. The main process validates
narrow IPC, exact approvals, project paths, provider payloads, and the authenticated
loopback Blender protocol. Never paste keys into chat or commit them; use Provider
Settings. See [Security](docs/SECURITY.md) and [Privacy](docs/PRIVACY.md).

Desktop code is Apache-2.0. Blender-loaded code is GPL-3.0-or-later. See
[LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
