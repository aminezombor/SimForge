# Technical Research

## Status and Method

- Research date: 2026-07-18
- Status: Architecture baseline complete; implementation candidates still require bounded proofs
- Method: Prefer current official documentation and upstream source repositories. Popularity alone is not adoption evidence.

Every adopted dependency must be pinned, inventoried, security-reviewed, and verified in a packaged Windows path. No large dependency was installed during MS0.

## Architecture Comparison

| Approach | Benefits | Risks | Result |
| -------- | -------- | ----- | ------ |
| Electron + TypeScript main process + thin Blender extension + OpenUSD Python sidecar | One primary app language, mature Windows packaging, direct streaming/network/storage support, fastest thin slice | Larger bundle; Chromium/Node privileges demand strict isolation | Selected |
| Tauri + Rust core + same extension/sidecar | Smaller package, explicit native capabilities, strong isolation model | Adds Rust and a third language; no current Rust toolchain; sidecar/installer complexity | Reconsider post-hackathon |
| Blender-native add-on application | Immediate scene access | Fails standalone product, chat/project UX, provider isolation, and no-terminal judge experience | Rejected |

Sources: [Electron releases](https://releases.electronjs.org/), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Tauri permissions](https://v2.tauri.app/security/permissions/), [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/).

## Major Reuse Candidates

| Component | Purpose | License / maintenance | Compatibility and advantages | Risks | Recommendation / proof |
| --------- | ------- | --------------------- | ---------------------------- | ----- | ---------------------- |
| Electron 43.x | Windows desktop shell | MIT; current stable releases | Bundles a compatible Node runtime and established packaging/security guidance | Large bundle and renderer attack surface | Adopt; prove hardened packaged shell and fuses in MS1 |
| React + Vite + TypeScript | Renderer and shared domain types | Permissive, actively maintained | Fast component development and typed interfaces | Dependency churn | Adopt pinned stable versions |
| `@assistant-ui/react` | Modern chat primitives | MIT; active project | Reduces message/thread/accessibility work; supports custom runtimes | Provider/cloud adapters could create lock-in | Use primitives plus local custom runtime only; no Assistant Cloud; prove Electron/Vite fit |
| `node:sqlite` | Local project/global persistence | Node license; delivered with Node 24 | No native add-on rebuild and defensive SQLite API | API is release-candidate stability | Adopt behind interface if packaged spike passes; fixed fallback to `better-sqlite3` |
| Blender 4.5 LTS Python API | Authoritative scene integration | Blender GPL; maintained LTS | Official scene/import/export APIs and headless testing | `bpy` is main-thread sensitive; USD importer/exporter has composition limits | Require separate install; build thin GPL extension and direct background tests |
| `usd-core` 26.5 | OpenUSD authoring and verification | TOST-1.0; Pixar-maintained | Official Windows CPython 3.13 wheel; includes core schemas without imaging burden | Native DLL packaging and license notices | Adopt in fixed Python sidecar after package/reopen proof |
| UsdPhysics | Neutral robotics physics schemas | Part of OpenUSD | Standard articulation, collision, joint, and mass representation | Does not guarantee Isaac-specific readiness | Adopt neutral P0 layer; add rule parity with Isaac guidance |
| NVIDIA hosted NIM | Primary inference | Commercial service terms; official NVIDIA API | Hosted Nemotron avoids impractical local hardware; OpenAI-compatible streaming/tool surfaces | Access/model/capabilities vary by endpoint | Discover and probe at runtime; never hard-code success |
| OpenAI Responses API | Optional secondary provider | Commercial service terms; official SDK/API | Proves provider abstraction; current models can support text/image/tool workflows | Cost, access, and model changes | Optional P0 proof, capability-driven selection |
| Three.js / React Three Fiber | Embedded inspection | MIT; active | GLB preview, selection, camera controls, wide ecosystem | A separate renderer can become stale | P1 only; display revision-stamped Blender-generated preview, never independent truth |
| Urchin | URDF parsing | MIT; release 0.0.30 in 2025 | Maintained fork of urdfpy; neutral Python importer path | Python 3.13/package and asset edge cases unproved | Candidate; map into `RobotGraph`; fallback evaluation is `yourdfpy` |
| MuJoCo Python | MJCF parsing/compilation | Apache-2.0; Google DeepMind active releases | Official parser and Windows wheels | Native package size; plugins/includes are security-sensitive | Candidate for post-hackathon guaranteed MJCF; reject plugins/external paths |
| Electron Forge | Installer/portable packaging | MIT; active | Standard Electron makers and security fuse plugin | Unsigned installer may trigger SmartScreen | Adopt; ship installer plus portable ZIP fallback |

Sources: [assistant-ui](https://github.com/assistant-ui/assistant-ui), [Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Blender LTS deployment](https://docs.blender.org/manual/es/4.5/advanced/deploying_blender.html), [Blender USD](https://docs.blender.org/manual/en/dev/files/import_export/usd.html), [usd-core 26.5](https://pypi.org/project/usd-core/26.5/), [UsdPhysics](https://openusd.org/release/api/usd_physics_page_front.html), [Electron Forge](https://www.electronforge.io/), [Three.js](https://github.com/mrdoob/three.js), [Urchin](https://pypi.org/project/urchin/), [MuJoCo](https://github.com/google-deepmind/mujoco).

## NVIDIA and Model Findings

- Nemotron 3 Ultra is a 550B-total/55B-active text reasoning model with a 1M-token context claim. Self-hosted requirements are inappropriate for a judge-friendly desktop; use hosted NVIDIA inference with a user key.
- The official hosted catalog currently lists `nvidia/nemotron-3-ultra-550b-a55b` at the NVIDIA API endpoint. Runtime discovery remains mandatory because access and identifiers may change.
- NIM exposes OpenAI-compatible chat APIs, streaming, tool definitions, model listing, health/metadata, and reasoning controls depending on model/deployment. The client, not NIM, owns the deterministic tool loop and permissions.
- Nemotron 3 Ultra is treated as text-only. Render review uses a separately probed NVIDIA visual model or an optional OpenAI vision-capable model.

Sources: [Nemotron 3 Ultra research](https://research.nvidia.com/labs/nemotron/Nemotron-3-Ultra/), [NIM Nemotron setup](https://docs.nvidia.com/nim/large-language-models/latest/day-0/get-started-nemotron-3-ultra.html), [NVIDIA LLM catalog](https://docs.api.nvidia.com/nim/reference/llm-apis), [NIM API reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html), [NIM tool calling](https://docs.nvidia.com/nim/large-language-models/latest/advanced-use-cases/tool-calling-and-mcp.html), [NVIDIA visual APIs](https://docs.api.nvidia.com/nim/reference/visual-models-apis).

## OpenAI Findings

Use the Responses API adapter with provider-neutral request/events. Discover available models and prefer a current cost-balanced GPT-5.6 model only when access and capabilities are confirmed. Tool calling, streaming, and image input are capability flags, not assumptions.

Sources: [OpenAI models](https://developers.openai.com/api/docs/models), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [vision](https://developers.openai.com/api/docs/guides/images-vision), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses).

## Blender Integration Findings

- Use a purpose-built, versioned loopback protocol. A background socket thread queues validated commands; `bpy.app.timers` dispatches them on Blender's main thread.
- Use Blender dependency-graph events and stable `simforge.*` custom identifiers for manual-edit detection and revision changes.
- Launch/open files with automatic Python execution disabled. Import into a staging collection and validate before merging.
- Generic Blender MCP projects demonstrate demand and socket feasibility but expose unnecessarily broad arbitrary Python surfaces for this threat model. Do not copy or embed them.
- Blender USD supports a useful subset but not all USD composition behaviors. Use it for visual layers and neutral OpenUSD for package composition.

Sources: [Blender scripting](https://docs.blender.org/manual/nb/4.5/advanced/scripting/introduction.html), [command-line arguments](https://docs.blender.org/manual/es/4.5/advanced/command_line/arguments.html), [Blender USD](https://docs.blender.org/manual/en/dev/files/import_export/usd.html), [Blender license](https://developer.blender.org/docs/license), [Blender extension licenses](https://docs.blender.org/manual/ru/dev/advanced/extensions/licenses.html), [Blender MCP prior art](https://github.com/ahujasid/blender-mcp).

## USD and Robotics Findings

- OpenUSD 26.05 supports Windows and provides official Python wheels. Use Z-up and SI units, relative asset paths, a root entry stage, separable geometry/material/physics/sensor layers, and manifest hashes.
- UsdPhysics provides articulation root, rigid body, collision, joint, drive, mass, and related schemas. P0 remains renderer/simulator-neutral.
- Isaac Sim's Robot Setup and Asset Validator guidance informs rules for mass/inertia, collisions, articulation, joints/drives, naming, materials, and layers, but Isaac is not required for validation.
- A canonical robot asset should separate source/base visual data from physics and sensor features so later Isaac-specific layers can be added without rewriting the core asset.

Sources: [OpenUSD 26.05](https://openusd.org/release/), [OpenUSD asset structure principles](https://docs.omniverse.nvidia.com/usd/latest/learn-openusd/independent/asset-structure-principles.html), [Isaac Robot Setup](https://docs.isaacsim.omniverse.nvidia.com/latest/robot_setup/index.html), [Isaac Asset Validation](https://docs.isaacsim.omniverse.nvidia.com/latest/robot_setup/asset_validation.html), [Isaac URDF import](https://docs.isaacsim.omniverse.nvidia.com/latest/importer_exporter/import_urdf.html).

## Research Gates

Before broad implementation, MS1 must prove: hardened Electron package; database migrations/backup; provider discovery/stream/tool normalization; Blender connect/snapshot/mutate/manual revision/checkpoint; and OpenUSD author/reopen/reference resolution. Failed proofs follow the predetermined fallbacks in `OPEN_QUESTIONS.md`; they do not authorize silent architecture changes.
