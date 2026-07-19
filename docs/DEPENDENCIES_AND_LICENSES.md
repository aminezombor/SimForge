# Dependencies and Licenses

## Project Licensing

- Standalone desktop application: **Apache License 2.0**
- Blender extension loaded through `bpy`: **GNU GPL v3.0 or later**
- Documentation: project license unless a source attribution states otherwise
- Assets/sample data: retain their individual source licenses; no asset is implicitly relicensed

The desktop and Blender extension remain separate source/package boundaries. Root
`LICENSE`, extension `LICENSE`, `THIRD_PARTY_NOTICES.md`, the lockfile, and Electron's
packaged Chromium notices now exist. This inventory is engineering guidance, not legal advice.

## Adoption Rules

Before adding a dependency or asset:

1. Record purpose, exact version/commit, source URL, license, copyright/notice obligations, and modifications.
2. Review maintenance/activity, security advisories, Windows/Blender/Python/Node compatibility, dependency burden, lock-in, and judge reproducibility.
3. Use a bounded proof for native, large, privileged, network, import, or packaging dependencies.
4. Pin through lockfiles/hashes, retain notices, and run security/license checks.
5. Never install packages or execute downloaded code silently at runtime.

## Approved or Proposed Components

Versions below reflect the MS1 lock and verification on 2026-07-18.

| Component | Purpose | Version baseline | License/terms | Maintenance evidence | Status and risk |
| --------- | ------- | ---------------- | ------------- | -------------------- | --------------- |
| Electron | Desktop runtime | 43.1.1 | MIT | Active stable releases | Adopted; packaged/security smoke passing |
| React / React DOM | Renderer | 19.2.7 | MIT | Meta/upstream active | Adopted |
| TypeScript | Application language | 6.0.2 | Apache-2.0 | Microsoft/upstream active | Adopted |
| Vite | Development/build | 8.1.5 | MIT | Active upstream | Adopted; Forge plugin emits a deprecation warning to track |
| pnpm | Package manager/lockfile | 11.9.0 | MIT | Active upstream | Adopted; configuration lives in `pnpm-workspace.yaml` |
| `@assistant-ui/react` | Chat UI primitives | 0.14.27 | MIT | Active docs/repository | Adopted with custom local runtime; no Assistant Cloud/provider transport |
| Node `node:sqlite` | Global/project SQLite | Electron-bundled Node 24 API | Node.js license | Current Node documentation | Adopted; migrations/backup/recovery/package proof passing |
| `better-sqlite3` | Predetermined SQLite fallback | Pin only if invoked | MIT | Active releases | Not adopted; Electron native prebuild must be proven |
| Electron Forge | Windows package tooling | 7.11.2 | MIT | Active documentation/project | Adopted; portable package passing, unsigned risk remains |
| `@electron/fuses` | Package-time runtime hardening | 2.1.3 | MIT | Electron-maintained utility | Adopted directly because Electron 43 has nine fuses; strict complete policy and binary inspection pass |
| Blender | Authoritative editor/runtime | 4.5.11 LTS | GPL | Active LTS fixes | External prerequisite; official ZIP hash verified; never bundled |
| SimForge Blender extension | Bridge and structured operations | Project source | GPL-3.0-or-later | Maintained in this repository | Approved boundary; privileged code |
| CPython runtime | Fixed USD authoring environment | 3.13.14 | PSF License | Python upstream | Adopted as a relocatable packaged resource; embedded doctor passes |
| `usd-core` | OpenUSD composition/validation | 26.5 | LicenseRef-TOST-1.0 | Pixar release 2026-04-24 | Adopted; packaged author/deep reopen/portability passing |
| Three.js | Revision-stamped GLB inspection | 0.184.0 | MIT | Active releases | Adopted; direct renderer keeps Blender authoritative and avoids an extra runtime wrapper |
| `@phosphor-icons/react` | Workspace iconography | 2.1.10 | MIT | Active upstream | Adopted; no custom/fake icon assets |
| `@types/three` | TypeScript declarations | 0.183.1 | MIT | DefinitelyTyped/upstream maintained | Adopted as development-only dependency |
| Urchin | URDF parser candidate | 0.0.30 baseline | MIT | Release 2025-10-21 | P1 candidate; Python 3.13/asset proof required |
| `yourdfpy` | URDF fallback candidate | 0.0.57 baseline | MIT | 2025 release | Not adopted; evaluate only if Urchin fails contract |
| MuJoCo Python | MJCF parser/compiler candidate | Pin in MS10 | Apache-2.0 | Google DeepMind active monthly releases | Post-V1 candidate; native size/plugins/includes risks |
| Direct OpenAI Responses HTTP adapter | Optional provider | Versioned app contract | OpenAI API terms | Official endpoint/docs | Adopted; avoids provider SDK coupling |
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

## MS1 Audit Result

`pnpm licenses list --prod --json` reports permissive MIT/BSD-3-Clause production
JavaScript dependencies, including 0BSD `tslib`; `pnpm audit --prod` reports no known
vulnerabilities at the recorded lockfile revision. Electron's runtime license files
remain in the packaged output.
`@electron/node-gyp` is the only exotic-source dependency: Forge 7.11.2 pins Electron's
maintained fork to commit `06b29aafb7708acef8b3669835c8a7857ebc92d2`; the exact
direct declaration and lock entry document the reviewed exception. No third-party asset
is present. Full release notice generation and clean-package audit remain AT-036/MS9.

## MS4 Audit Result

MS4 adds no external runtime dependency or third-party asset. Robot construction,
rendering, and inspection use Blender 4.5.11's bundled `bpy`, `bmesh`, and math utilities;
desktop contracts/validation remain TypeScript. The package, extension ZIP, fuse policy,
isolated credential/security smoke, and current-user installation pass at the existing
pinned versions. OpenUSD is adopted in MS5; Three.js is adopted and audited in MS6.

## MS5 Audit Result

MS5 adds no JavaScript package or external asset. `scripts/prepare-usd-runtime.ps1`
constructs a fixed resource from pinned CPython 3.13.14 and the reviewed `usd-core` 26.5
wheel, copying only the Python runtime and required `pxr` distribution. The packaged
doctor reports the exact versions and UsdPhysics availability; no runtime download,
shell invocation, or user-site import is used. The app package retains root license and
third-party notices, while canonical exports carry their own notice. MS9 must still run
the release-wide binary/notice/redistribution and clean-account audit required by AT-036.

## MS6 Audit Result

MS6 adopts Three.js 0.184.0, `@phosphor-icons/react` 2.1.10, and development-only
`@types/three` 0.183.1. Their installed package metadata declares MIT licenses. Direct
Three.js GLB rendering avoided the previously considered React Three Fiber dependency.
No cloud UI transport, telemetry SDK, external asset, or runtime download was added.
The package and lockfile remain the version authority; MS9 still owns release-wide notice
generation and the production dependency/security audit.

## MS7 Audit Result

MS7 adds no external dependency, downloaded asset, or runtime network surface. The
warehouse workcell and mobile manipulator are original source-tagged primitive sample
data authored with the existing TypeScript contracts and Blender GPL extension. The
existing CPython/OpenUSD runtime writes the environment layer. Package, extension ZIP,
secret scan, isolated renderer/credential/privacy smoke, and nine-fuse audit pass at the
pinned versions. The first external asset enters only through the MS8 license/provenance
gate.
