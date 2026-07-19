# Product Vision

## Document Status

- Status: Approved baseline
- Product: SimForge
- Owner: Project owner
- Last updated: 2026-07-18
- Source: Complete master build brief and approved MS0 plan

## Vision

SimForge is a standalone, local-first desktop application that lets people create and prepare robotics assets and engineering environments by collaborating with AI in a real Blender scene. It replaces a disconnected workflow of manual modeling, scripts, physics checks, and USD packaging with one transparent and reversible loop:

> Idea -> conversational plan -> Blender creation or modification -> intelligent scene inspection -> deterministic validation -> safe correction -> robotics-ready USD export.

## Problem

Preparing a simulation-ready robot requires Blender expertise, scripting, kinematics and physics judgment, format conversion, USD knowledge, and repeated checks across disconnected tools. AI automation can accelerate that work, but opaque actions, stale scene context, fabricated validation, unsafe code execution, and irreversible changes make naive agents unsuitable for engineering work.

## Users

The primary user is a Windows-based product or engineering creator who understands the desired physical system but may not be a Blender or software expert. Secondary users include robotics developers, simulation engineers, physical-AI researchers, technical artists, educators, students, and non-experts preparing assets for NVIDIA Omniverse or Isaac Sim.

## Value Proposition

SimForge makes robotics authoring conversational without hiding the engineering process. The user sees the plan, live actions, true scene state, validation evidence, approvals, checkpoints, changes, and export report. Blender remains the source of visual truth; deterministic validators remain the source of structural evidence.

## Product Principles

1. **Scene truth over chat memory.** Inspect Blender immediately before acting.
2. **Evidence over confidence.** Reopen exports and retain deterministic results.
3. **Safe autonomy.** Automate only clear, local, reversible, non-creative corrections.
4. **Meaningful approval.** Ask at consequential gates, not after every tiny action.
5. **Reversibility.** Checkpoint risky work and expose undo, history, versions, and branches.
6. **Transparent cloud use.** Show what data goes to which provider and why.
7. **Provider-neutral projects.** Models may change; project data and tools must not be locked in.
8. **Local ownership.** Projects remain portable and usable without a hosted SimForge service.
9. **General product, focused demo.** Make the warehouse manipulator reliable without hard-coding the product around it.
10. **Simulation feedback with bounded authority.** Keep Isaac Sim optional while retaining reproducible build-test-analyze-correct-rerun evidence and explicit user control.

## Intended Experience

The user creates or opens a project, configures a provider securely, describes a goal, inspects and approves a plan, and watches visible work occur in Blender. SimForge refreshes scene state, detects manual edits, validates geometry and robotics metadata, proposes safe corrections, pauses for structural decisions, creates recoverable checkpoints, exports only on explicit request, reopens the USD package, and presents a readiness report with assumptions and limitations.

## Hackathon Success

- A judge can install or launch the packaged Windows build through documented steps.
- NVIDIA model availability is discovered and validated at runtime.
- Plan Mode cannot mutate Blender; Build Mode can execute an approved structured action.
- A primitive robot and the warehouse mobile-manipulator demo work reliably.
- Several genuine geometry/robotics defects are detected deterministically.
- Safe fixes are reversible and structural fixes require approval.
- A modular USD package is reopened and verified, with machine and human reports.
- Secrets remain absent from source, logs, evidence, and submission media.
- The demo is rehearsed and completes in less than three minutes.

## Boundaries

The hackathon product is Windows-first and does not require Isaac Sim for Blender authoring, validation, or USD export. When the optional runtime is configured it provides the promoted, reproducible feedback loop. SimForge does not promise AI-only proof of correctness, silent export, autonomous destructive work, arbitrary network-exposed Blender execution, or broad CAD fidelity; retained format/platform outcomes remain explicitly tiered rather than discarded.
