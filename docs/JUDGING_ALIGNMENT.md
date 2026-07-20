# SimForge Judging Alignment

## Submission Thesis

**SimForge is a human-controlled robotics-authoring tool that turns a short goal into
visible Blender work, deterministic evidence, a verified USD package, and an optional
Isaac Sim feedback loop.** It is designed for robotics creators who need speed without
losing scene truth, recovery, or approval over consequential actions.

Choose the **Developer Tools** category. Do not position SimForge as a finished
autonomous topology-optimization system. That is a future direction; the shipped product
is the evidence-backed authoring loop demonstrated below.

## What Judges Should See

| Criterion | SimForge proof | One sentence to say |
| --- | --- | --- |
| Technological implementation | Packaged Windows app; authenticated Blender bridge; provider-neutral OpenAI Responses adapter and NVIDIA route; deterministic validators; OpenUSD reopen; Isaac parent/child rerun; 57 passing default tests. | “This is not a mockup: a real Blender scene, USD package, and Isaac experiment produce the evidence shown here.” |
| Design | A fresh chat starts cleanly and advances through Plan, Build, Export, and Simulate; approval cards, checkpoints, and evidence explain what will happen. | “The interface makes powerful robotics work understandable without making the user surrender control.” |
| Potential impact | Robotics creators currently hand off between modeling, scripts, physics metadata, USD, and simulation. | “SimForge reduces the fragile handoffs between creative authoring and simulation-ready engineering evidence.” |
| Quality of idea | Blender remains visual truth; deterministic checks and explicit approvals prevent an LLM from declaring its own work correct. | “The differentiator is not text-to-3D alone; it is a conversational loop that can show, check, recover, and prove what changed.” |

## Truthful GPT-5.6 and Codex Story

Codex with GPT-5.6 accelerated the build itself: requirements traceability, architecture
trade-offs, implementation, real-tool acceptance testing, packaging, security fixes, and
release documentation. See `CODEX_USAGE_LOG.md` for concrete evidence.

The product also contains an **optional OpenAI Responses API provider** with runtime model
discovery and provider-neutral event normalization. A compatible GPT-5.6 model can be
selected when the owner configures OpenAI credentials. The recorded working path uses
NVIDIA/Nemotron because that is the configured live demo provider. Say this plainly; do
not imply that the recorded robot was driven by a live GPT-5.6 request if it was not.

## Message Guardrails

- Say “deterministic evidence,” “reopened USD,” and “human-approved correction,” not
  “the AI proved the robot is correct.”
- Say “optional Isaac Sim feedback loop” rather than claiming Isaac is bundled or required.
- Say “OpenUSD physics/composition layers” rather than claiming unspecified latest Pixar
  or NVIDIA design/material packages.
- Say “long-term human-controlled optimization direction” only in the closing roadmap.
- Never show an API key, private filesystem path, private browser account, notification,
  or `/feedback` Session ID.

## Submission Assets Checklist

1. The video proves a real problem, working flow, Codex/GPT-5.6 role, and specific
   before/after outcome in under three minutes.
2. Devpost copy links the public repository and release, states Windows 11 x64 support,
   names Blender as a separate install, and discloses the unsigned installer/portable ZIP.
3. The repository README gives a short judge path and `docs/OWNER_JUDGE_TEST.md` gives
   expected states and troubleshooting.
4. The owner enters legal identity, country, video URL, and private `/feedback` Session
   ID directly in Devpost. None belongs in the repository.
