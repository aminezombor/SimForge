# Open Questions

## Policy

Only questions that can materially change product scope, architecture, security, licensing, cost, or delivery belong here. Discoverable facts are validation tasks, not owner questions. No item may silently change a confirmed requirement.

## Owner Decisions

The owner approved the architecture, roadmap, and split licensing model on
2026-07-18 and configured the NVIDIA credential through protected packaged-app
settings. The credential was never sent through chat or committed.

## Validation Questions for MS1

| ID | Question | Why it matters | Resolution method | Blocking point | Status |
| -- | -------- | -------------- | ----------------- | -------------- | ------ |
| OQ-003 | Does the user's NVIDIA endpoint expose the intended Nemotron identifier and required streaming/tool behavior? | Runtime availability cannot be inferred from documentation. | Authenticated model discovery and non-mutating capability probe with a user-supplied key. | Before live provider acceptance | Closed - 119 models returned; intended model, streamed text, and no-op tool call observed |
| OQ-004 | Can the proven Python 3.13 plus `usd-core` 26.5 environment be embedded and invoked on a clean account? | Determines the final OpenUSD distribution mechanism. | Package fixed sidecar/runtime and run author/reopen on a clean Windows account. | Before MS5 export acceptance | Local compatibility proven; packaging open |
| OQ-005 | Does Urchin handle the selected P1 URDF asset and Python 3.13 packaging robustly? | Selects the parser for the imported robot path. | Parse fixture into `RobotGraph`; if incompatible, evaluate `yourdfpy` under the same contract. | Before MS8 | Open |
| OQ-006 | Which external robot asset offers the best demo value with clear redistributable licensing and manageable geometry? | Affects P1 demo reliability and attribution. | Shortlist NVIDIA and open assets; evaluate license, complexity, materials, hierarchy, and import evidence. | Before MS8 selection | Open |
| OQ-007 | Is a Windows code-signing certificate available? | Changes SmartScreen friction but not functionality. | Owner confirms before MS9; always provide documented portable fallback. | Before release packaging | Open |

## Closed Questions

| ID | Decision | Resolution |
| -- | -------- | ---------- |
| CQ-001 | Desktop framework | Electron/TypeScript approved; DEC-004. |
| CQ-002 | Blender distribution | Separate Blender 4.5 LTS installation; DEC-006. |
| CQ-003 | Project licensing | Apache-2.0 desktop and GPL-3.0-or-later Blender extension; DEC-012. |
| CQ-004 | Primary provider strategy | Hosted NVIDIA NIM with runtime capability probing; DEC-007. |
| CQ-005 | Isaac Sim dependency | Not required for hackathon V1; retained as V2. |
| CQ-006 | SQLite driver | Electron 43 packaged `node:sqlite` passes migrations, WAL, move/reopen, backup, and recovery; fallback not invoked. |
| CQ-007 | Blender patch | Official Blender 4.5.11 LTS ZIP hash verified; live bridge/save-copy/mutation/crash-recovery tests pass. |
| CQ-008 | Hosted NVIDIA availability | Packaged live probe discovered intended Nemotron 3 Ultra and proved streamed text/tool-call behavior; AT-004. |
