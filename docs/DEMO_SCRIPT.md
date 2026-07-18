# Demo Script

## Objective

Show one deterministic, visually legible, end-to-end warehouse mobile-manipulator workflow in less than three minutes. Prefer a rehearsed sample project and prepared prompt over an unpredictable live model response. Never fake validation or export evidence; use a stable cached/pre-approved plan only if the live provider becomes unavailable, and disclose that fallback.

## Timed Storyboard

### 0:00-0:20 - Problem

**Visual:** Brief montage of Blender, scripts, physics metadata, and USD files.

**Narration:** “Preparing a robot for simulation usually means switching between modeling, scripting, physics checks, and USD packaging. It is slow, specialized, and hard to verify.”

### 0:20-0:40 - Goal

**Visual:** Open the sample project in SimForge; Environment Doctor and Blender connection are already green. Enter the prepared warehouse mobile-manipulator goal.

**Narration:** “SimForge makes that workflow conversational while Blender remains the source of truth. I’ll ask for a mobile manipulator in a small warehouse scene.”

### 0:40-1:00 - Plan and Approval

**Visual:** Show the concise task plan, validation criteria, risk gates, selected NVIDIA model, and plan approval.

**Narration:** “The AI inspects the actual scene, proposes testable stages, explains the important choices, and cannot build while it is in Plan Mode. I approve this plan before mutation tools become available.”

### 1:00-1:40 - Visible Blender Work

**Visual:** Side-by-side SimForge activity and Blender. Show structured creation/modification, scene revision, changed objects, and checkpoint.

**Narration:** “Build Mode uses structured Blender operations. The base, arm, gripper, sensor, and warehouse assets are visible in Blender, while SimForge records exactly what changed and creates a recovery checkpoint.”

### 1:40-2:10 - Intelligent Inspection

**Visual:** Run validation. Highlight one pre-rehearsed real defect, preferably missing mass, bad ground contact, or invalid collision/hierarchy. Show rule ID and deterministic evidence plus a materialized review image.

**Narration:** “SimForge refreshes the scene before checking it. Deterministic rules catch this real problem; the rendered review is supporting evidence, not a substitute for the structural check.”

### 2:10-2:30 - Safe Correction

**Visual:** Show automatic eligibility or structural approval, apply, rerun validation, and display undo/checkpoint.

**Narration:** “Only clear, local, reversible fixes run automatically. Structural or behavioral changes pause for approval. The correction is logged, undoable, and verified again.”

### 2:30-2:50 - Verified Export

**Visual:** Approve destination/package, export, show modular file tree, OpenUSD reopen result, validation JSON, and readiness report.

**Narration:** “Export is never silent. SimForge builds a portable modular USD package, reopens it, resolves its references, verifies robotics metadata, and produces both machine-readable results and a readiness report.”

### 2:50-3:00 - Codex and Roadmap

**Visual:** Codex usage/decision highlights and one V2 Isaac loop diagram.

**Narration:** “Codex with GPT-5.6 accelerated the architecture, implementation, testing, and documentation. Next, the same package and approval system will close the loop with Isaac Sim.”

## Rehearsal Controls

- Keep the final cut below 2:55 to leave platform encoding margin.
- Use one known-good project and one deliberate deterministic defect.
- Prewarm Blender and provider connection; keep a provider-unavailable fallback that does not misrepresent live inference.
- Record at a resolution where activity, finding, and report text remain legible.
- Use only redistributable assets and sanitized paths, keys, project names, logs, and notifications.
- Do not show the private `/feedback` session ID.
- Rehearse recovery from provider failure, Blender disconnect, and failed export validation even if those paths are not in the final cut.

## Evidence to Capture

- Final video URL and duration
- Script version and commit
- Project/export manifest hashes
- Acceptance-test run used in the recording
- Provider/model and whether any deterministic cached plan fallback was used
- Known limitations visible or narrated
