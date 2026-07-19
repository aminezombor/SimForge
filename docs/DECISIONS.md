# Decision Log

## Policy

Requirements state required outcomes. Decisions record chosen product interpretations or implementation approaches. Consequential changes require a new decision; never rewrite history silently. Statuses are Proposed, Approved, Rejected, or Superseded.

## Decision Index

| ID | Date | Area | Decision | Status | Related requirements |
| -- | ---- | ---- | -------- | ------ | -------------------- |
| DEC-001 | 2026-07-18 | Process | Repository documentation is persistent memory and the clean repository is the source of truth. | Approved | REQ-GOV-001, REQ-GOV-002 |
| DEC-002 | 2026-07-18 | Delivery | Major implementation requires owner approval of the architecture and milestone plan. | Approved | REQ-GOV-008 |
| DEC-003 | 2026-07-18 | Product | Use SimForge as the working product name and Developer tools as the hackathon category. | Approved | REQ-SUBMISSION-001 |
| DEC-004 | 2026-07-18 | Desktop | Use Electron 43.x, React, TypeScript, Vite, and pnpm; keep privileged work in the Electron main process. | Approved | REQ-PROD-001, REQ-PLATFORM-001 |
| DEC-005 | 2026-07-18 | Storage | Use `node:sqlite` behind a repository abstraction for global/project data; fall back to pinned `better-sqlite3` only if the MS1 packaging spike fails. | Approved | REQ-DATA-001 through REQ-DATA-005 |
| DEC-006 | 2026-07-18 | Blender | Target separately installed Blender 4.5 LTS with a thin outbound, loopback-only Python extension and versioned structured protocol. | Approved | REQ-BLENDER-001 through REQ-BLENDER-010 |
| DEC-007 | 2026-07-18 | AI | Use hosted NVIDIA NIM as primary, runtime capability discovery/probing, and a provider-neutral adapter; add optional OpenAI Responses support. | Approved | REQ-AI-001 through REQ-AI-012 |
| DEC-008 | 2026-07-18 | Policy | Enforce mode and risk permissions in deterministic application code. The model never grants itself tools or approvals. | Approved | REQ-MODE-003, REQ-MODE-004, REQ-MODE-009 |
| DEC-009 | 2026-07-18 | USD | Use Blender for geometry/material export and a bundled Python 3.13 plus `usd-core` 26.5 sidecar for neutral OpenUSD composition and verification. | Approved | REQ-USD-001 through REQ-USD-006 |
| DEC-010 | 2026-07-18 | Validation | Use rule-based Blender, robotics, and OpenUSD validation; vision is advisory and ambiguous changes require human approval. | Approved | REQ-PROD-007, REQ-VALIDATION-001 through REQ-VALIDATION-012 |
| DEC-011 | 2026-07-18 | Security | Sandbox the renderer, validate narrow IPC/RPC, use DPAPI-backed `safeStorage`, and treat Blender Python/imports/model output as untrusted privileged inputs. | Approved | REQ-SECURITY-001 through REQ-SECURITY-007 |
| DEC-012 | 2026-07-18 | Licensing | License the desktop application Apache-2.0 and the Blender extension GPL-3.0-or-later, with explicit package boundaries and third-party notices. | Approved | REQ-IMPORT-005, REQ-SUBMISSION-004 |
| DEC-013 | 2026-07-18 | Scope | Make the generated robot path P0, the imported robot demonstration P1, full guaranteed import coverage post-hackathon V1, and the Isaac loop V2. | Approved | REQ-IMPORT-001 through REQ-IMPORT-004, REQ-V2-001 through REQ-V2-004 |
| DEC-014 | 2026-07-18 | Delivery | Use MS0-MS5 for the first usage cycle and MS6-MS9 for the second; stop after MS0 until the owner explicitly starts MS1. | Approved | REQ-GOV-007 |
| DEC-015 | 2026-07-18 | Storage | Retain `node:sqlite`; its packaged migration, WAL, backup/recovery, global-index, and portable-project spikes passed. | Approved | REQ-DATA-001 through REQ-DATA-005 |
| DEC-016 | 2026-07-18 | Compatibility | Pin Electron 43.1.1, Blender 4.5.11 LTS, Python 3.13.14, `usd-core` 26.5, and assistant-ui 0.14.27 for the proven seams. | Approved | REQ-PLATFORM-001, REQ-BLENDER-001, REQ-USD-001 |
| DEC-017 | 2026-07-18 | Scene truth | Persist a monotonic revision floor in the protected bridge descriptor so Blender reconnects cannot move project scene truth backward. | Approved | REQ-BLENDER-003, REQ-BLENDER-004, REQ-BLENDER-007 |
| DEC-018 | 2026-07-18 | Security | Apply a strict complete Electron fuse policy with current `@electron/fuses`, then inspect the packaged binary. | Approved | REQ-SECURITY-001, REQ-SECURITY-002 |
| DEC-019 | 2026-07-19 | Product UX | Use the owner-directed three-column workspace contract: conversation rail, central mode-aware authoring surface, and contextual viewport/activity/validation/export dock; keep credentials in Settings and active routing visible. | Approved | REQ-AI-008 through REQ-AI-010, REQ-UX-001 through REQ-UX-009, REQ-VIEW-001 through REQ-VIEW-004 |
| DEC-020 | 2026-07-19 | Validation and recovery | Materialize Blender geometry evidence in versioned snapshots, keep findings/fixes append-only in SQLite, allow only preconditioned `SAFE_LOCAL` operations without approval, and restore complete checkpoints only through exact approval plus a pre-restore checkpoint. | Approved | REQ-VALIDATION-001 through REQ-VALIDATION-005, REQ-FIX-001 through REQ-FIX-004, REQ-HISTORY-001, REQ-HISTORY-002 |
| DEC-021 | 2026-07-19 | Robotics authoring | Use a versioned provider-neutral `RobotGraph`, stable Blender identities, source-tagged physical values, deterministic `ROB-*` rules, and materialized advisory review renders for generated robots. | Approved | REQ-PROD-004, REQ-BLENDER-008, REQ-VALIDATION-006 through REQ-VALIDATION-010 |
| DEC-022 | 2026-07-19 | Test isolation | Packaged smoke modes must honor an explicit isolated user-data directory, never touch the normal profile, and keep hidden renderer closure from terminating a combined smoke sequence. | Approved | REQ-SECURITY-001, REQ-SECURITY-005, REQ-GOV-005 |
| DEC-023 | 2026-07-19 | USD export | Compose and validate neutral staged layers, then preverify, atomically promote, final-reopen, and roll back on failure under exact export approval. | Approved | REQ-VALIDATION-011, REQ-VALIDATION-012, REQ-USD-001 through REQ-USD-006 |
| DEC-024 | 2026-07-19 | OpenUSD runtime | Package a relocatable Python 3.13.14 plus `usd-core` 26.5 resource and invoke its fixed JSON worker without a shell or runtime download. | Approved | REQ-PLATFORM-001, REQ-SECURITY-004, REQ-USD-005 |
| DEC-025 | 2026-07-19 | Bridge lifecycle | Await bridge shutdown before app exit and remove dead, expired, or malformed descriptors before issuing a fresh token. | Approved | REQ-BLENDER-002, REQ-SECURITY-003, REQ-SECURITY-006 |

## Architecture Decision Details

### DEC-004: Electron desktop orchestrator

**Context.** A Windows desktop app must coordinate chat, local projects, model streaming, Blender, long jobs, and packaging. The environment already has Node but no Rust toolchain.

**Options.** Electron/TypeScript; Tauri/Rust; a Blender-native UI.

**Decision.** Electron keeps the primary app in one language and has a direct judge-friendly Windows packaging path. Tauri has a smaller footprint and strong capabilities but adds Rust, a third implementation language, and greater sidecar risk. A Blender-native UI conflicts with the standalone product and provider/project experience.

**Consequences.** Electron's larger bundle is accepted. Renderer isolation, CSP, context isolation, disabled Node integration, sender validation, and fuse/packaging checks are mandatory.

### DEC-006: Thin Blender extension

**Decision.** The app listens on an ephemeral loopback port; the extension connects outbound using a short-lived token. Socket work only queues messages. Blender mutations execute on its main thread. Every mutating request carries an expected scene revision and is rejected if stale.

**Consequences.** The protocol remains auditable and purpose-built. Generic MCP servers may inform research but will not be embedded. Python fallback remains explicitly privileged rather than falsely sandboxed.

### DEC-007: Runtime provider evidence

**Evidence.** The packaged NVIDIA path discovered 119 models and selected the intended
Nemotron identifier only after membership validation. Separate non-mutating probes
observed streamed text and a returned no-op tool call without executing it. Vision is
false; the endpoint accepted an explicit reasoning-control request; structured output
and numeric limits remain `unknown`, so routing cannot assume them. The provider-neutral
fallback and error paths continue to be deterministic tests.

### DEC-009: Neutral OpenUSD sidecar

**Decision.** Blender exports visual layers. A fixed, non-shell Python sidecar authors root/physics/sensor composition and reopens the package through `pxr`. Package convention is Z-up and meters-per-unit `1.0`, with relative references and a machine manifest.

**Consequences.** This avoids an Isaac Sim dependency and works around Blender USD composition limitations. The Python 3.13/OpenUSD author/reopen compatibility spike passes; embedding that fixed runtime in release artifacts remains MS5/MS9.

### DEC-012: Split licenses

**Decision.** Desktop source is Apache-2.0. Code loaded into Blender is GPL-3.0-or-later. Each distributable carries its license; the root README and notices explain the boundary. Assets retain their source licenses.

**Consequences.** Do not mix Blender-dependent GPL source into the Apache desktop package. Revisit with legal counsel before any proprietary/commercial distribution; this is an engineering compliance decision, not legal advice.

### DEC-015: Retain node:sqlite

**Evidence.** Global and per-project databases initialize in the packaged app. Tests
cover migrations, WAL, distinct portable projects, provider-neutral messages/records,
folder moves, consistent `VACUUM INTO` backup, and recovery. The predetermined
`better-sqlite3` fallback is not justified and remains uninstalled.

### DEC-017: Reconnect revision floor

**Context.** Blender process-local revision counters reset on crash. Resetting project
scene truth would make stale approvals appear current.

**Decision.** The app persists the greatest observed revision in the short-lived,
user-ACL-protected runtime descriptor. A reconnect initializes Blender at that floor;
every mutation or manual event advances it. Real crash/checkpoint/reconnect evidence
proves revisions remain monotonic.

### DEC-018: Complete Electron fuse policy

**Context.** Electron 43 added a ninth fuse while Electron Forge 7.11.2's optional fuse
plugin still constrained its peer utility to a version exposing eight. Strict packaging
correctly failed rather than leaving the new setting implicit.

**Decision.** Use Electron's current official `@electron/fuses` utility directly from
Forge's package hook, require a value for every fuse, retain WebAssembly trap handlers,
and inspect the final `SimForge.exe` fuse wire during verification.

**Consequences.** Package hardening cannot silently omit newly added Electron fuses.
Future Electron upgrades must fail the build until each new fuse has an explicit policy.

### DEC-019: Product workspace information architecture

**Context.** Owner review of the MS1/MS2 build found that the engineering harness could
be mistaken for the final UI and supplied an annotated workspace layout.

**Decision.** Adopt `docs/UX_WORKSPACE.md` as the product workspace contract. Provider
credentials and diagnostics move to Settings; only active routing stays in the main
workspace. Blender remains authoritative while the right-side viewport is a
revision-stamped inspector. Activity, validation, and export readiness share the
context dock. The current screen remains explicitly labeled as an engineering preview.

**Consequences.** MS3 and MS5 panels must fit this structure, while full navigation,
history, viewport, docking, and responsive integration remain MS6. This records an
owner interpretation of existing scope and does not change requirement priorities or
milestone approval gates.

### DEC-020: Deterministic validation and complete recovery

**Context.** Chat text and screenshots cannot prove geometry state. Corrections also
need a machine-enforced boundary between localized reversible work and changes that
alter scene structure or physical interpretation.

**Decision.** Fresh Blender snapshots now include metric settings, world bounds,
visibility, mesh counts/topology evidence, materials, and external file existence.
Eighteen stable `GEO-*` rules emit entity paths and deterministic evidence. A root
object's Z=0 support-plane correction is `SAFE_LOCAL` only when its exact revision,
object, and location preconditions still match. Applying scale is structural and uses
the existing exact plan/arguments/revision approval. Findings, runs, and fixes are
append-only SQLite records; successful fixes always checkpoint and revalidate.

Complete checkpoints add a consistent project-database backup and SHA-256 inventory of
the portable manifest, references, and generated scripts to the Blender save-copy.
Restore verifies those hashes, creates a pre-restore checkpoint, requires exact
approval, restores mutable project/task state and files, then refreshes and revalidates.

**Consequences.** Bounding-box overlap is explicitly conservative and support-plane
Z=0 is a displayed assumption. Robotics semantics and visual review remain separate
MS4 evidence channels; USD inspection remains MS5. No visual/model assertion is
promoted to deterministic evidence.

### DEC-021: Versioned robot authoring and evidence

**Context.** The primitive robot must prove a general authoring seam without embedding
warehouse-demo assumptions or allowing model prose to stand in for physical data.

**Decision.** A JSON-Schema-validated `RobotGraph` records links, joints, visual and
collision primitives, materials, sensors, conventions, self-collision policy, and
source-tagged mass/center-of-mass/inertia values. Exact-approved structured tools
materialize stable `simforge.*` identities and modify robot link poses. `ROB-*` rules
compare the stored graph with a fresh Blender snapshot. Lit revision-stamped renders
include useful angles, before/after evidence, and a materialized sensor representation;
their manifest is hashed and explicitly advisory.

**Consequences.** Assumed physical values remain visible and cannot be silently promoted
to measured truth. The graph is reusable by MS5 USD, MS7 generated manipulation, and MS8
imports. Exported-schema inspection remains an MS5 channel and imported-asset integrity
remains an MS8 extension of the same rules.

### DEC-022: Isolated packaged smoke profiles

**Context.** Electron's Chromium `--user-data-dir` switch was overridden by the app's
normal `%LOCALAPPDATA%\SimForge` path assignment, so a credential lifecycle smoke could
touch the real provider profile.

**Decision.** Only explicit smoke modes accept the supplied absolute user-data argument
and set Electron's path before initialization. Combined smoke keeps the application
alive after its hidden renderer closes. Verification hashes the primary database before
and after and requires an isolated database to be created.

**Consequences.** The pre-fix smoke may have removed the current NVIDIA credential; it
must be entered again through Settings. Future credential/security/provider smokes must
use isolated profiles and prove the primary profile is unchanged.

### DEC-023: Verified USD authoring and atomic promotion

**Context.** Blender is authoritative for visible geometry, but its exporter alone does
not provide the neutral robotics layers, portable composition evidence, or deterministic
readiness report required by the product.

**Decision.** Blender writes a selected-object geometry layer and source `.blend` into a
project-contained staging area. The pinned OpenUSD worker authors materials, physics,
sensors, robot, environment, and root layers; validates them; inventories SHA-256 values;
and produces matching JSON and Markdown reports. Quick export flattens the same verified
stage to `.usdc`. Nothing reaches the approved destination until exact destination,
overwrite, scene revision, validation run, and plan-hash approval pass. Promotion uses a
temporary sibling that is reopened before promotion, retains a recoverable backup through
final-destination reopen, and rolls back on failure.

**Consequences.** Visual review remains advisory, while Blender validation and OpenUSD
inspection provide deterministic evidence. Canonical packages remain neutral and movable;
Isaac-specific schemas are not a V1 runtime dependency.

### DEC-024: Relocatable pinned OpenUSD runtime

**Context.** A developer virtual environment cannot make packaged export reproducible.
The official `usd-core` 26.5 Windows wheel supports the approved Python 3.13 baseline.

**Decision.** Build a fixed application resource containing Python 3.13.14 plus only the
required `pxr`/`usd-core` distribution. The desktop invokes the fixed worker directly with
argument arrays, no shell or runtime downloads. Packaging verification runs the embedded
runtime's doctor command.

**Consequences.** The desktop package grows materially, but judges do not need a separate
Python/OpenUSD install. Runtime preparation is deterministic and license/notices remain a
release gate.

### DEC-025: Bridge descriptor shutdown and stale-session cleanup

**Context.** Electron's normal quit event did not await asynchronous bridge shutdown, so
expired loopback descriptor files could survive a closed app.

**Decision.** Prevent normal quit until `AppRuntime.shutdown()` completes and remove dead,
expired, or malformed descriptors before issuing a fresh session token. Descriptors stay
current-user-only and every new token remains 256-bit, process/project-bound, loopback-only,
and short-lived.

**Consequences.** Graceful exits revoke the current descriptor deterministically; crash
debris is removed at the next start. Integration tests cover stale cleanup and fresh-token
creation without logging descriptor contents.

### DEC-026: Revision-bound embedded workspace and capability routing

**Context.** The owner required a persistent conversation rail, dominant authoring canvas,
and stacked 3D/activity/export dock. The embedded view and model selector could otherwise
become false sources of scene or capability truth.

**Decision.** Implement the approved workspace in React with Phosphor icons and a direct
Three.js GLB inspector. Blender generates every preview and the app binds it to an exact
scene revision; fresh inspection controls current/stale state and selection linkage.
Provider routing only considers configured, enabled, runtime-probed capability records,
respects budgets and purpose, and falls back explicitly to local execution. Project/global
memory, provider controls, usage, privacy export, diagnostics, and deletion remain in
Settings. Project deletion uses exact-name confirmation and the Windows Recycle Bin.

**Consequences.** The inspector cannot silently diverge from Blender, and the renderer
does not gain filesystem/provider authority. No React rendering wrapper was required;
direct Three.js keeps the preview seam small. Cycle-two content can expand inside the
approved information architecture without a major architecture change.

## Approval Record

The project owner approved the full SimForge Documentation and Architecture Baseline
on 2026-07-18, then explicitly instructed Codex to implement MS1 and MS2. On 2026-07-19
the owner instructed Codex to continue in Goal Mode through the remaining milestones;
the milestone evidence/checkpoint workflow remains mandatory.
