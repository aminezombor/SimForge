# Dependencies and Licenses

## Project Licensing

- Standalone desktop application: **Apache License 2.0**
- Blender extension loaded through `bpy`: **GNU GPL v3.0 or later**
- Documentation: project license unless a source attribution states otherwise
- Assets/sample data: retain their individual source licenses; no asset is implicitly relicensed

The desktop and Blender extension must remain separate source/package boundaries. Root and package license files plus `THIRD_PARTY_NOTICES.md` will be created with the first source/distribution packages. This inventory is engineering guidance, not legal advice.

## Adoption Rules

Before adding a dependency or asset:

1. Record purpose, exact version/commit, source URL, license, copyright/notice obligations, and modifications.
2. Review maintenance/activity, security advisories, Windows/Blender/Python/Node compatibility, dependency burden, lock-in, and judge reproducibility.
3. Use a bounded proof for native, large, privileged, network, import, or packaging dependencies.
4. Pin through lockfiles/hashes, retain notices, and run security/license checks.
5. Never install packages or execute downloaded code silently at runtime.

## Approved or Proposed Components

No application dependency has been installed in MS0. Versions are baselines to prove and pin in MS1.

| Component | Purpose | Version baseline | License/terms | Maintenance evidence | Status and risk |
| --------- | ------- | ---------------- | ------------- | -------------------- | --------------- |
| Electron | Desktop runtime | 43.x | MIT | Active stable releases | Approved; hardening and package spike required |
| React | Renderer | Current stable at MS1 lock | MIT | Meta/upstream active | Approved |
| TypeScript | Application language | Current stable at MS1 lock | Apache-2.0 | Microsoft/upstream active | Approved |
| Vite | Development/build | Current stable at MS1 lock | MIT | Active upstream | Approved |
| pnpm | Package manager/lockfile | Current stable at MS1 lock | MIT | Active upstream | Approved |
| `@assistant-ui/react` | Chat UI primitives | Pin after custom-runtime spike | MIT | Active 2026 changelog/repository | Proposed; no Assistant Cloud or provider adapter |
| Node `node:sqlite` | Global/project SQLite | Electron bundled Node 24 API | Node.js license | Current Node documentation | Approved conditionally; release-candidate API, packaged proof required |
| `better-sqlite3` | Predetermined SQLite fallback | Pin only if invoked | MIT | Active releases | Not adopted; Electron native prebuild must be proven |
| Electron Forge | Windows installer/ZIP | Pin with Electron | MIT | Active documentation/project | Approved; unsigned-build risk remains |
| Blender | Authoritative editor/runtime | 4.5 LTS exact patch TBD | GPL | Active LTS fixes | External prerequisite; never bundled in P0 |
| SimForge Blender extension | Bridge and structured operations | Project source | GPL-3.0-or-later | Maintained in this repository | Approved boundary; privileged code |
| CPython embeddable runtime | Fixed USD/import sidecar runtime | 3.13.x | PSF License | Python upstream | Proposed; packaging/notice proof required |
| `usd-core` | OpenUSD composition/validation | 26.5 | TOST-1.0 | Pixar release 2026-04-24 | Approved conditionally; native DLL/package proof required |
| Three.js | Embedded preview | Pin in MS6 | MIT | Active releases | P1 approved concept |
| React Three Fiber | React/Three integration | Pin in MS6 | MIT | Active releases | P1 approved concept |
| Urchin | URDF parser candidate | 0.0.30 baseline | MIT | Release 2025-10-21 | P1 candidate; Python 3.13/asset proof required |
| `yourdfpy` | URDF fallback candidate | 0.0.57 baseline | MIT | 2025 release | Not adopted; evaluate only if Urchin fails contract |
| MuJoCo Python | MJCF parser/compiler candidate | Pin in MS10 | Apache-2.0 | Google DeepMind active monthly releases | Post-V1 candidate; native size/plugins/includes risks |
| OpenAI official JS SDK | Optional provider adapter | Pin in MS1 if used | Apache-2.0 | OpenAI upstream active | Proposed optional dependency |
| NVIDIA hosted NIM API | Primary model service | Runtime-discovered | NVIDIA service/API terms | Official active catalog/docs | Approved service; user key and access required |

## Prior Art Not Adopted

| Project | Lesson | Why not adopted |
| ------- | ------ | --------------- |
| `ahujasid/blender-mcp` | Confirms demand for socket-controlled Blender and structured AI tools | General server and arbitrary Python surface exceed the approved local threat model; no source will be copied |
| Tauri | Demonstrates smaller desktop/runtime capability design | Rust and third-language/toolchain cost increase hackathon risk; reconsider only after measured Electron limitations |
| Blender-native chat add-ons | Demonstrate direct scene access | Conflict with standalone multi-project/provider/security/product requirements |

## Asset Inventory Template

| Asset ID | Name | Source URL | Version/hash | License | Redistribution | Modifications/conversion | Project use |
| -------- | ---- | ---------- | ------------ | ------- | -------------- | ------------------------ | ----------- |
| _Pending MS8_ | External robot | - | - | - | Must be confirmed | - | Imported robot demo |
| _Pending MS9_ | Sample textures/environment | - | - | Prefer CC0 or compatible | Must be confirmed | - | Sample project/demo |

## Release Compliance Gate

AT-036 must confirm package boundaries, source/license files, third-party notices, dependency lock/audit output, asset provenance, redistribution rights, modifications, and absence of unreviewed runtime downloads before release.
