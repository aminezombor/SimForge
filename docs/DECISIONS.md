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

## Architecture Decision Details

### DEC-004: Electron desktop orchestrator

**Context.** A Windows desktop app must coordinate chat, local projects, model streaming, Blender, long jobs, and packaging. The environment already has Node but no Rust toolchain.

**Options.** Electron/TypeScript; Tauri/Rust; a Blender-native UI.

**Decision.** Electron keeps the primary app in one language and has a direct judge-friendly Windows packaging path. Tauri has a smaller footprint and strong capabilities but adds Rust, a third implementation language, and greater sidecar risk. A Blender-native UI conflicts with the standalone product and provider/project experience.

**Consequences.** Electron's larger bundle is accepted. Renderer isolation, CSP, context isolation, disabled Node integration, sender validation, and fuse/packaging checks are mandatory.

### DEC-006: Thin Blender extension

**Decision.** The app listens on an ephemeral loopback port; the extension connects outbound using a short-lived token. Socket work only queues messages. Blender mutations execute on its main thread. Every mutating request carries an expected scene revision and is rejected if stale.

**Consequences.** The protocol remains auditable and purpose-built. Generic MCP servers may inform research but will not be embedded. Python fallback remains explicitly privileged rather than falsely sandboxed.

### DEC-009: Neutral OpenUSD sidecar

**Decision.** Blender exports visual layers. A fixed, non-shell Python sidecar authors root/physics/sensor composition and reopens the package through `pxr`. Package convention is Z-up and meters-per-unit `1.0`, with relative references and a machine manifest.

**Consequences.** This avoids an Isaac Sim dependency and works around Blender USD composition limitations. The sidecar and packaged Python/OpenUSD compatibility must pass an MS1 spike before application growth.

### DEC-012: Split licenses

**Decision.** Desktop source is Apache-2.0. Code loaded into Blender is GPL-3.0-or-later. Each distributable carries its license; the root README and notices explain the boundary. Assets retain their source licenses.

**Consequences.** Do not mix Blender-dependent GPL source into the Apache desktop package. Revisit with legal counsel before any proprietary/commercial distribution; this is an engineering compliance decision, not legal advice.

## Approval Record

The project owner approved the full SimForge Documentation and Architecture Baseline, including these decisions, on 2026-07-18. A separate instruction is still required to start application implementation.
