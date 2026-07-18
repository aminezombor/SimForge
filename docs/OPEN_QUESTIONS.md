# Open Questions

## Policy

Only questions that can materially change product scope, architecture, security, licensing, cost, or delivery belong here. Discoverable facts are validation tasks, not owner questions. No item may silently change a confirmed requirement.

## Owner Decisions

There are no blocking owner questions for MS0. The owner approved the architecture, roadmap, and split licensing model on 2026-07-18.

## Validation Questions for MS1

| ID | Question | Why it matters | Resolution method | Blocking point | Status |
| -- | -------- | -------------- | ----------------- | -------------- | ------ |
| OQ-001 | Does Electron 43.x package `node:sqlite` reliably with migrations, backup, and recovery on the judge baseline? | Selects the database driver without changing the repository interface. | Bounded packaged-app spike; use pinned `better-sqlite3` fallback only on objective failure. | Before persistent feature work | Open |
| OQ-002 | Which exact Blender 4.5 LTS patch is installed and passes bridge, timer, save-copy, import, and USD tests? | Pins supported setup and extension compatibility. | Install latest 4.5 LTS patch, run Environment Doctor and integration fixture. | Before MS1 acceptance | Open |
| OQ-003 | Does the user's NVIDIA endpoint expose the intended Nemotron identifier and required streaming/tool behavior? | Runtime availability cannot be inferred from documentation. | Authenticated model discovery and non-mutating capability probe with a user-supplied key. | Before live provider acceptance | Open |
| OQ-004 | Can Python 3.13 plus `usd-core` 26.5 be bundled and invoked from the packaged Electron build without missing DLLs? | Determines the OpenUSD distribution mechanism. | Package fixed sidecar, author/reopen a fixture, and run on a clean Windows account. | Before USD implementation | Open |
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
