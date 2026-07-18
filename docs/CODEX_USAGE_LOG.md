# Codex and GPT-5.6 Usage Log

## Purpose

Record concrete ways Codex and GPT-5.6 accelerated research, product/architecture decisions, implementation, debugging, testing, and documentation. Do not include prompts, tool output, paths, screenshots, or identifiers that expose secrets or private data. Preserve the `/feedback` Session ID privately outside public source.

## Entries

### 2026-07-18 - Persistent project-memory scaffold

- Phase: Project setup
- Contribution: Codex created the repository operating rules and structured templates for vision, requirements, traceability, tests, research, decisions, architecture, roadmap, progress, licensing, submission, and usage evidence.
- Acceleration: Established durable memory and approval gates before a long build, reducing requirement-loss and uncontrolled implementation risk.
- Evidence: Initial commit `7e1d35e Establish project documentation system`.

### 2026-07-18 - Master brief decomposition and architecture research

- Phase: MS0
- Contribution: Codex read the complete 34-section brief, separated product requirements from implementation choices, researched current primary sources for NVIDIA/Nemotron, OpenAI, Blender, OpenUSD/UsdPhysics, Isaac validation, Electron/Tauri, SQLite, 3D preview, URDF/MJCF, packaging, secret storage, and open-source chat/Blender prior art.
- Important decisions: Electron over Tauri; separate Blender 4.5 LTS extension; hosted NVIDIA capability probing; provider-neutral contracts; neutral OpenUSD sidecar; rule-based validation; split Apache/GPL licensing; generated P0 versus imported P1 versus Isaac V2.
- Acceleration: Compared cross-domain tradeoffs and resolved the risky boundaries before code, while avoiding large planning-time installs.
- Evidence: `docs/RESEARCH.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`.

### 2026-07-18 - Atomic requirements, tests, and two-cycle delivery system

- Phase: MS0
- Contribution: Codex converted the brief into 123 stable requirements, mapped each to a priority, milestone, acceptance test, status, and evidence location, and defined deterministic success/failure/recovery tests plus the two-cycle roadmap.
- Acceleration: Turned a large narrative brief into an auditable delivery ledger and judge-oriented evidence plan without silently dropping future scope.
- Evidence: `docs/PRODUCT_REQUIREMENTS.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/ROADMAP.md`.

## Future Entry Template

### YYYY-MM-DD - Outcome

- Phase/milestone:
- Requirement/test IDs:
- What Codex/GPT-5.6 contributed:
- Important decisions or alternatives:
- Time/risk saved:
- Human review and verification:
- Evidence commit/files/tests:
- Limitations or correction made:

## Submission Reminder

After substantial core functionality works and before fragmenting the primary task, remind the owner to run `/feedback` and preserve the resulting Session ID for the submission form. Do not commit the ID unless the owner explicitly chooses to make it public.
