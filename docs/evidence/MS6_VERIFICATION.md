# MS6 Embedded Workspace Verification

## Scope

MS6 delivers the owner-approved three-column product workspace without weakening the
MS1-MS5 safety path. It covers `REQ-AI-007/008/010`, `REQ-UX-003` through
`REQ-UX-009`, `REQ-DATA-005`, `REQ-VIEW-001` through `REQ-VIEW-004`,
`REQ-HISTORY-003/004`, and `REQ-SECURITY-003`. Acceptance evidence applies to
`AT-005`, `AT-007`, `AT-008`, `AT-018`, `AT-026`, `AT-027`, and `AT-032`.

## Implemented Evidence

- Persistent, searchable project conversations support create, rename, branch, delete,
  attachments with provenance, stop, retry/resend, context metering, and source-retaining
  compaction. Project and global memories are separately enabled, inspected, edited,
  exported, and deleted.
- Capability routing uses only configured, enabled, runtime-probed models. Automatic
  fallback explains its reason; manual routes reject unavailable or incompatible models.
  Settings own keys, provider enablement, fallback order, budgets, memory, privacy,
  usage, Environment Doctor, project export, diagnostics export, and deletion.
- Blender generates the GLB inspector from a named scene revision. Three.js provides
  orbit, pan, zoom, hierarchy, dimensions/material inspection, Blender selection linkage,
  stale-state rejection, stored before/after review, and **Open in Blender**.
- Named versions and branches retain checkpoint ancestry. The unified timeline links
  conversations, providers/models, tools, revisions, validation, checkpoints, and exports.
- Portable project export preserves project memory while excluding global memory and
  credentials. Diagnostics structurally redact private roots and content. Exact-name
  project deletion closes live resources and moves the project to the Recycle Bin.

## Deterministic Verification

| Check | Result |
| ----- | ------ |
| `pnpm verify` | Passed: TypeScript, ESLint, 37 tests, 2 opt-in live tests skipped, 132-file secret scan |
| Real Blender targeted acceptance | Passed: exact-revision GLB, selection linkage, stale rejection, stored review ordering, validation/fix, and USD export |
| `pnpm package` | Passed for `out/SimForge-win32-x64/SimForge.exe` |
| Packaged security/credential/privacy smoke | Exit 0; packaged true; renderer Node globals absent; navigation/window denied; credential plaintext absent before/after removal; project/diagnostics scopes correct; exact confirmation enforced; project moved to Recycle Bin |
| Electron fuse inspection | All nine Electron 43 fuse values match the explicit policy |
| Browser interaction QA | Chat/Plan/Build/Goal, Settings, export, drawers, viewport widths 1280/980/760, and empty console warning/error lists passed |

## Visual QA

The exact source is the owner-provided `Slide3.PNG` reference.
The final same-viewport comparison is
`artifacts/ms6/comparison-final.png`; responsive evidence is retained beside it.
`design-qa.md` records two repair passes and ends with `final result: passed`.

## Honest Boundary

The embedded inspector is a revision-stamped derivative, never an independent editor or
scene authority. Cloud file/image dispatch remains disabled unless explicitly allowed;
automatic routing keeps attachments local when no compatible approved visual route exists.
Release signing, clean-account setup, installer/uninstaller behavior, and final judge
rehearsal remain MS9.
