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

### 2026-07-18 - MS1 risky-seam implementation and diagnosis

- Phase/milestone: MS1
- Requirement/test IDs: REQ-AI-001 through REQ-AI-006, REQ-DATA-001/002,
  REQ-BLENDER-001/002/005/008, REQ-SECURITY-001 through REQ-SECURITY-006;
  AT-003 through AT-006 and AT-012
- Contribution: Codex implemented provider-neutral NVIDIA/OpenAI streaming contracts,
  protected credentials, portable SQLite, the authenticated Blender bridge/extension,
  the local AI-to-structured-tool slice, packaged Electron smoke tests, and the pinned
  OpenUSD author/reopen worker.
- Important corrections: diagnosed pnpm 11 configuration migration, Forge output-name
  collision, CommonJS/package-type startup hang, a wrong preload output path, and the
  Electron 43 ninth-fuse mismatch in Forge's older fuse peer range. Codex moved fuse
  application to the current official utility, required all fuse values, and inspected
  the produced binary. Each failing package/smoke result remained a defect until the
  packaged executable exited cleanly with the reviewed narrow API and fuse policy.
- Acceleration: bounded the highest-risk native/process/protocol seams before robot or
  validation work and converted each into a repeatable automated fixture.
- Human review: owner approved the architecture, instructed Codex to continue through
  MS1/MS2, and configured the NVIDIA key only through protected app settings.
- Evidence: `docs/evidence/MS1_MS2_VERIFICATION.md`, `tests/`, packaged smoke results.

### 2026-07-18 - MS2 policy, recovery, and adversarial verification

- Phase/milestone: MS2
- Requirement/test IDs: REQ-MODE-001 through REQ-MODE-010,
  REQ-BLENDER-003/004/006/007/009/010, REQ-SECURITY-007; AT-008 through AT-015, AT-031
- Contribution: Codex implemented deterministic mode/tool policy, revision-bound exact
  approvals, persistent goal lifecycles, concurrent local chat, manual-edit diffs,
  stale-action denial, crash/reconnect recovery, generated-script archive, and controlled
  Python fallback.
- Adversarial work: forged/oversized bridge frames, prompt-injected unavailable tools,
  stale approvals, project-path traversal, renderer privilege/navigation attempts,
  secret-like chat/script content, and approved script failure all fail closed.
- Acceleration: used a hash-verified portable Blender 4.5.11 instance to turn protocol and
  `bpy` assumptions into a 2-3 second real integration test instead of manual anecdotes.
- Evidence: `tests/live/blender-live.test.ts`, policy/security tests, packaged renderer and
  credential smoke evidence.

### 2026-07-18 - Live NVIDIA capability closure

- Phase/milestone: MS1/MS2 closure
- Requirement/test IDs: REQ-AI-001 through REQ-AI-005; AT-003, AT-004, AT-039
- Contribution: Codex ran packaged runtime discovery and noticed the first live record
  left tool support `unknown`. It strengthened the probe to offer a non-mutating no-op,
  observe and discard the call without executing it, replaced model-name reasoning
  inference with an explicit control request, and distinguished observed support from
  unknown capabilities.
- Result: 119 models discovered; intended Nemotron 3 Ultra found; streamed text and tool
  call passed; text-only classification retained; structured output stayed honestly
  unknown. No credential or raw model output entered evidence.
- Acceleration: converted a documentation-level capability assumption into direct,
  reproducible endpoint evidence before allowing the milestone to close.
- Evidence: `docs/evidence/NVIDIA_PROVIDER_ACCEPTANCE.json`, provider unit tests, packaged
  `--provider-acceptance-test` result.

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
