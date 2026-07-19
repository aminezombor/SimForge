# Progress

## Current State

- Phase: MS0-MS7 complete; MS8 imported robot path is active
- Overall status: The first-cycle path, owner-approved embedded workspace, and generated
  warehouse mobile-manipulator demonstration now pass with
  persistent conversations/memory, capability routing, exact-revision Blender previews,
  responsive context docking, named history, and packaged privacy/security controls
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
| 2026-07-19 | MS5 verified USD export | Added exact destination/overwrite proposals, project-contained Blender export staging, neutral modular USD composition, quick flattening, SHA-256 manifest, atomic promotion, deep relocated reopen, project report persistence, and a packaged Python/OpenUSD runtime. Fixed graceful bridge token revocation and stale-descriptor cleanup discovered during installed launch validation. | `docs/evidence/MS5_VERIFICATION.md`; AT-028/029/030; real Blender/OpenUSD acceptance; packaged embedded-runtime/security smoke |
| 2026-07-19 | MS6 embedded workspace and UX | Delivered the owner-approved three-column workspace, persistent conversation/memory lifecycle, capability-aware routing/budgets, exact-revision Three.js inspector with Blender selection/staleness, stored comparisons, named versions/timeline, responsive drawers, and packaged export/diagnostics/Recycle Bin privacy controls. | `docs/evidence/MS6_VERIFICATION.md`; `design-qa.md`; 37 default tests; real Blender preview acceptance; packaged security/credential/privacy smoke |
| 2026-07-19 | MS7 warehouse mobile manipulator | Added reusable `EnvironmentGraph`, atomic exact-approved robot/environment materialization, 15-object warehouse workcell, full 12-link manipulator, deterministic environment rules, visible gripper defect/correction, six-view review, and real environment USD composition/reopen. | `docs/evidence/MS7_VERIFICATION.md`; 40 default tests; third real Blender acceptance; 12 passing USD checks; packaged/fuse/security/privacy smoke |

## Verification Summary

| Check | Result |
| ----- | ------ |
| TypeScript, ESLint, unit/contract/integration suite | 40 passing; 3 live Blender tests opt-in/skipped in default suite |
| Real Blender 4.5.11 acceptance | MS7 targeted path passes atomic assembly, deterministic robot/environment validation, visible defect/correction, review, preview, and moved canonical export; full earlier suite retained |
| Packaged Windows app | `out/SimForge-win32-x64/SimForge.exe`, exit 0 smoke; nine fuses inspected |
| Renderer security smoke | `require`/`process` undefined; exact narrow API; remote window/navigation denied; restrictive CSP |
| Credential smoke | Protected store works in isolated profile; plaintext scan false before/after removal; primary database SHA-256 unchanged |
| Portable SQLite | Move/reopen plus backup/recovery passing |
| OpenUSD | Packaged Python 3.13.14/usd-core 26.5 runtime; quick and seven-layer canonical author/reopen, hashes, references, schemas, reports, and relocated reopen pass |
| Live NVIDIA | 119 models discovered; intended Nemotron found; text/stream/tools/reasoning controls true; vision false; no-op tool not executed |
| Repository secret scan | Passing |
| Requirements audit | 123/123 mapped; 39/39 tests referenced; 8 future-tier rows retained; 0 invalid or unmapped |
| User-local launch | Current desktop shortcut opens app plus Blender 4.5.11 with zero visible terminals; bridge establishes; graceful exit removes its descriptor and processes |
| MS3 deterministic validation | 18 stable rules; defective/repaired determinism; safe/structural policy; persistence; full checkpoint capture/restore passing |
| MS4 robotics and visual review | Four links, three joints, four collisions, two sensor frames plus renderable bodies; deterministic `ROB-*` rules; five lit/hash-stamped views; visible before/after correction and useful sensor angle |
| MS5 verified export | Exact plan/revision/destination/overwrite binding; quick `.usdc`; modular relative-reference package; source/previews/notices/reports; deep moved-package reopen |
| MS6 workspace | Owner-directed three-column layout; conversations, scoped memory, model routing, exact-revision GLB inspector, timeline, responsive drawers, project/diagnostic export, and recoverable deletion pass |
| MS7 generated demonstration | 12 links, 11 joints, 12 robot collisions, 3 sensors, 15 warehouse objects/collisions, `ENV-*` evidence, six review views, and real robot/environment USD pass |

See `docs/evidence/MS1_MS2_VERIFICATION.md` for commands and limitations.

## Remaining Risks

- Live structured-output support and numeric context/output limits remain honestly
  `unknown`; later routing must require an observed capability rather than assume one.
- The desktop package is unsigned; installer/signing and clean-account acceptance are MS9.
- The user-local installer is an owner testing convenience, not an MS9 release artifact;
  clean-account, uninstall, upgrade, signing, and redistributable packaging remain open.
- The approved workspace is implemented and visually verified. MS7-MS8 will add richer
  manipulator/import content inside the existing information architecture; MS9 still owns
  final accessibility, copy, release, and clean-account judge validation.
- The packaged OpenUSD runtime passes its embedded doctor and export acceptance, but MS9
  must still audit release size, redistribution notices, clean-account behavior, upgrade,
  uninstall, and signing.
- AABB overlap is intentionally conservative and Z=0 support contact is an explicit
  assumption; robot-aware primitive contact rules now supplement it but do not claim
  simulator proof.
- The pre-isolation credential smoke may have removed the current NVIDIA profile key.
  No secret was exposed or retained; the owner must enter the key again through Settings
  before the next live provider demonstration.
- During MS5 installed-launch verification, a diagnostic command displayed one ephemeral
  loopback descriptor. The app/Blender processes were stopped immediately, making that
  token unusable; no provider credential was involved or committed. Graceful revocation,
  stale cleanup, and a regression test now pass.

## Next Action

Begin MS8 without pausing. Select a redistributable robot fixture, implement safe staged
native/robot-description import into the general contracts, retain provenance and
conversion losses, make a meaningful approved modification, then validate and export
without regressing the generated P0 path.
