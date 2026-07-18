# SimForge

SimForge is a planned Windows-first, local-first desktop developer tool for creating and preparing robotics assets through conversational AI and a real Blender scene. Its target loop is:

> Idea -> approved plan -> Blender creation or modification -> live scene inspection -> deterministic validation -> safe correction -> verified robotics-ready USD package.

The hackathon demonstration will build a warehouse mobile manipulator, catch a real geometry or robotics-readiness defect, apply a reversible correction, and export a reopened, verified USD package with a readiness report.

## Current Status

**MS0: documentation and architecture baseline.** No application code or UI implementation exists yet. The architecture is approved, but work must stop after MS0 until the owner explicitly starts MS1.

## Planned Architecture

- Electron, React, and TypeScript desktop application
- Thin GPL-3.0-or-later Blender 4.5 LTS extension
- NVIDIA-first, provider-neutral AI layer with optional OpenAI support
- Local SQLite project storage and Windows DPAPI-backed secret storage
- Bundled Python/OpenUSD sidecar for USD composition and verification
- Blender-authoritative scene state with structured operations, revisions, checkpoints, and approvals

See [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), and [Roadmap](docs/ROADMAP.md) for the approved design.

## Repository Map

- `AGENTS.md` - permanent contributor and Codex operating rules
- `docs/PRODUCT_VISION.md` - users, problem, experience, and product principles
- `docs/PRODUCT_REQUIREMENTS.md` - confirmed, stable product requirements
- `docs/REQUIREMENTS_TRACEABILITY.md` - requirement-to-milestone/test/evidence mapping
- `docs/ACCEPTANCE_TESTS.md` - deterministic acceptance procedures
- `docs/ARCHITECTURE.md` - approved system design and interfaces
- `docs/DECISIONS.md` - consequential product and technical decisions
- `docs/RESEARCH.md` - primary-source ecosystem research
- `docs/HACKATHON_SCOPE.md` and `docs/ROADMAP.md` - priority tiers and two-cycle delivery plan
- `docs/SECURITY.md` and `docs/PRIVACY.md` - threat model and data-handling policy
- `docs/PROGRESS.md` - current state, verification, and next gate
- `docs/HACKATHON_SUBMISSION_CHECKLIST.md` and `docs/DEMO_SCRIPT.md` - submission readiness

## Build and Test Commands

Commands will be added in MS1 after the package manifests exist. Planned commands are `pnpm dev`, `pnpm test`, `pnpm test:integration`, `pnpm lint`, and `pnpm package`. Do not present them as working before MS1 evidence exists.

## Supported Platform

The hackathon baseline is Windows 11 x64 with a separately installed Blender 4.5 LTS. Isaac Sim is not required for V1. Future Linux and Isaac Sim work is preserved in the roadmap.

## Licensing

The standalone desktop application will use Apache-2.0. The Blender extension will use GPL-3.0-or-later. Third-party assets retain their own licenses and must be recorded in project metadata and notices. License files will be added with the first distributable source packages.

## Secrets

Never place API keys in source, project databases, logs, screenshots, commands, sample files, or submission materials. The implemented app will store provider credentials through Windows-protected local storage.
