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
# 21 tests pass, one opt-in Blender test skips; typecheck/lint/secret scan pass

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

# After configuring the NVIDIA key only through packaged Provider Settings:
$env:SIMFORGE_SMOKE_RESULT = Join-Path (Get-Location) 'reports\evidence\runtime\nvidia-live.json'
$probe = Start-Process .\out\SimForge-win32-x64\SimForge.exe `
  -ArgumentList '--provider-acceptance-test' -WindowStyle Hidden -PassThru -Wait
if ($probe.ExitCode -ne 0) { throw 'Provider acceptance process failed' }
Get-Content $env:SIMFORGE_SMOKE_RESULT
# 119 models; intended Nemotron discovered; streamed text/no-op tool call pass
```

The real-Blender fixture proves authenticated connect, fresh non-mutating snapshot,
provider-neutral AI tool routing, checkpoint save-copy, structured cube mutation,
pre/post revisions, manual-edit event and diff, stale rejection, crash detection,
checkpoint reopen/reconnect with monotonic revision floor, project-path rejection,
approved Python failure recovery, archived script metadata, and post-run inspection.
The local test installer additionally validates the Blender extension archive with
Blender, installs/enables it for the current user, and proves the desktop shortcut starts
the packaged app and Blender with an authenticated loopback connection and no terminal.

Packaged security smoke proves renderer `require` and `process` are undefined, the
preload exposes only the typed SimForge API, remote windows and navigation are denied,
and CSP is restrictive. Direct fuse inspection proves Node-as-runtime, Node options,
CLI inspection, and legacy file privileges are disabled while ASAR integrity and cookie
encryption are enabled. Packaged credential smoke proves Windows-protected storage,
user-only ACL application, removal, and no plaintext credential bytes under app data.

The final packaged NVIDIA probe used the protected credential without exposing it.
Runtime discovery returned 119 models and included
`nvidia/nemotron-3-ultra-550b-a55b`. A streamed text response and valid call to the
offered `simforge_capability_probe` no-op were observed; the call was discarded and no
tool executed. The endpoint accepted a separate explicit `enable_thinking: false`
request. The sanitized record reports text, streaming, tools, and reasoning controls
true; vision false; structured output unknown; no attachments. Raw provider output and
the credential are not committed.

## Acceptance Mapping

- Passing: AT-003 through AT-006 and AT-008 through AT-015.
- Passing for the MS2 attack surface: AT-031; import/export and release-package cases
  remain in their planned milestones.
- Governance/evidence gate AT-039 passes for MS1/MS2.

## Honest Limitations

Structured-output support and numeric context/output limits remain `unknown` because the
probe does not manufacture capabilities it did not observe. The Python/OpenUSD runtime
is locally proven but not embedded. Validation, robot construction, and product USD
export are not claimed; they remain MS3-MS5.
