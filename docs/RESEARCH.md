# Technical Research

## Status and Method

- Research date: 2026-07-18
- Status: MS1/MS2 bounded proofs complete, including the owner-keyed live NVIDIA probe
- Method: Prefer current official documentation and upstream source repositories. Popularity alone is not adoption evidence.

Every adopted dependency must be pinned, inventoried, security-reviewed, and verified in
a packaged Windows path. Blender is exercised from the separate verified LTS installation;
MS5 embeds the fixed Python/OpenUSD worker after packaged author/reopen proof.

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
| Electron 43.x | Windows desktop shell | MIT; current stable releases | Bundles a compatible Node runtime and established packaging/security guidance | Large bundle and renderer attack surface | Adopted; packaged shell, isolated renderer, smoke tests, and all nine fuses verified |
| React + Vite + TypeScript | Renderer and shared domain types | Permissive, actively maintained | Fast component development and typed interfaces | Dependency churn | Adopt pinned stable versions |
| `@assistant-ui/react` | Modern chat primitives | MIT; active project | Reduces message/thread/accessibility work; supports custom runtimes | Provider/cloud adapters could create lock-in | Use primitives plus local custom runtime only; no Assistant Cloud; prove Electron/Vite fit |
| `node:sqlite` | Local project/global persistence | Node license; delivered with Node 24 | No native add-on rebuild and defensive SQLite API | API is release-candidate stability | Adopt behind interface if packaged spike passes; fixed fallback to `better-sqlite3` |
| Blender 4.5 LTS Python API | Authoritative scene integration | Blender GPL; maintained LTS | Official scene/import/export APIs and headless testing | `bpy` is main-thread sensitive; USD importer/exporter has composition limits | Require separate install; build thin GPL extension and direct background tests |
| `usd-core` 26.5 | OpenUSD authoring and verification | TOST-1.0; Pixar-maintained | Official Windows CPython 3.13 wheel; includes core schemas without imaging burden | Native DLL packaging and license notices | Adopted in fixed packaged sidecar; deep relocated reopen passes |
| UsdPhysics | Neutral robotics physics schemas | Part of OpenUSD | Standard articulation, collision, joint, and mass representation | Does not guarantee Isaac-specific readiness | Adopt neutral P0 layer; add rule parity with Isaac guidance |
| NVIDIA hosted NIM | Primary inference | Commercial service terms; official NVIDIA API | Hosted Nemotron avoids impractical local hardware; OpenAI-compatible streaming/tool surfaces | Access/model/capabilities vary by endpoint | Discover and probe at runtime; never hard-code success |
| OpenAI Responses API | Optional secondary provider | Commercial service terms; official SDK/API | Proves provider abstraction; current models can support text/image/tool workflows | Cost, access, and model changes | Optional P0 proof, capability-driven selection |
| Three.js | Embedded inspection | MIT; active | GLB preview, selection, camera controls, wide ecosystem | A separate renderer can become stale | Adopted directly at 0.184.0; display revision-stamped Blender-generated preview, never independent truth |
| Urchin | URDF parsing | MIT; release 0.0.30 in 2025 | Maintained fork of urdfpy; neutral Python importer path | Python 3.13/package and asset edge cases unproved | Candidate; map into `RobotGraph`; fallback evaluation is `yourdfpy` |
| MuJoCo Python | MJCF parsing/compilation | Apache-2.0; Google DeepMind active releases | Official parser and Windows wheels | Native package size; plugins/includes are security-sensitive | Candidate for post-hackathon guaranteed MJCF; reject plugins/external paths |
| Electron Forge | Installer/portable packaging | MIT; active | Standard Electron packaging hooks | Unsigned installer may trigger SmartScreen | Adopted for portable proof; installer plus ZIP remain MS9 |

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

## MS1 Research Gate Result

The hardened Electron package, SQLite migrations/backup/recovery, deterministic provider
normalization, real Blender connect/snapshot/mutation/manual revision/checkpoint/reconnect,
and OpenUSD author/reopen checks pass. The architecture fallbacks were not invoked. The
packaged NVIDIA probe discovered 119 models, found the intended Nemotron identifier,
streamed text, observed a harmless tool call without execution, and accepted an explicit
reasoning-control request. The credential and raw model output are absent from committed
evidence.

## MS5 Research Gate Result

The Blender 4.5 exporter, Python 3.13.14, `usd-core` 26.5, and UsdPhysics seams pass as a
packaged path. The official wheel relocates with the fixed Python runtime, authors neutral
composition layers, flattens a quick file, resolves dependencies after a package move, and
inspects articulation/physics/material/sensor schemas. No alternate USD library or
Blender-only composition fallback was required. Release size/notices remain an MS9 audit;
Isaac-specific validation remains optional V2 work.

## MS6 Research Gate Result

Direct Three.js 0.184.0 proved sufficient for GLB loading, hierarchy/identity inspection,
orbit/pan/zoom, dimensions/material metadata, and selection without adding React Three
Fiber. A custom `@assistant-ui/react` local runtime retained project SQLite and provider
neutrality. Packaged tests prove the renderer remains sandboxed despite the expanded
workspace API, while exact-revision previews and runtime capability routing fail stale or
unprobed work closed.

## MS7 Research Gate Result

The approved contracts were sufficient without an architecture or dependency change.
A reusable `EnvironmentGraph` plus the existing `RobotGraph` materializes atomically in
Blender, deterministic graph-to-scene rules detect a deliberately displaced gripper
finger, and source-tagged assumed mass/inertia remain explicit. Blender can export a
selected environment geometry layer beside robot geometry; the pinned OpenUSD worker
composes 15 stable environment identities and reopens the complete package after it is
moved. This proves the generated P0 path while leaving parser and hostile-reference risk
isolated to the bounded MS8 import work.

## MS8 Research Gate Result

The pinned Open Robotics `ros/urdf_tutorial` physics fixture proves the licensed robot
path without adopting a broad arbitrary importer. `fast-xml-parser` 5.10.0 is sufficient
for the contained URDF subset when entities, DTDs, Xacro, command substitution, remote
URLs, unknown package roots, symlinks, size overflow, and post-approval hash changes are
rejected before Blender access. The converter maps 16 links, 15 joints, collisions,
inertials, materials, and contained assets into `RobotGraph`; eight COLLADA visual/
collision uses remain hash-retained but explicitly approximated as boxes.

Blender 4.5.11's native operators successfully generated, staged, and exact-decided one
self-contained BLEND, USD, GLB, FBX, OBJ, and STL fixture. `UsdUtils.ComputeAllDependencies`
provides the authoritative USD dependency inventory. GLTF external URIs, OBJ material
references, USDA external assets, escaping paths, and changed approved bytes fail closed.
The accepted URDF path reuses deterministic validation, materialized review, canonical
OpenUSD export, deep moved reopen, reports, and source/license packaging. No Urchin,
yourdfpy, MuJoCo, or generic Blender MCP dependency was needed for MS8.

Sources: [ROS URDF Tutorial](https://github.com/ros/urdf_tutorial),
[fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser), and
[OpenUSD dependency APIs](https://openusd.org/release/api/usd_utils_page_front.html).

## Isaac Sim Pre-Submission Research Gate (2026-07-19)

The owner promoted the retained Isaac loop into active pre-submission work (DEC-028).
Current official guidance identifies Isaac Sim 6.0.1 as the supported Windows release and
Python 3.12 as its standalone environment. The standalone workflow is selected because it
provides explicit headless physics/render stepping for reproducible experiments. SimForge
will discover a separately installed runtime, invoke only a fixed contained script, and
retain exact request/result/artifact hashes; it will not bundle Isaac or depend on
deprecated Omniverse Launcher/Nucleus components.

The development machine has Windows 11, an RTX 5070 with 12,227 MiB VRAM, driver 610.62,
approximately 27.4 GiB RAM, and no detected Isaac installation. The current 6.0 system
table lists 32 GB RAM and 16 GB VRAM as minimums, so the machine is below the published
minimum despite a sufficient driver and 247 GB free on `C:`. Installation/probing may
still be attempted as bounded evidence, but Environment Doctor must report this mismatch
and no success may be claimed unless a real run completes. A compatible external machine
or NVIDIA cloud runner remains the honest acceptance fallback if local execution fails.

Sources: [Isaac Sim 6.0.1 workstation installation](https://docs.isaacsim.omniverse.nvidia.com/latest/installation/install_workstation.html), [Python environment installation](https://docs.isaacsim.omniverse.nvidia.com/latest/installation/install_python.html), [workflows](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/introduction/workflows.html), [6.0 requirements](https://docs.isaacsim.omniverse.nvidia.com/6.0.0/installation/requirements.html), and [asset validation rules](https://docs.isaacsim.omniverse.nvidia.com/latest/py/source/extensions/isaacsim.asset.validation/docs/index.html).

### Isaac implementation result

The bounded installation succeeded without modifying the existing Omniverse installation.
An ignored Python 3.12.10 environment now contains `isaacsim[all,extscache]` 6.0.1.0 and
the official CUDA 13.0 PyTorch 2.11.0 dependency. Environment Doctor proves the runtime
and preserves the honest `BELOW_PUBLISHED_MINIMUM` status. Headless execution and the
native GUI both opened copied canonical packages successfully on the RTX 5070 machine.

The first real warehouse run produced `ISAAC-STABILITY-001: FAIL`. SimForge derived an
exact -0.124770 m arm-subtree correction, rejected it without approval, checkpointed and
applied the approved Blender operation, revalidated and re-exported the scene, then ran a
parent-linked child experiment with `ISAAC-STABILITY-001: PASS`. Five captured frames,
checks, metrics, logs, hashes, runtime identity, and manifests are retained per experiment.
The fixed health probe had to be moved outside authored project geometry and given a
larger session-only ground so warehouse collisions could not contaminate the runtime
sanity metric; this diagnosis is now a regression test rather than a hidden assumption.
