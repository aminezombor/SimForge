# Progress

## Current State

- Phase: MS1 live-provider gate; MS2 implementation/evidence complete
- Overall status: Working packaged foundation with real Blender 4.5 LTS evidence
- Architecture: Approved; no architecture changes were required
- Current gate: owner configures an NVIDIA key, then Codex runs the sanitized live
  discovery/Nemotron capability acceptance probe
- Last updated: 2026-07-18

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

## Verification Summary

| Check | Result |
| ----- | ------ |
| TypeScript, ESLint, unit/contract/integration suite | 20 passing; live Blender test opt-in/skipped in default suite |
| Real Blender 4.5.11 acceptance | 1 passing; snapshot, AI tool, checkpoint, manual edit, stale denial, crash/reconnect, Python fallback |
| Packaged Windows app | `out/SimForge-win32-x64/SimForge.exe`, exit 0 smoke; nine fuses inspected |
| Renderer security smoke | `require`/`process` undefined; exact narrow API; remote window/navigation denied; restrictive CSP |
| Credential smoke | Protected store works; plaintext scan false before/after removal |
| Portable SQLite | Move/reopen plus backup/recovery passing |
| OpenUSD | Python 3.13.14, usd-core 26.5, author/reopen passing |
| Repository secret scan | Passing |
| Requirements audit | 123/123 mapped; 39/39 tests referenced; 8 future-tier rows retained; 0 invalid or unmapped |

See `docs/evidence/MS1_MS2_VERIFICATION.md` for commands and limitations.

## Remaining Gate and Risks

- **Owner input required:** configure an NVIDIA API key in the packaged app. The key
  must not be pasted into chat, terminal, or source. Runtime discovery must confirm
  whether `nvidia/nemotron-3-ultra-550b-a55b` is available and the text probe works.
- The Python/OpenUSD runtime is proven locally but is not embedded in the MS1 package;
  full fixed-runtime packaging remains part of the MS5/MS9 export/release work.
- The desktop package is unsigned; installer/signing and clean-account acceptance are MS9.
- Deterministic validators and USD product export are intentionally MS3-MS5, not hidden
  behind the current compatibility worker.

## Next Action

After the owner confirms the NVIDIA key is configured, run the packaged
`--provider-acceptance-test`, sanitize its capability record, update AT-004 and
traceability, commit the milestone evidence, and only then mark MS1/MS2 complete.
