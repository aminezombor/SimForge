# Devpost Draft — SimForge

Owner review is required before this copy is published. Rewrite at least the opening and
impact paragraphs in the owner’s own voice; do not submit AI-generated description text
unchanged. Keep private form values and the `/feedback` Session ID out of this repository.

## Form Fields

- Project name: **SimForge**
- Category: **Developer Tools**
- Tagline: **Turn robotics goals into verified Blender and USD assets with human-controlled AI.**
- Repository: `https://github.com/aminezombor/SimForge`
- Video: `[OWNER: public YouTube URL under three minutes]`
- Submitter type: `[OWNER: private form selection]`
- Country: `[OWNER: private form selection]`
- Codex Session ID: `[OWNER: run /feedback and enter only in the required private field]`
- Built with: Codex, GPT‑5.6, NVIDIA NIM/Nemotron, Electron, TypeScript, React,
  Blender 4.5 LTS, OpenUSD, Python, SQLite, Three.js, NVIDIA Isaac Sim

## Description

Preparing a simulation-ready robot is still a fragmented engineering workflow. A creator
moves between modeling, scripts, hierarchy and collision checks, physics metadata, USD
packaging, and simulation—often without a reliable record of what changed or why.

SimForge is a Windows desktop application that makes this workflow conversational without
hiding it. A user describes a robotics goal, reviews a testable plan, watches structured
work happen in the real Blender scene, inspects deterministic findings, approves material
corrections, and exports a modular USD package that SimForge reopens before reporting
success. Blender is the visual authority; deterministic rules and retained evidence are
the engineering authority.

The working demonstration builds a warehouse mobile manipulator with a wheeled base, arm,
gripper, sensors, collision geometry, materials, and physics metadata. SimForge catches a
real gripper defect, checkpoints and corrects it under approval, revalidates, exports and
relocates the USD package, then closes an optional Isaac Sim loop from failed stability
evidence to an approved Blender correction and passing parent-linked rerun.

Users choose Guided, Balanced, or Autonomous action authority. Plan Mode is technically
unable to mutate Blender, and export/overwrite, destructive, privacy-sensitive, and
privileged fallback actions always keep a human gate. NVIDIA is the primary AI provider;
models are discovered and capability-probed at runtime, and text-only models cannot
receive visual-review work. Projects remain local and portable, credentials use Windows
protection, and there is no SimForge telemetry service.

## Key Features

- Conversation, planning, persistent goals, checkpoints, revisions, branches, and activity history
- Real Blender scene snapshots, manual-edit detection, stale-action rejection, and structured tools
- Deterministic geometry, robotics, environment, OpenUSD, and Isaac checks
- Generated warehouse robot plus licensed URDF and native-format staging demonstrations
- Capability-aware NVIDIA/OpenAI routing with explicit cloud disclosure and local fallback
- Quick and modular USD export with hashes, relative references, reports, and deep reopen
- Optional reproducible Isaac failure → approved correction → passing rerun history
- Installer, portable build, sample project, Environment Doctor, and judge procedure

## How It Was Built

The sandboxed Electron renderer talks through narrow validated IPC to a TypeScript main
process that owns policy, SQLite, providers, paths, jobs, Blender connectivity, and export.
A thin GPL Blender extension makes authenticated outbound loopback connections and runs
all `bpy` work on Blender’s main thread. Versioned schemas define scene, robot, environment,
provider, validation, and export contracts. Blender writes visual layers; a bundled fixed
Python 3.13 / usd-core 26.5 sidecar authors neutral physics/composition layers and reopens
the result. Optional Isaac Sim runs a fixed local task against a copied, hash-bound package.

Codex with GPT‑5.6 translated the master brief and owner refinements into 133 atomic requirements and 42
acceptance scenarios, evaluated the architecture and licenses, implemented the vertical
slices, operated real Blender/OpenUSD/Isaac acceptance, diagnosed packaging and security
defects, and maintained decisions, traceability, tests, and submission evidence. Model
self-evaluation was never used as completion evidence.

## Testing Instructions

1. Download v0.1.2 installer or portable ZIP and verify `SHA256SUMS.txt`.
2. Install Blender 4.5 LTS and the release Blender extension ZIP.
3. Launch SimForge and run Settings → Environment → Recheck.
4. Optional: enter an NVIDIA key directly in protected Settings and discover models.
5. In chat, request `prepare for me in blender a wheeled robot with a gripper hand`,
   review the plan, and approve the checkpointed Blender build.
6. Request USD export, choose/approve an empty destination, and confirm 12 reopen checks.
7. With Isaac configured, request simulation, inspect the real retained stability failure,
   approve its bounded Blender correction, re-export, and rerun the passing waypoint task.

Detailed expected states and fallback evidence: `docs/OWNER_JUDGE_TEST.md`.

## Supported Platform and Limitations

Supported release baseline: Windows 11 x64 and Blender 4.5 LTS. The installer is unsigned;
the portable ZIP is supplied as a SmartScreen fallback. Blender and Isaac Sim are separate
installs. Isaac 6.0.1 is optional; local bounded evidence was produced on hardware below
NVIDIA’s published 32 GB RAM / 16 GB VRAM minimum. Broader CAD fidelity, Linux, larger
asset libraries, and full post-hackathon format guarantees are roadmap work.

## Judge Notes

Use the generated warehouse path first; it is the stable critical path. A provider outage
does not block deterministic build/validation/export: the app discloses and uses its local
fixture. Retained screenshots, reports, USD manifests, and Isaac before/after evidence are
sanitized and included in the repository. Expected first-run test time is 5–10 minutes
after Blender is installed.
