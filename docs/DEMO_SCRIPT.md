# SimForge Demo, Pitch, and Capture Script

## Recording Target

Target **2:40**; 2:50 is the hard editing ceiling. Record at 1920x1080, 30 fps, with
clear narration and no music required. Keep text large enough to read. Never show keys,
private paths, notifications, browser accounts, or a `/feedback` Session ID.

## Final 2:40 Video Script

| Time | Picture | Narration | Judge signal |
| --- | --- | --- | --- |
| 0:00-0:12 | Fast Blender, USD, and Isaac cuts; then the clean SimForge chat. | “Getting a robot from an idea to a simulation-ready asset still means stitching together modeling, scripts, physics metadata, USD, and simulation.” | Specific real problem and audience. |
| 0:12-0:24 | SimForge rail: Plan, Build, Export, Simulate. | “SimForge is a Windows desktop tool for robotics creators. It makes that journey conversational, but keeps Blender as visual truth and deterministic checks as engineering evidence.” | Clear product promise. |
| 0:24-0:42 | New chat. Enter: `prepare for me in blender a wheeled robot with a gripper hand`. Show the plan and Guided approval. | “I start with a goal. SimForge proposes a bounded plan. Guided authority shows the scope and waits for me; planning alone cannot mutate Blender.” | Coherent safety-centered design. |
| 0:42-1:04 | Approved build creates the collection, wheeled base, arm, gripper, sensors, and warehouse in a previously blank Blender scene. Show checkpoint/revision. | “After approval, structured operations create the robot and workcell in the real Blender scene. The application records a checkpoint and a scene revision, so this work is visible and recoverable.” | Real non-trivial implementation. |
| 1:04-1:24 | Validation/failure card, retained evidence, approval, corrected Blender scene. | “A deterministic stability check finds a real problem. AI can explain the evidence, but it cannot declare success. I approve a bounded correction, then SimForge rechecks it.” | Differentiated trust loop. |
| 1:24-1:43 | Chat export request, explicit export approval, USD package tree, 12 passing reopen checks. | “When I request export, SimForge writes physics and composition layers into a portable USD package, reopens it with OpenUSD, resolves references, and produces a report.” | Evidence beyond a generated mesh. |
| 1:43-2:05 | Isaac failed result, proposal, approval, corrected export, passed parent/child rerun and native Isaac view. | “The same package runs in optional Isaac Sim. The first experiment fails, I approve the Blender correction, and the linked rerun passes the waypoint task.” | Measurable before/after outcome. |
| 2:05-2:30 | Short montage: architecture diagram/code, test output, release page, final app/Blender/Isaac frame. | Use the exact Codex and GPT-5.6 narration below. | Explicit Build Week contribution. |
| 2:30-2:40 | Final product frame plus repository/release URL overlay. | “SimForge makes physical-AI authoring faster without making the engineering process invisible. Next, we will expand the same human-controlled evidence loop toward broader formats and optimization workflows.” | Impact plus credible roadmap. |

## Codex and GPT-5.6 Narration (25 seconds)

“Codex with GPT-5.6 was our engineering partner, not a substitute for evidence. It turned
the brief into 133 traceable requirements, helped evaluate the architecture and licenses,
implemented and tested the desktop, Blender, OpenUSD, and Isaac boundaries, and kept the
release documentation synchronized. SimForge also includes an optional OpenAI Responses
provider with runtime model discovery; this recorded workflow uses the configured
NVIDIA/Nemotron route.”

## Capture and Editing Notes

1. Use the already-recorded blank-Blender run as the main source. Tighten waiting periods;
   never speed up a state change so far that approval or evidence becomes unreadable.
2. If a live tool is slow, use sanitized retained screenshots for the validator, USD reopen,
   and Isaac before/after. Label them as recorded evidence, not live interaction.
3. Include one tight 4-6 second Blender shot with the SimForge collection appearing. This
   proves authoring occurred in Blender before export.
4. Use audio narration throughout. Add accurate captions, then watch once logged out and
   once on a phone-sized player to check readability.
5. The public YouTube cut must stay below three minutes and use no copyrighted music or
   unlicensed footage.

## Pitch Material

### 12-Second Elevator Pitch

“SimForge turns a robotics idea into visible Blender work, verified USD, and optional Isaac
feedback—while deterministic checks, checkpoints, and human approvals keep the creator in
control.”

### 45-Second Spoken Pitch

“Robotics creators lose time moving between Blender, scripts, physics configuration, USD,
and simulation, and they often cannot prove what changed between those tools. SimForge is a
desktop authoring loop that turns a short goal into a reviewable plan, real Blender work,
deterministic validation, an approved correction, and a USD package that is reopened before
reporting readiness. In our working demo, a wheeled warehouse manipulator is built in
Blender, a stability issue is detected, a user approves the correction, and the corrected
package passes a linked Isaac Sim rerun. The core idea is not autonomous text-to-3D; it is
making physical-AI authoring faster while preserving evidence and human control.”

### Five Slide Titles

1. **The robotics-authoring handoff problem** — model, script, physics, USD, simulation.
2. **One conversational evidence loop** — Plan → Build → Validate → Export → Simulate.
3. **Trust by construction** — Blender truth, deterministic rules, approvals, checkpoints.
4. **Working proof** — warehouse robot, failed check, approved repair, verified USD, Isaac pass.
5. **Built with Codex + GPT-5.6** — traceability, implementation, tests, release; broader optimization is the roadmap.

## Final Video Checklist

- [ ] Duration under 3:00, preferably 2:35-2:45.
- [ ] Clear voice-over and accurate English captions.
- [ ] Prompt, plan, approval, live Blender build, finding, correction, USD checks, and Isaac pass are legible.
- [ ] NVIDIA/Nemotron demo route and optional GPT-5.6/OpenAI integration are described truthfully.
- [ ] Codex contribution is concrete: requirements, decisions, implementation, testing, packaging.
- [ ] No secret, private path, browser account, notification, or `/feedback` ID appears.
- [ ] Public/unlisted YouTube playback works while logged out.
