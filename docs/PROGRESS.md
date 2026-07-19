# Progress

## Current State

- Phase: MS0-MS4 complete; MS5 verified USD export is next
- Overall status: Generated primitive robot authoring, real Blender materialization,
  deterministic robotics validation, approved defect/correction, materialized human-reviewed
  evidence, packaging, and the installed no-terminal path pass
- Architecture: Approved; no architecture changes were required
- Current gate: owner authorized continuation through MS9; proceed milestone-by-milestone
- Last updated: 2026-07-19

## Completed Work

| Date | Task | Outcome | Evidence |
| ---- | ---- | ------- | -------- |
| 2026-07-18 | MS0 documentation baseline | Captured 123 requirements, 39 tests, architecture, scope, and decisions. | Commits `7e1d35e`, `b0862cf` |
| 2026-07-18 | Electron/storage/package spike | Built sandboxed Electron 43/React/TypeScript app; proved `node:sqlite` migrations, WAL, backup/recovery, portable moves, and packaged launch. | `pnpm verify`; packaged smoke; persistence tests |
| 2026-07-18 | Provider-neutral AI seam | Added NVIDIA NIM, OpenAI Responses, and mock adapters; runtime discovery/probing; normalized streamed text/tools/usage; protected credentials; disclosure UI. | Provider tests; credential smoke; AT-003/AT-005 |
| 2026-07-18 | Real AI-to-Blender slice | Added authenticated loopback RPC, Blender extension, fresh snapshots, checkpointed provider tool call, stable IDs, revisions, and activity. | Real Blender 4.5.11 live test; AT-012 |
| 2026-07-18 | MS2 mode and scene-truth enforcement | Added Chat/Plan/Build/Goal policy, exact approvals, persistent jobs, manual-edit diffs, stale rejection, crash/reconnect recovery, and approved Python archive/fallback. | Policy/job/live Blender tests; AT-008 through AT-015 |
| 2026-07-18 | OpenUSD compatibility spike | Pinned `usd-core` 26.5 in Python 3.13; authored/reopened Z-up, meter-scale USDA. | `sidecars/usd_worker.py`; SHA-256 evidence |
| 2026-07-18 | Security/package hardening | Proved no renderer Node globals, narrow preload API, explicit Electron 43 fuse policy, CSP/navigation denial, forged/oversized bridge rejection, path containment, user-only ACLs, secret scanning, and DPAPI lifecycle. | Fuse inspection; security/credential smoke; AT-003/AT-031 |
| 2026-07-18 | Live NVIDIA acceptance | Protected owner key drove packaged runtime discovery and non-mutating capability probes; 119 models returned, intended Nemotron found, streamed text and no-op tool call observed, explicit reasoning control accepted, vision false. | `docs/evidence/NVIDIA_PROVIDER_ACCEPTANCE.json`; AT-004 |
| 2026-07-18 | User-local MS1/MS2 test installation | Installed hash-verified Blender 4.5.11 LTS and the validated bridge extension beside the packaged app; added a no-terminal desktop shortcut, automatic authenticated connection, disconnected descriptor renewal, and an exact manual walkthrough. Existing unrelated desktop shortcut was preserved. | `scripts/install-local-test.ps1`; `docs/MS1_MS2_MANUAL_TEST.md`; live installed-process/loopback smoke |
| 2026-07-19 | Owner workspace review and launch correction | Confirmed the tested screen is an engineering harness, adopted the owner-directed three-column final workspace contract, moved sample goal text to a placeholder, and added a visible preview label. Replaced console-producing launch paths, fixed the authenticated bridge's 30-second idle disconnect, added extension auto-reconnect and live header polling, then reverified the installed shortcut. | `docs/UX_WORKSPACE.md`; `docs/UX_AUDIT_2026-07-19.md`; installed 35-second idle smoke; bridge regression test |
| 2026-07-19 | MS3 deterministic validation and recovery | Added evidence-rich Blender snapshots, 18 stable geometry/scene/topology/material/reference rules, persisted runs/findings/fixes, safe preconditioned ground correction, structural approval, inverse undo, hashed complete checkpoints, approved restore, and a validation/recovery dock. | `docs/evidence/MS3_VERIFICATION.md`; 26 default tests; real Blender safe-fix/undo/restore acceptance; packaged renderer smoke |
| 2026-07-19 | MS4 primitive wheeled robot and review | Added a versioned provider-neutral `RobotGraph`, structured Blender materialization/link-pose tools, stable renderable sensor representation, robotics/physics/sensor rules, exact approval, hashed materialized review, and built-state UX. Real Blender caught and corrected a raised wheel; humans rejected poor sensor views until useful. | `docs/evidence/MS4_VERIFICATION.md`; 28 default tests; 2 real Blender tests; packaged/installed smoke; reviewed PNGs |

## Verification Summary

| Check | Result |
| ----- | ------ |
| TypeScript, ESLint, unit/contract/integration suite | 28 passing; 2 live Blender tests opt-in/skipped in default suite |
| Real Blender 4.5.11 acceptance | 2 passing in 8.92 seconds; full prior path plus robot materialization, robotics evidence, raised-wheel detection/correction, and review integrity |
| Packaged Windows app | `out/SimForge-win32-x64/SimForge.exe`, exit 0 smoke; nine fuses inspected |
| Renderer security smoke | `require`/`process` undefined; exact narrow API; remote window/navigation denied; restrictive CSP |
| Credential smoke | Protected store works in isolated profile; plaintext scan false before/after removal; primary database SHA-256 unchanged |
| Portable SQLite | Move/reopen plus backup/recovery passing |
| OpenUSD | Python 3.13.14, usd-core 26.5, author/reopen passing |
| Live NVIDIA | 119 models discovered; intended Nemotron found; text/stream/tools/reasoning controls true; vision false; no-op tool not executed |
| Repository secret scan | Passing |
| Requirements audit | 123/123 mapped; 39/39 tests referenced; 8 future-tier rows retained; 0 invalid or unmapped |
| User-local launch | Desktop shortcut opens current app plus Blender 4.5.11 with zero visible terminal windows; authenticated loopback connection remains established after 37 seconds idle |
| MS3 deterministic validation | 18 stable rules; defective/repaired determinism; safe/structural policy; persistence; full checkpoint capture/restore passing |
| MS4 robotics and visual review | Four links, three joints, four collisions, two sensor frames plus renderable bodies; deterministic `ROB-*` rules; five lit/hash-stamped views; visible before/after correction and useful sensor angle |

See `docs/evidence/MS1_MS2_VERIFICATION.md` for commands and limitations.

## Remaining Risks

- Live structured-output support and numeric context/output limits remain honestly
  `unknown`; later routing must require an observed capability rather than assume one.
- The Python/OpenUSD runtime is proven locally but is not embedded in the MS1 package;
  full fixed-runtime packaging remains part of the MS5/MS9 export/release work.
- The desktop package is unsigned; installer/signing and clean-account acceptance are MS9.
- The user-local installer is an owner testing convenience, not an MS9 release artifact;
  clean-account, uninstall, upgrade, signing, and redistributable packaging remain open.
- The present renderer is explicitly an engineering preview. The owner-approved final
  information architecture is fixed in `docs/UX_WORKSPACE.md`; full viewport/history/
  docking integration remains MS6, with MS3/MS5 panels designed to fit it.
- Deterministic validators and USD product export are intentionally MS3-MS5, not hidden
  behind the compatibility worker. Geometry/robotics/materialized-review channels pass;
  USD composition, portability, and readiness reporting remain MS5.
- AABB overlap is intentionally conservative and Z=0 support contact is an explicit
  assumption; robot-aware primitive contact rules now supplement it but do not claim
  simulator proof.
- The pre-isolation credential smoke may have removed the current NVIDIA profile key.
  No secret was exposed or retained; the owner must enter the key again through Settings
  before the next live provider demonstration.

## Next Action

Begin MS5 after rereading persistent memory. Name `REQ-VALIDATION-011/012`,
`REQ-USD-001` through `REQ-USD-006`, `REQ-EXPORT-001` through `REQ-EXPORT-006`, and
`AT-028` through `AT-030`. Implement explicit quick/canonical destination approval,
Blender geometry/material export, neutral physics/sensor composition, OpenUSD reopen and
portable-reference/hash verification, machine JSON findings, and human readiness report.
Do not begin MS6 until the complete first-cycle loop passes.
