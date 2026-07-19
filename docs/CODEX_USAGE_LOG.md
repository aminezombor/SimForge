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

### 2026-07-18 - One-click owner test environment

- Phase/milestone: MS1/MS2 owner acceptance preparation
- Requirement/test IDs: REQ-BLENDER-001, REQ-BLENDER-007, REQ-PLATFORM-002 through
  REQ-PLATFORM-005; AT-012 through AT-014 and partial AT-033
- Contribution: Codex converted the packaged checkpoint into a current-user desktop
  installation that launches SimForge and a hash-verified Blender 4.5.11 LTS together,
  installs/enables the bridge extension, auto-connects locally, and shows no terminal.
- Important corrections: direct Blender validation exposed an overlong manifest field
  and invalid extension ZIP root; both were corrected. The authenticated descriptor now
  renews only while disconnected near expiry, retaining a short lifetime while making
  repeat shortcut launches reliable. The launcher selects descriptors only from the
  installed app process and preserves unrelated desktop shortcuts.
- Acceleration: automated the fragile multi-process setup and turned owner testing into
  documented clicks with exact outcomes instead of manual environment reconstruction.
- Evidence: `scripts/install-local-test.ps1`, `scripts/launch-local-test.ps1`,
  `docs/MS1_MS2_MANUAL_TEST.md`, bridge renewal integration test, installed connection
  smoke. Release installer/signing/clean-account coverage remains MS9.

### 2026-07-19 - Owner UX feedback converted into product and defect evidence

- Phase/milestone: MS1/MS2 owner acceptance preparation; MS3 not started
- Requirement/test IDs: REQ-UX-001 through REQ-UX-009, REQ-VIEW-001 through
  REQ-VIEW-004, REQ-BLENDER-007, REQ-PLATFORM-002; AT-008, AT-014, AT-018, AT-033
- Contribution: Codex audited three annotated owner screenshots, distinguished the
  foundation harness from the product UI, and converted the proposed layout into a
  persistent three-column workspace contract without changing milestone priorities.
- Important corrections: activity timestamps revealed that the bridge dropped every
  authenticated idle session at exactly 30 seconds because a handshake timeout remained
  active. Codex disabled it after authentication, added a regression test and extension
  auto-reconnect, replaced console-producing launch paths with WScript and Blender's GUI
  launcher, and added renderer state polling so connection status cannot remain stale.
- Acceleration: owner feedback became a reproducible defect diagnosis, verified repair,
  and future UI acceptance contract in one checkpoint rather than being lost as informal
  visual feedback.
- Evidence: `docs/UX_AUDIT_2026-07-19.md`, `docs/UX_WORKSPACE.md`, bridge tests, packaged
  install smoke, and owner-provided screenshots. Exact colors/typography remain for MS6
  visual exploration and reference-versus-build QA.

### 2026-07-19 - MS3 deterministic evidence and recovery closure

- Phase/milestone: MS3
- Requirement/test IDs: REQ-VALIDATION-001 through REQ-VALIDATION-005,
  REQ-FIX-001 through REQ-FIX-004, REQ-HISTORY-001/002; AT-021, AT-024,
  AT-025, AT-026
- Contribution: Codex translated broad geometry-quality language into 18 stable rules,
  versioned snapshot/finding/fix contracts, and repeatable defective/repaired fixtures.
  It kept conservative overlap and support-plane assumptions visible instead of
  presenting them as simulation proof.
- Important decisions: safe grounding is eligible only with exact revision/object/
  location preconditions and a typed inverse; scale application and full restore remain
  structural exact-approved actions. Checkpoints combine Blender, a consistent SQLite
  backup, portable files, and SHA-256 inventory.
- Acceleration: one 4.79-second real Blender acceptance run exercised the entire earlier
  bridge suite plus fresh geometry evidence, safe fix, deterministic revalidation,
  inverse undo, reconnect, and full approved restore--turning several risky Blender/API
  assumptions into repeatable evidence.
- Human review: the owner can repeat the visible sequence through the updated desktop
  shortcut using `docs/MS3_MANUAL_TEST.md`.
- Evidence: `tests/unit/validation.test.ts`, `tests/live/blender-live.test.ts`,
  `docs/evidence/MS3_VERIFICATION.md`, packaged renderer security smoke.
- Limitations: robotics and rendered visual evidence begin MS4; USD evidence begins
  MS5. No new external dependency was added; mesh inspection uses Blender's bundled
  `bmesh` API.

### 2026-07-19 - MS4 robotics authoring and review closure

- Phase/milestone: MS4 complete
- Requirement/test IDs: `REQ-VALIDATION-006` through `REQ-VALIDATION-010`, `AT-016`,
  `AT-022`, `AT-023`
- What Codex/GPT-5.6 contributed: translated the primitive-robot outcome into a versioned,
  general `RobotGraph`; structured Blender operations; deterministic robotics, physics,
  hierarchy, sensor, and contact rules; narrow approval policy; and integrity-checked
  materialized review evidence.
- Important decisions: physical values retain explicit source/assumption metadata;
  visual review stays advisory; generic object relocation cannot bypass validation/history
  safety policy; scene truth and approval remain revision-bound.
- Time/risk saved: one live Blender sequence exercised graph creation, actual object
  counts, a deliberately raised wheel, deterministic detection, exact-approved correction,
  revalidation, checkpoint creation, render production, and stored-image integrity.
- Human review and verification: typecheck, lint, full 28-test verification, two real
  Blender tests, packaging/fuse/security/credential/desktop-launch smoke, and secret scan
  pass. Human image inspection rejected a blank sensor view and then a wheel-focused
  composition before accepting the final mounted-sensor evidence.
- Evidence: `docs/evidence/MS4_VERIFICATION.md` and
  `docs/evidence/ms4-review/`.
- Limitations or correction made: smoke isolation review found that the app overrode
  Chromium's test user-data directory, so credential smoke could touch the normal profile.
  Codex corrected path selection and hidden-window lifecycle, proved the primary DB hash
  unchanged, and recorded that the NVIDIA key may need re-entry. Exported hierarchy and
  imported integrity remain correctly assigned to MS5/MS8.

### 2026-07-19 - MS5 verified USD export closure

- Phase/milestone: MS5 complete; cycle one complete
- Requirement/test IDs: `REQ-VALIDATION-011/012`, `REQ-USD-001` through
  `REQ-USD-006`, `AT-028` through `AT-030`
- What Codex/GPT-5.6 contributed: converted the approved neutral export architecture into
  selected Blender geometry/source capture, JSON-driven OpenUSD composition, deterministic
  schema/reference/hash inspection, quick flattening, and atomic approved promotion.
- Important decisions: exact export scope binds destination, overwrite, final-package
  intent, validation and revision; visual review remains advisory; fixed OpenUSD code runs
  from a relocatable packaged Python/usd-core resource without shell or runtime download.
- Time/risk saved: the real Blender/OpenUSD loop caught Blender's enum API detail, USD
  custom-data typing, and duplicate visual/physics link identifiers before packaging.
- Human review and verification: strict tests, real Blender, deep relocated reopen,
  JSON/Markdown agreement, packaged runtime doctor, fuses, isolated security/credential
  smoke, and a current one-click installation pass.
- Evidence: `docs/evidence/MS5_VERIFICATION.md` and `docs/evidence/ms5-usd/`.
- Limitations or correction made: a diagnostic mistake displayed one ephemeral loopback
  descriptor in transient tool output. Codex stopped the session immediately, traced stale
  files to non-awaited Electron shutdown, and added graceful revocation/startup cleanup and
  regression coverage without retaining the token. Signing and clean-account release work
  remain MS9.

### 2026-07-19 - MS6 embedded workspace and privacy closure

- Phase/milestone: MS6 complete; cycle two workspace foundation complete
- Requirement/test IDs: `REQ-AI-007/008/010`, `REQ-UX-003` through `REQ-UX-009`,
  `REQ-DATA-005`, `REQ-VIEW-001` through `REQ-VIEW-004`, `REQ-HISTORY-003/004`,
  `REQ-SECURITY-003`; `AT-007`, `AT-018`, `AT-027`, `AT-032`
- What Codex/GPT-5.6 contributed: converted the owner's annotated block layout into a
  responsive production workspace, then connected conversations, memory, model routing,
  Blender-derived GLB truth, selection, comparisons, versions, activity, and privacy to
  the existing safe main-process contracts.
- Important decisions: Blender stays authoritative; previews and approvals bind exact
  revisions; routing requires observed capability/configuration; compaction never deletes
  source messages; project/global data remain separate; default deletion uses Recycle Bin.
- Time/risk saved: side-by-side visual QA found and repaired dock proportion/export
  visibility issues; automated real-Blender testing found stale selection behavior before
  release; packaged privacy smoke proves data-scope claims instead of relying on copy.
- Human review and verification: `pnpm verify`, real Blender preview/selection/review
  acceptance, package build, Electron fuse read, packaged renderer/credential/privacy
  smoke, 1280/980/760 browser interactions, zero console warnings/errors, and final
  reference comparison pass.
- Evidence: `docs/evidence/MS6_VERIFICATION.md`, `design-qa.md`, and `artifacts/ms6/`.
- Limitations or correction made: a fresh QA server started without the repository's Vite
  renderer config and produced an invalid unstyled capture; it was rejected and recaptured
  through the production renderer config. Signing and clean-account release remain MS9.

### 2026-07-19 - MS7 warehouse mobile-manipulator closure

- Phase/milestone: MS7 complete; generated cycle-two path stable
- Requirement/test IDs: `REQ-PROD-004/005`, `REQ-VALIDATION-008/009`, `AT-017`,
  `AT-022`, `AT-023`, `AT-029`, `AT-039`
- What Codex/GPT-5.6 contributed: extended the provider-neutral authoring model with a
  reusable environment contract, atomic Blender assembly operation, deterministic
  environment rules, warehouse sample, complete manipulator, review framing, and real
  environment USD composition.
- Important decisions: environment content uses general schema/contracts rather than a
  one-off Python script; robot and environment creation share one exact approval and
  rollback boundary; OpenUSD environment identity is reopened deterministically.
- Time/risk saved: one ten-second live Blender test built 58 stable scene entities,
  injected/caught/corrected a visible gripper defect, rendered before/after/overview,
  generated a GLB, exported robot plus environment, moved the package, and reopened it.
- Human review and verification: `pnpm verify` (40 passing), TypeScript, ESLint, secret
  scan, Blender 4.5.11 acceptance, image inspection, 12 USD checks, package/extension
  build, isolated packaged smoke, and nine-fuse inspection pass.
- Evidence: `docs/evidence/MS7_VERIFICATION.md` and `docs/evidence/ms7/`.
- Limitations or correction made: a first packaged-smoke shell invocation did not wait
  for the Windows GUI process; the harness was rerun with a hidden waited process. No app
  failure or product-data change occurred. Imported-asset integrity remains MS8.

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
