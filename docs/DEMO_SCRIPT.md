# SimForge Demo, Pitch, and Capture Script

## Recording Target

Target a 2:45 final cut; 2:55 is the absolute scripted ceiling. Record 1920×1080 at
30 fps with cursor emphasis, 125–150% UI zoom where needed, and clean narration. Never
show an API key, private path, notification, browser account, or `/feedback` ID.

## Shot-by-Shot Video

| Time | Picture and exact action | Narration | On-screen label / fallback |
| ---- | ------------------------ | --------- | -------------------------- |
| 0:00–0:15 | Fast cuts: Blender scene, scripts, physics metadata, USD layers. | “Preparing a robot for simulation means stitching together modeling, scripting, physics checks, and USD packaging—then wondering whether the result is actually trustworthy.” | **Robotics authoring is disconnected.** Use stills if live apps lag. |
| 0:15–0:30 | Open the polished three-column SimForge workspace; pan from chats to authoring to viewport/evidence. | “SimForge makes that workflow conversational while Blender stays the source of visual truth and deterministic checks stay the source of engineering evidence.” | **Goal → evidence → verified asset** |
| 0:30–0:50 | Show NVIDIA/Nemotron route, Plan Mode, 12/11/3/15 scope, Guided authority, then approve. | “The planning model is discovered and capability-probed at runtime. Plan Mode cannot mutate Blender. Guided authority shows me the exact scope, so I approve before any build tool becomes available.” | **NVIDIA-routed · Plan is read-only · Guided**. Fallback: sanitized discovery evidence plus local fixture, clearly labeled. |
| 0:50–1:20 | Side-by-side SimForge and Blender during warehouse build; point to revision, changed entities, checkpoint, and preview. | “Structured operations build the mobile base, arm, gripper, sensors, and warehouse directly in Blender. SimForge refreshes scene truth, creates a recoverable checkpoint, and records every action.” | **Blender live · scene revision · checkpoint retained**. Speed up only dead time. |
| 1:20–1:45 | Show displaced gripper, `ROB-LINK-POSE-001`, exact evidence, approval, corrected render, passing rerun. | “Here is a real injected defect. A deterministic rule identifies the wrong link pose. Visual review supports the finding, but does not replace it. The structural correction waits for approval, checkpoints, and revalidates.” | **Detected → approved → corrected → rechecked**. Fallback: retained before/after PNGs and JSON. |
| 1:45–2:05 | Export panel, destination/overwrite gate, package tree, manifest, OpenUSD reopen/pass. | “Export is never silent. SimForge creates a modular, portable USD package, reopens it with OpenUSD, resolves relative references, verifies robotics metadata, and writes machine and human reports.” | **12 deterministic USD checks · relocated reopen passed** |
| 2:05–2:25 | Simulation tab: failed Isaac frame/metrics, advisory analysis, approved Blender correction, passing child rerun. | “The same package runs in Isaac Sim. A stability check fails, AI explains the retained numbers, and I approve a bounded Blender correction. The child rerun passes and stays linked to the failed experiment.” | **Isaac FAILED → approved correction → PASSED**. Fallback: `docs/evidence/ms11b/` frames and lineage JSON. |
| 2:25–2:55 | Montage: Codex task, tests, architecture, release artifacts, final product frame. | Use the 30-second segment below. | **Built with Codex + GPT‑5.6 · 125 requirements · 49+ tests · real Blender/OpenUSD/Isaac evidence** |

## 30-Second Codex/GPT-5.6 Segment

“Codex with GPT‑5.6 was my engineering partner across the whole build. It converted my
master brief into 125 traceable requirements, compared architectures, implemented the
Electron, Blender, OpenUSD, and Isaac seams, and drove real acceptance tests—not just
model self-review. It also caught security, packaging, reconnect, and UX problems, then
kept decisions, evidence, and release documentation synchronized. That let one builder
deliver a trustworthy robotics-authoring loop in hackathon time.”

To compress the owner’s existing one-minute clip: keep one sentence each for requirements,
implementation, real-tool testing, and impact. Remove tool-by-tool narration, repeated
“Codex helped” phrases, terminal footage, and any claim that GPT judgment itself proves
correctness. Use four 6–7 second visuals with hard cuts.

## Capture Order

1. Record the clean workspace and model/authority settings.
2. Record the build once; capture a separate tight Blender angle for the checkpoint moment.
3. Record deterministic defect and corrected state as separate clips.
4. Record export/reopen and report scrolling.
5. Record Isaac before/after; retain the fixed evidence images as fallback.
6. Record voice-over last, then tighten pauses to reach 2:45–2:55.

## Pitch-Slide Ideas (Text Only)

1. **The disconnected problem** — Robot preparation crosses Blender, scripts, physics,
   format conversion, USD, and simulation. Each handoff loses context and trust.
2. **The SimForge loop** — Conversational goal → inspected plan → visible Blender work →
   deterministic validation → approved correction → verified USD → simulation feedback.
3. **Trust by construction** — Blender truth, withheld Plan tools, revision-bound approvals,
   permanent human gates, checkpoints, machine evidence, and no model-only pass claims.
4. **Working proof** — 12-link warehouse manipulator, deliberate defect caught/corrected,
   relocated USD reopen, and Isaac failed-to-passing parent/child rerun.
5. **Why it matters** — Faster access to physical-AI authoring for experts and newcomers;
   provider-neutral/local-first differentiation; Codex/GPT‑5.6 acceleration; next: broader
   import fidelity, Linux, richer validation, and larger Isaac experiments.

## Edit and Release Checklist

- Final duration is under 3:00; target 2:45 and never exceed 2:55.
- Audio is clear, normalized, and present throughout; no copyrighted music is required.
- UI, Blender object, validation rule, USD pass, and Isaac before/after are legible.
- NVIDIA live inference versus deterministic fallback is labeled truthfully.
- No keys, tokens, private feedback ID, private path, email, notification, or unrelated app appears.
- Captions spell **SimForge**, **Blender 4.5 LTS**, **OpenUSD**, **NVIDIA Nemotron**,
  **Isaac Sim**, **Codex**, and **GPT‑5.6** consistently.
- Public YouTube playback works logged out at 1080p; duration and audio are rechecked.
- Save the final URL and recording commit in the private submission workflow, not in evidence containing secrets.
