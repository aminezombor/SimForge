# Devpost Draft — SimForge

Owner review is required before publication. Personalize the first paragraph in your own voice.
Keep legal identity, country, video URL until ready, and the private `/feedback` Session ID
out of this repository.

## Form Fields

- **Project name:** SimForge
- **Category:** Developer Tools
- **Elevator pitch:** Turn a robotics goal into approved Blender work, verified USD, and Isaac feedback—with deterministic checks and human control.
- **Repository:** https://github.com/aminezombor/SimForge
- **Release / judge download:** https://github.com/aminezombor/SimForge/releases/tag/v0.1.2
- **Video:** [OWNER: public or unlisted YouTube URL under three minutes]
- **Submitter type and country:** [OWNER: select your actual legal details]
- **Codex Session ID:** [OWNER: run `/feedback` and enter the result only in Devpost]
- **Built with:** Codex, GPT-5.6, OpenAI Responses API, NVIDIA NIM, NVIDIA Nemotron,
  Electron, TypeScript, React, SQLite, Blender 4.5 LTS, Python, OpenUSD, USD,
  NVIDIA Isaac Sim, Three.js, Windows

## About the Project

### The problem

Preparing a simulation-ready robot is still a fragmented workflow. A robotics creator moves
between modeling, scripts, hierarchy and collision checks, physics metadata, USD packaging,
and simulation—often without a reliable record of what changed or why. That makes iteration
slow for technical artists, robotics developers, and physical-AI teams, especially when an
AI assistant is allowed to act without clear limits.

### What we built

SimForge is a Windows desktop application that makes robotics authoring conversational
without hiding the engineering process. A user describes a goal, reviews an exact plan,
watches structured work happen in the real Blender scene, inspects deterministic findings,
approves material corrections, and exports a modular USD package that SimForge reopens
before reporting readiness.

The working demonstration starts from a blank Blender scene and creates a warehouse mobile
manipulator: wheeled base, arm, gripper, sensor representations, collision geometry,
materials, physics metadata, and warehouse objects. A deterministic stability check catches
a real issue. The user approves a bounded correction, SimForge checkpoints and revalidates
the scene, then exports a portable USD package with relative references and 12 passing
reopen checks. Optional Isaac Sim runs the same package, retains the initial failure, and
links an approved correction to a passing waypoint rerun.

### Why it is different

SimForge is not a text-to-3D black box. Blender is the visual source of truth, while
deterministic geometry, robotics, OpenUSD, and simulation checks provide the engineering
evidence. AI can propose and explain actions, but it cannot silently perform consequential
work or declare its own result correct.

A clean chat guides the primary experience through **Plan → Build → Export → Simulate**.
Guided, Balanced, and Autonomous authority are explicit; Guided is the default. Plan Mode
is technically unable to mutate Blender, and export/overwrite, destructive, privacy-sensitive,
and privileged fallback actions always retain human approval. Checkpoints, revisions,
activity history, fresh snapshots, and stale-action rejection make changes recoverable.

### How we built it with Codex and GPT-5.6

Codex with GPT-5.6 accelerated the engineering work end to end: it transformed the master
brief and owner feedback into **133 traceable requirements** and **42 acceptance scenarios**,
compared architecture and license trade-offs, implemented the Electron desktop app, Blender
bridge, OpenUSD sidecar, and Isaac feedback seam, and helped drive real Blender/OpenUSD/Isaac
acceptance, security hardening, packaging, and release documentation. We used retained
deterministic test evidence rather than model self-evaluation as proof of completion.

SimForge also contains an optional provider-neutral **OpenAI Responses API** adapter with
runtime model discovery and normalized events; a compatible GPT-5.6 model can be selected
when an owner configures OpenAI credentials. The recorded product workflow uses the
configured NVIDIA/Nemotron route, discovered and capability-probed at runtime. We state
that distinction deliberately so the demo remains accurate.

## Technical Implementation

The sandboxed Electron renderer communicates through narrow validated IPC to a TypeScript
main process that owns policy, SQLite storage, providers, filesystem access, jobs, Blender
connectivity, and export. A thin GPL-3.0-or-later Blender extension uses an authenticated
outbound loopback connection and executes Blender work on Blender's main thread. Versioned
contracts cover scenes, robots, validation, providers, and exports.

Blender creates visual geometry/material layers. A bundled Python 3.13 / `usd-core 26.5`
sidecar writes neutral physics and composition layers, then reopens the USD package to
validate composition, schemas, relative references, portability, and hashes. Optional
Isaac Sim runs a fixed local experiment against a copied, hash-bound package and retains
before/after evidence with parent/child lineage.

## Judge Test

1. Download the v0.1.2 installer or portable ZIP from the release and verify
   `SHA256SUMS.txt`.
2. Install Blender 4.5 LTS and the release Blender extension ZIP. Launch Blender once.
3. Launch SimForge, open **Settings → Environment**, and choose **Recheck**.
4. Optional: enter an NVIDIA key directly in protected Settings and discover models. Never
   paste keys into chat. The deterministic local path remains available without a key.
5. In a new chat, enter: `prepare for me in blender a wheeled robot with a gripper hand`.
   Review and approve the plan and build. Blender visibly creates the robot/workcell.
6. Enter: `export this robot to USD for simulation`. Choose an empty destination, approve
   export, and confirm the 12 USD reopen checks.
7. If Isaac Sim is configured, enter: `send it to simulation in Isaac Sim`. Approve the
   run, inspect the failure, approve the correction, re-export, and rerun the waypoint task.

Exact expected states, timings, fallback evidence, and troubleshooting:
`docs/OWNER_JUDGE_TEST.md`.

## Platform and Limitations

Supported release baseline: **Windows 11 x64** and **Blender 4.5 LTS**. Blender is a
separate install. The installer is unsigned; the portable ZIP is the SmartScreen fallback.
Isaac Sim 6.0.1 is optional and not required for authoring or USD export. Broader CAD
fidelity, Linux, larger asset libraries, and full format coverage remain post-hackathon
work. The current Isaac evidence uses a bounded sample and was produced on hardware below
NVIDIA's published recommended RAM/VRAM minimum.

## Media Plan

Use the 2:40 narration and capture sequence in `docs/DEMO_SCRIPT.md`. It shows the
problem, clean conversational flow, real Blender creation, deterministic failure and
approved correction, verified USD, Isaac rerun, and the concrete Codex/GPT-5.6 contribution.
