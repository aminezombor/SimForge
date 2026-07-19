# SimForge Product Workspace Contract

## Status and Scope

Owner-approved product direction, recorded 2026-07-19 from the annotated MS1/MS2
screenshots and proposed layout. MS6 now implements and verifies this contract; see
`docs/evidence/MS6_VERIFICATION.md` and `design-qa.md`. This document consolidates
existing requirements and does not change their priority or milestone.

## Desktop Workspace

The production workspace is a resizable three-column desktop layout:

1. **Project and conversation rail.** New chat, project-associated conversation
   history, search, rename, delete, and branch entry points. Project switching and
   settings remain available without displacing the active conversation.
2. **Primary authoring workspace.** Chat, plans, approvals, task progress, findings,
   and results share one coherent work surface. The composer remains anchored at the
   bottom and carries Chat/Plan/Build/Goal mode, attachments, context usage, active
   routing, and stop/send controls. Example goals appear only as placeholders or
   sample-project content, never as unexplained user input.
3. **Context dock.** A revision-stamped 3D inspection viewport sits above tabbed or
   stacked Activity, Changes, Validation, and Export/Readiness panels. The dock is
   resizable and collapsible. Export controls appear only when implemented and remain
   subject to explicit destination/overwrite/package approval.

The top command bar shows project identity, connection health, and the active routing
choice. Blender, local sidecars, and future Isaac adapters have distinguishable states
and actionable recovery. Isaac is optional/V2 and must not appear as a hackathon error.

## Provider Placement

- API keys, provider enable/disable, budgets, fallback order, and diagnostics belong in
  **Settings**, not the main authoring canvas.
- A compact top-bar/composer selector shows the active provider/model or `Auto` route.
- Runtime-discovered, capability-compatible models are sorted with recommended choices
  first; unavailable remembered names are never offered as working choices.
- The task/activity record still shows which model ran, why it was selected, disclosed
  cloud data, usage, and cost when available.

## Scene Truth and Responsive Behavior

The embedded viewport never replaces Blender. It displays its exact source revision,
shows a stale badge after Blender changes, links selection where supported, and offers
**Open in Blender**. At narrower widths, the context dock becomes tabs or a drawer
rather than compressing chat into an unusable column. Keyboard order follows left rail,
main workspace, composer, then context dock; status changes cannot rely on color alone.

## Delivery Mapping

- MS3 findings UI and MS5 export/readiness components must be designed as future
  context-dock panels to avoid a rewrite.
- MS6 delivers the full conversation rail, embedded viewport, richer history/timeline,
  responsive docking, and final workspace integration.
- MS9 removes developer language, validates keyboard/zoom/contrast states, and proves
  the clean one-click experience.

Mapped requirements: `REQ-AI-008` through `REQ-AI-010`, `REQ-UX-001` through
`REQ-UX-009`, `REQ-VIEW-001` through `REQ-VIEW-004`, `REQ-HISTORY-004`, and
`REQ-PLATFORM-002` through `REQ-PLATFORM-005`. Mapped acceptance tests: `AT-007`,
`AT-008`, `AT-018`, `AT-027`, `AT-032`, `AT-033`, and `AT-034`.
