# SimForge

SimForge is a Windows-first, local-first desktop application for conversational robotics
authoring in a real Blender scene. It turns a goal into a visible, approval-controlled
loop: inspect → plan → build → validate → correct → export → reopen → simulate.

![SimForge workspace](docs/evidence/ms9a/ui/workspace-1280x720.png)

Blender remains the visual source of truth. Deterministic geometry, robotics, OpenUSD,
and Isaac Sim checks provide evidence; model commentary is advisory. Guided, Balanced,
and Autonomous authority let users choose speed without removing permanent approval gates.

## Download

Download **v0.1.2** from [GitHub Releases](https://github.com/aminezombor/SimForge/releases/tag/v0.1.2):

- `SimForge-Setup.exe` — Windows installer (unsigned)
- `SimForge-win32-x64-0.1.2.zip` — portable SmartScreen fallback
- `simforge_bridge-0.1.0.zip` — Blender extension
- `SimForge-Warehouse-Sample-0.1.2.zip` — sanitized sample project and verified USD
- `SHA256SUMS.txt` — integrity hashes

Supported baseline: Windows 11 x64 and Blender 4.5 LTS. NVIDIA NIM/Nemotron is the
primary demo provider; the key is optional for deterministic local workflows. Isaac Sim
6.0.1 is optional, separately installed, and not required for authoring or USD export.

## Five-Minute Judge Test

1. Install SimForge, or extract the portable ZIP and run `SimForge.exe`.
2. Install Blender 4.5 LTS and the release extension ZIP in Blender Preferences → Get
   Extensions → Install from Disk. Launch Blender once.
3. Open SimForge Settings → Environment and run **Recheck**. Blender, extension,
   storage, loopback, and bundled OpenUSD should pass; unconfigured providers/Isaac warn.
4. Optional: in Settings → AI providers, save an NVIDIA key, then select **Discover
   models**. The key stays in Windows-protected storage and must never be pasted into chat.
5. In a new chat, enter `prepare for me in blender a wheeled robot with a gripper hand`.
   Review **Approve plan & build**, then confirm the exact checkpointed Blender action.
6. After Blender visibly creates the robot and workcell, enter
   `export this robot to USD for simulation`, choose an empty destination, and approve.
   Confirm 12 reopen checks and physics/composition layers.
7. If Isaac Sim is configured, enter `send it to simulation in Isaac Sim`. Approve the
   run, review the retained stability failure, approve the checkpointed Blender correction,
   re-export, and rerun. The corrected waypoint task should pass and open natively.

Exact clicks, expected text, timings, fallback evidence, and troubleshooting are in
[the owner/judge procedure](docs/OWNER_JUDGE_TEST.md).

## What Works

- Persistent conversations, goals, checkpoints, revisions, branches, activity, and recovery
- Runtime NVIDIA/OpenAI model discovery and capability-aware routing
- Authenticated loopback Blender 4.5 bridge with fresh snapshots and stale-edit rejection
- Generated warehouse manipulator plus licensed URDF and native-format staging paths
- Deterministic geometry/robotics checks and reversible or exact-approved fixes
- Revision-stamped 3D previews, visual review, modular USD export, and deep reopen
- Optional Isaac failure → approved Blender correction → passing parent-linked rerun
- Sandboxed Electron renderer, narrow IPC, DPAPI credentials, path containment, and no telemetry

## How ChatGPT, Codex, and GPT-5.6 Helped Build This Project

SimForge was a human-directed collaboration. The project creator supplied the original
idea, product vision, robotics goals, UX expectations, engineering direction, and approval
of every major product and architecture decision. AI accelerated definition and execution;
it did not invent the product or operate without human direction.

### Product Creator

The creator defined the problem and intended experience: conversational robotics authoring
that keeps Blender visible, makes consequential actions reviewable, and carries an idea
through validation, USD export, and simulation feedback. The creator reviewed working
builds, rejected an overly busy engineering UI, selected the simpler 0.1.2 submission
workflow, required a clean Blender starting scene, and approved the release scope.

### ChatGPT and GPT-5.6: Product Definition

Before implementation, ChatGPT supported brainstorming, product critique, requirement
definition, scope prioritization, and preparation of the structured master implementation
brief. Together, the creator and ChatGPT:

- clarified the user problem, target workflow, and intended product experience;
- reconstructed useful lessons from an earlier prototype without making it this
  repository's implementation source;
- defined functional, non-functional, security, privacy, installation, and submission
  requirements;
- separated the hackathon vertical slice, post-hackathon V1, and the future Isaac Sim
  feedback-loop scope;
- specified Plan and Build separation, approval gates, Blender scene truth, deterministic
  validation, checkpoints, memory, capability-aware model routing, and USD readiness; and
- produced the persistent product context and master Codex instructions used throughout
  the build.

### Codex with GPT-5.6: Primary Implementation Agent

Working across the repository under the creator's approvals, Codex audited the brief,
researched current technical approaches and reusable projects, proposed the architecture
and milestones, and created or modified the application code. It implemented the Electron
application, structured Blender bridge and agent workflows, deterministic validation,
OpenUSD pipeline, and optional Isaac feedback loop. Codex also ran tests and live
acceptance procedures, diagnosed and corrected failures, maintained the repository and
evidence, and prepared setup, release, and submission documentation.

### Where Codex Accelerated the Workflow

Concrete repository evidence includes:

- Commit `b0862cf` decomposed the master brief into an architecture baseline; the current
  audit contains 133 mapped requirements and 42 referenced acceptance scenarios with zero
  unmapped rows.
- Commits `8a83325` through `7141635` delivered independently testable Blender, policy,
  validation, robotics, OpenUSD, workspace, import, and Isaac milestones while preserving
  decision, test, and evidence records beside the code.
- Installed testing exposed and helped correct a 30-second Blender bridge disconnect,
  terminal-producing launch paths, stale scene state, Blender/USD typing and identity
  defects, release-script and Environment Doctor failures, and an obstructing factory Cube.
- The 0.1.2 rehearsal found and fixed export-intent ambiguity, then verified the recorded
  blank-Blender -> approved build -> 12-check USD reopen -> Isaac failure -> approved
  `-0.1248 m` correction -> passing `1.2 m` waypoint rerun sequence.
- The published checkpoint records 57 passing default tests, six opt-in live/provider
  tests, five real Blender acceptance paths, release hashes, and sanitized machine-readable
  evidence rather than relying on model self-assessment.

See the [Codex usage log](docs/CODEX_USAGE_LOG.md), [decision record](docs/DECISIONS.md),
[progress ledger](docs/PROGRESS.md), and [acceptance tests](docs/ACCEPTANCE_TESTS.md) for
the detailed, auditable history.

### Important Human Decisions

The project creator made or explicitly approved the decisions that shaped the product:

- build a standalone desktop application instead of an IDE extension or Blender-only UI;
- make conversational Blender authoring the primary experience;
- enforce Plan versus Build separation, with model suggestions never granting authority;
- treat the live Blender scene and monotonic revision as scene truth;
- require deterministic geometry, robotics, USD, and simulation evidence;
- allow only preconditioned, reversible safe fixes automatically while requiring approval
  for structural, destructive, privacy-sensitive, or privileged changes;
- require the user to initiate export and approve its exact destination and overwrite scope;
- reopen and verify the simulation-ready USD package before reporting readiness; and
- prioritize a reliable generated-robot hackathon vertical slice before broader formats,
  providers, and future topology optimization.

## Development

Prerequisites: Windows 11 x64, Node.js 24+, pnpm 10+, and Blender 4.5 LTS for live tests.

```powershell
pnpm install
pnpm verify
pnpm make
pnpm package:extension
```

`pnpm verify` runs TypeScript, ESLint, Vitest, and the secret scan. Live Blender and Isaac
tests are opt-in; see [acceptance tests](docs/ACCEPTANCE_TESTS.md). Project data remains
portable, while global settings and protected credentials live under
`%LOCALAPPDATA%\SimForge`.

## Security, Licensing, and Limitations

The renderer has no Node or filesystem authority. Cloud dispatches identify provider,
model, purpose, and data classes first. Never put secrets in prompts, screenshots, source,
logs, or issue reports. See [Security](docs/SECURITY.md) and [Privacy](docs/PRIVACY.md).

The desktop source is Apache-2.0; Blender-loaded extension source is GPL-3.0-or-later.
See [third-party notices](THIRD_PARTY_NOTICES.md) and the
[dependency inventory](docs/DEPENDENCIES_AND_LICENSES.md).

Known limitations: the installer is unsigned; Blender and Isaac are not bundled; this
release targets Windows 11 x64; Isaac evidence was produced below NVIDIA's published
minimum hardware and uses a bounded sample; visual-model review is optional; broader CAD,
Linux, and full format guarantees remain post-hackathon work.

Uninstall SimForge from Windows Installed apps. Remove the Blender extension in Blender
Preferences. Delete `%LOCALAPPDATA%\SimForge` only if you also want to remove protected
settings and local app state; portable project folders are separate and are not removed.

## Architecture

Electron/TypeScript owns policy, storage, providers, jobs, and files; a thin GPL Blender
extension performs structured `bpy` work; a bundled Python/OpenUSD sidecar authors and
reopens neutral USD; optional Isaac runs fixed local experiments. See
[Architecture](docs/ARCHITECTURE.md) and [decisions](docs/DECISIONS.md).
