# MS1/MS2 Verification Evidence

Date: 2026-07-18. Platform: Windows x64. Evidence contains no credentials or
private model payloads.

## Environment

| Component | Verified version/source |
| --------- | ----------------------- |
| Node / pnpm | Node 24.18.0; pnpm 11.9.0 |
| Electron | 43.1.1, packaged by Electron Forge 7.11.2 |
| Blender | Official portable Blender 4.5.11 LTS ZIP; published and computed SHA-256 `e11d3a8e4d4249be5a7db4a9325c1f670037d4233467c3b0bda181001efe44d3` |
| Python / OpenUSD | Python 3.13.14; `usd-core` 26.5 / USD 0.26.5 |

## Reproducible Commands and Results

```powershell
pnpm verify
# 20 tests pass, one opt-in Blender test skips; typecheck/lint/secret scan pass

$env:SIMFORGE_BLENDER_PATH = 'C:\path\to\blender.exe'
pnpm exec vitest run tests/live/blender-live.test.ts --reporter=verbose
# 1 test passes

pnpm package
# out/SimForge-win32-x64/SimForge.exe created

pnpm exec electron-fuses read --app out\SimForge-win32-x64\SimForge.exe
# all nine Electron 43 fuse settings match the reviewed policy

pnpm package:extension
# out/simforge_bridge-0.1.0.zip created

powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-usd.ps1
.\.venv-usd\Scripts\python.exe sidecars\usd_worker.py spike --output <new-scene.usda>
# authored and reopened /World; Z-up; metersPerUnit 1.0
```

The real-Blender fixture proves authenticated connect, fresh non-mutating snapshot,
provider-neutral AI tool routing, checkpoint save-copy, structured cube mutation,
pre/post revisions, manual-edit event and diff, stale rejection, crash detection,
checkpoint reopen/reconnect with monotonic revision floor, project-path rejection,
approved Python failure recovery, archived script metadata, and post-run inspection.

Packaged security smoke proves renderer `require` and `process` are undefined, the
preload exposes only the typed SimForge API, remote windows and navigation are denied,
and CSP is restrictive. Direct fuse inspection proves Node-as-runtime, Node options,
CLI inspection, and legacy file privileges are disabled while ASAR integrity and cookie
encryption are enabled. Packaged credential smoke proves Windows-protected storage,
user-only ACL application, removal, and no plaintext credential bytes under app data.

## Acceptance Mapping

- Passing: AT-003, AT-005, AT-006, AT-008 through AT-015.
- Passing for the MS2 attack surface: AT-031; import/export and release-package cases
  remain in their planned milestones.
- Blocked only on owner credential: AT-004 live NVIDIA discovery/capability evidence.

## Honest Limitations

No live NVIDIA credential was available during this evidence run. The adapters,
discovery gate, text-only Nemotron classification, unavailability behavior, disclosure,
and normalized tool fixtures are tested deterministically, but AT-004 cannot pass until
the protected live probe runs. Validation, robot construction, and product USD export
are not claimed; they remain MS3-MS5.
