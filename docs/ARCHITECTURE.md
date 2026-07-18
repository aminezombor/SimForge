# Architecture

## Status and Quality Attributes

- Status: Approved baseline (DEC-004 through DEC-011)
- Implementation: Not started
- Target: Windows 11 x64, separately installed Blender 4.5 LTS
- Priorities: scene truth, safety, recovery, testability, judge reproducibility, delivery speed, future Linux/Isaac extension

## System Context

```mermaid
flowchart LR
    U["User"] --> R["Sandboxed React renderer"]
    R -->|"validated narrow IPC"| M["Electron main process"]
    M --> P["Provider adapters"]
    P --> N["NVIDIA hosted NIM"]
    P --> O["Optional OpenAI API"]
    M --> D["Global and project SQLite"]
    M -->|"loopback token RPC"| B["Blender 4.5 LTS extension"]
    B --> S["Authoritative Blender scene"]
    M -->|"fixed JSON over stdio"| X["Bundled OpenUSD sidecar"]
    X --> W["Verified USD package"]
```

There is no local HTTP server and no remote web UI. The main process is the trust boundary and sole owner of provider calls, secrets, filesystem writes, jobs, policy, bridge sessions, and sidecars.

## Desktop Boundaries

### Renderer

React renders projects, chat, approvals, activity, validation, history, and export state. It has no Node integration, secret access, raw filesystem access, arbitrary process launch, provider credentials, or direct Blender connection. Context isolation, Chromium sandboxing, restrictive CSP, validated sender origins, permission denial, safe navigation, and Electron fuses are required.

### Main process

Domain services are separated by interface:

- `ProjectRepository` and `GlobalRepository`
- `ConversationService` and scoped `MemoryService`
- `ProviderRegistry` and `CapabilityRouter`
- `ToolRegistry`, `PolicyEngine`, and `ApprovalService`
- `JobOrchestrator` and `CheckpointService`
- `BlenderBridge` and `SceneStateService`
- `ValidationEngine` and `FixService`
- `ImportService`, `ExportService`, and `UsdWorkerClient`
- `AuditLog` with structural redaction

Renderer IPC namespaces are limited to `project`, `conversation`, `provider`, `job`, `approval`, `scene`, `validation`, and `export`. Each call validates a versioned request/response schema and the current window/project/session authority.

## Persistent Data Model

### Global application data

Stored under `%LOCALAPPDATA%\SimForge`:

- `global.sqlite`: project index, non-secret provider profiles, application preferences, optional global memory, schema migrations
- encrypted secret blob: DPAPI-backed Electron `safeStorage`; never copied into a project
- `runtime/`: short-lived Blender session descriptors with user-only ACLs
- redacted rotating logs and crash diagnostics, disabled or minimized by user controls

### Portable project

```text
project-root/
  simforge.project.json
  .simforge/
    project.sqlite
  scene/
    project.blend
  references/
  scripts/generated/
  checkpoints/<checkpoint-id>/
  previews/<scene-revision>/
  exports/<export-version>/
  reports/
```

The manifest contains format version, stable project ID, display name, creation/update times, relative Blender path, and migration version. Databases store projects, conversations, messages and multimodal parts, branches, scoped memories, plans/tasks, approvals, jobs/attempts, actions/tool calls, scene revisions/diffs, checkpoints, validation runs/findings/fixes, assets/licenses, exports/manifests, and usage records. Actions and approvals are append-only; user deletion uses explicit scoped operations.

Only the main process writes SQLite. One mutating job per project is allowed during the hackathon; read-only inspection and chat continue. Checkpoints combine a Blender save-copy, SQLite backup, project-file hash inventory, task position, and manifest.

## Versioned Contracts

JSON Schema is canonical for IPC, Blender RPC, provider events, importer output, validation, and manifests. Generated TypeScript types and Python validation consume the same schemas.

### Provider adapter

```text
discoverModels(profile) -> ModelDescriptor[]
probeCapabilities(model) -> CapabilityRecord
stream(ProviderRequest, AbortSignal) -> AsyncIterable<ProviderEvent>
cancel(requestId)
```

Capabilities include text, vision, tool calling, streaming, structured output, reasoning controls, context/output limits, and usage reporting. Provider requests use normalized messages/parts, tools, response schema, attachments, and purpose. Events normalize text deltas, reasoning summaries if explicitly returned, tool calls, usage, warnings, errors, and completion.

NVIDIA hosted NIM is primary. Nemotron 3 Ultra is selected only after discovery/probe and is treated as text-only. OpenAI Responses is optional. Capability records are cached with endpoint/model/version and can be re-probed. Before cloud dispatch, the renderer shows provider, model, purpose, and included text/image/file classes.

### Tool and approval model

Each tool declares ID/version, input/output schema, read/write class, supported modes, risk class, reversibility, checkpoint rule, approval rule, path scope, timeout, and idempotency behavior.

- Normal Chat: conversational and explicitly requested low-risk operations.
- Plan Mode: read-only tools are the only tools supplied and accepted.
- Build Mode: structured mutations within an approved plan and current revision.
- Goal Mode: persistent orchestration; it never expands tool authority.

Approvals bind the actor, project, plan hash, task/action scope, risk summary, scene revision, expiry, and decision. A changed plan, expired approval, different project, or stale scene invalidates it.

## Blender Integration

The app opens a random `127.0.0.1` TCP listener and writes a short-lived descriptor containing protocol version, port, app PID, expiry, and 256-bit token to a user-only runtime file. The installed GPL Blender extension reads an explicitly selected descriptor and connects outbound. It never listens on the LAN.

Messages use a length-prefixed UTF-8 JSON envelope:

```text
request:  protocolVersion, requestId, projectId, expectedSceneRevision,
          operation, payload, deadline
response: requestId, ok/error, preRevision, postRevision,
          changedEntityIds, warnings, result
event:    eventId, projectId, sceneRevision, kind, changedEntityIds, summary
```

The token is used during the authenticated handshake, not repeated in logs. Size limits, timeouts, rate limits, schema validation, and per-session project binding apply.

A socket thread only parses and queues. `bpy.app.timers` executes scene access on Blender's main thread. Dependency-graph handlers track relevant manual changes. Stable `simforge.id` properties identify entities; `simforge.sceneRevision` advances monotonically. A mutating request with a mismatched expected revision returns `STALE_SCENE`, causing refresh and replanning rather than overwrite.

Structured operations cover scene snapshot, primitive/object/collection/material creation, transforms, hierarchy, metadata, import/export staging, renders, validation queries, saves, and checkpoint copies. Python fallback is disabled in Plan Mode and requires script/intent display, approval, pre-checkpoint, hash, constrained working paths, audit entry, timeout/cancel handling where feasible, and a post-execution snapshot/validation. It is privileged, not sandboxed.

## Import Architecture

All imports enter a staging collection/project copy and produce an `ImportReport`. Blender native importers handle `.blend`, USD, GLB/GLTF, FBX, OBJ, and STL. Robot-description sidecars normalize URDF/MJCF into:

```text
RobotGraph {
  source, units, coordinateConvention, links[], joints[], visuals[],
  collisions[], inertials[], materials[], sensors[], assetReferences[], warnings[]
}
```

Resolved files must remain inside an approved import root. Remote URLs, executable plugins, automatic Xacro expansion, and path escape are rejected. `package://` mappings require an explicit user-selected root. Every import records conversions, losses, assumptions, missing assets, license/source, and validation status.

## Validation and Correction

The orchestrator runs five evidence channels: fresh Blender snapshot, deterministic geometry/metadata rules, deterministic robotics rules, OpenUSD inspection, and materialized multi-angle renders. Visual-model output is advisory.

```text
Finding {
  ruleId, runId, domain, severity, entityPath, message,
  deterministicEvidence, assumptions, proposedFixId,
  fixClass, status
}
```

Rule classes cover geometry, topology, scene organization, materials/references, robot graph, collision, mass/inertia, joints/articulation, sensors, and USD composition. Physical values are never fabricated without an explicit recorded assumption.

Fix classes are `SAFE_LOCAL`, `STRUCTURAL`, `CREATIVE`, `DESTRUCTIVE`, and `UNKNOWN`. Only `SAFE_LOCAL` may auto-run, and only when preconditions match the current revision, the operation has an inverse or checkpoint, and post-validation passes. All other classes require approval.

## USD Export Package

Blender exports visual geometry/material data. The fixed Python 3.13 `usd-core` sidecar authors composition, UsdPhysics, sensor placeholders, metadata, and manifest data through `pxr`. It receives validated JSON over stdio and never a shell command.

```text
<slug>/
  scene.usda
  robot/
    robot.usda
    geometry/robot_geometry.usdc
    materials/robot_materials.usda
    physics/robot_physics.usda
    sensors/robot_sensors.usda
  environment/environment.usdc
  textures/
  source/<project>.blend
  scripts/
  validation/
    validation-results.json
    readiness-report.md
    preview-images/
  manifest.json
  THIRD_PARTY_NOTICES.md
```

The package uses Z-up, meters-per-unit `1.0`, a declared default prim, relative references, normalized names, and hashes for packaged files. Quick export flattens a verified stage to one `.usdc`. Canonical export first writes a temporary sibling directory, validates/reopens all entry stages and references, then atomically promotes it after explicit destination/overwrite/package approval.

P0 checks stage open, default prim, units/up axis, relative reference resolution, containment, layers, materials, UsdPhysics schemas, link/joint relationships, mass/inertia metadata, sensors, manifest hashes, and portability. Isaac-specific schemas are not required; V2 adds optional layers and simulation adapters.

## Failure and Recovery Model

- Provider: cancel stream, retain partial activity, classify retryable failure, offer configured fallback without duplicating tool effects.
- Blender: mark disconnected, stop new mutations, preserve job/checkpoint, reconnect and refresh before resume.
- Stale scene: reject mutation, show diff, refresh plan/approval as necessary.
- Long operation: visible phase/progress when deterministic, cancellation request, timeout, and recovery instructions.
- Database: transaction boundaries, migrations with backup, periodic checkpoint backup, corruption diagnostic.
- Export: build in temporary destination, never overwrite without approval, retain failed validation artifacts separately.

## Deployment

Electron Forge produces a Windows installer and portable ZIP. Blender remains a separate prerequisite. The release bundles the fixed OpenUSD sidecar and Blender extension installer files, but no API key, Blender binary, or Isaac Sim. Auto-update is outside P0. Unsigned-build limitations must be documented if no certificate is available.
