# MS9 Release Audit

Date: 2026-07-19  
Candidate: SimForge 0.1.1  
Result: automated release gate passing; owner/provider/video/publication gates remain.

## Release Assets

| Asset | Size | SHA-256 |
| ----- | ---- | ------- |
| `SimForge-Setup.exe` | 170.14 MiB | `6480fc5911c383b40405cfd1dfc00cbaae83c55b5af547c39163925e21d13259` |
| `SimForge-win32-x64-0.1.1.zip` | 175.91 MiB | `4e88c1bb5367a5d52be7b02283ca13dd0f2a6b39fbfb38e0cc9765b57caec554` |
| `simforge_bridge-0.1.0.zip` | 18,970 bytes | `73628551cd941b27224818cfddfafb3d9cfee7624b819fc96b653400fb3f7eaa` |
| `SimForge-Warehouse-Sample-0.1.1.zip` | 1.87 MiB | `8c1cfcdd870b3628e5741de37f609991c175c12c5adb528949a213ce91d56ccd` |

`SHA256SUMS.txt` is generated with the release. The sample's Blender files are sanitized
to a neutral same-length path, its USD manifest hash is regenerated, and the complete
sample has no owner path, `.codex` path, secret, or private feedback identifier.

## Deterministic and Live Verification

- `pnpm verify`: 14 test files passed, two opt-in files skipped; 51 tests passed and six
  live/provider tests skipped; TypeScript, ESLint, and the 200-file secret scan passed.
- Real Blender 4.5.11: bridge/recovery, primitive robot, warehouse/Isaac workflow,
  licensed URDF, and six native formats passed. The warehouse rerun produced the release
  sample and proved Isaac failure -> denied unapproved change -> approved checkpointed
  correction -> passing parent-linked rerun.
- Packaged, freshly extracted portable, and installed Squirrel builds returned
  `ok: true`, `appVersion: 0.1.1`, and `packaged: true` in isolated security, credential,
  and privacy profiles. Generated Chromium profiles are ignored and not release evidence.
- Upgrade 0.1.0 -> 0.1.1 and final 0.1.1 uninstall passed. Uninstall removed binaries and
  shortcuts while preserving `%LOCALAPPDATA%\SimForge` data.
- Desktop `SimForge.lnk` opened SimForge and Blender with no terminal window. Visible
  Environment Doctor passed Blender, extension, authenticated bridge, storage, loopback,
  Python, OpenUSD, and NVIDIA driver checks. Isaac correctly warned that this machine is
  below NVIDIA's published RAM/VRAM minimum; unconfigured providers remained optional.

## Security, Runtime, and License Audit

- Electron fuses: RunAsNode, NODE_OPTIONS, CLI inspect, extra file privileges, and
  non-ASAR loading are disabled; cookie encryption, ASAR integrity, and ASAR-only loading
  are enabled.
- Renderer smoke: Node globals absent, remote window/navigation denied, restrictive CSP,
  protected credential plaintext absent, and diagnostics contain no private root.
- Packaged OpenUSD doctor: Python 3.13.14, `usd-core` 26.5, UsdPhysics available.
- `pnpm audit --prod`: zero known vulnerabilities. Full development audit: nine inherited
  Forge/node-gyp build-tool advisories (seven high, one moderate, one low); none is loaded
  by the installed application.
- Production license inventory: 118 package entries across MIT, Apache-2.0,
  BSD-3-Clause, and 0BSD. Root/source notices preserve the Apache desktop, GPL Blender
  extension, BSD robot fixture, MIT icon, and bundled-runtime notices.
- Authenticode: `NotSigned`. This is an accepted, disclosed limitation; the portable ZIP
  is the SmartScreen fallback.

## Remaining Human Gates

The owner must enter cloud credentials directly in protected Settings, complete
`docs/OWNER_JUDGE_TEST.md`, record/review the narrated video, provide private Devpost
identity fields and `/feedback` Session ID, approve public copy, and confirm final submit.

## Publication Verification

The public `aminezombor/SimForge` repository uses `main` as its default branch. Anonymous
repository and v0.1.1 release pages load without authentication. GitHub reports all five
assets as uploaded; their sizes and SHA-256 digests match the local release. Direct HEAD
requests for every asset return HTTP 200. Product description and Blender, robotics,
OpenUSD, Electron, Codex, Isaac Sim, and NVIDIA topics are set.
