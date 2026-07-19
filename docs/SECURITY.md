# Security Model

## Security Objectives

Protect provider credentials and private project data, prevent models/renderers/imports from gaining ambient authority, prevent unintended Blender or filesystem mutation, keep recovery possible, and make cloud and privileged actions understandable to the user.

## MS1-MS5 Implemented Baseline

Packaged evidence confirms renderer sandbox/context isolation, no renderer Node globals,
restrictive CSP, denied remote windows/navigation/permissions, a typed narrow preload
API, and hardened Electron fuses. The main process owns SQLite, provider HTTPS,
DPAPI-backed credentials, policy, files, jobs, and the authenticated bridge. Runtime
descriptors and credential blobs receive current-user-only Windows ACLs. Tests cover
forged/oversized bridge frames, stale/forged approvals, prompt-injected unavailable
tools, project-path traversal, secret-like chat/script content, privileged script
failure, crash recovery, export-path/type/traversal policy, exact overwrite approval,
staging containment, relative USD dependencies, inventory hashes, and atomic promotion.
Import-specific controls remain gated to MS8.

Packaged smoke tests run only with an explicit isolated user-data directory. SimForge
sets that directory before runtime initialization, creates a separate global/project
database, and verifies the normal profile database hash is unchanged. Security and
credential lifecycle checks may be combined without a hidden renderer's closure ending
the process early. A pre-fix credential smoke could touch the normal profile and may have
removed the configured NVIDIA key; the harness is corrected and the key must be entered
again rather than recovered or logged.

## Trust Boundaries

- **Trusted policy boundary:** signed/pinned Electron main-process code and fixed sidecars.
- **Constrained UI:** sandboxed renderer with narrow validated IPC.
- **Untrusted inputs:** model output, prompts, tool arguments, attachments, imports, downloaded assets, USD/Blender files, provider responses, generated scripts, and renderer content.
- **Privileged external process:** Blender and its extension; generated Python is never considered safely sandboxed.
- **External services:** NVIDIA/OpenAI receive only explicitly disclosed request data.

## Threats and Controls

| Threat | Required controls |
| ------ | ----------------- |
| Renderer compromise | `nodeIntegration: false`, `contextIsolation: true`, Chromium sandbox, strict CSP, local bundled UI only, deny unexpected permissions/navigation/windows, validate IPC sender and schema, minimal preload API, Electron fuses. |
| Prompt/tool injection | Models cannot call OS/Blender directly; deterministic tool registry, mode/risk policy, project/path scope, expected revision, approval binding, output treated as data. |
| Blender bridge hijack | Bind only `127.0.0.1` on random port, 256-bit expiring token, user-only descriptor ACL, authenticated handshake, session/project binding, frame limits, rate/time limits, no LAN listener. |
| Arbitrary Blender Python | Prefer structured tools; disable in Plan Mode; show intent/code hash, require approval and checkpoint, constrain files, audit, timeout where possible, inspect/validate afterward. Never claim sandboxing. |
| Malicious import or project | Disable Blender auto-execution, stage imports, validate format/size/path, prevent traversal and remote fetch, reject executable plugins/Xacro execution, contain referenced assets, never auto-install add-ons. |
| Secret leakage | DPAPI-backed `safeStorage`, keys remain main-process only, structural redaction, no secrets in projects/chat/URLs/CLI/logs/screenshots/evidence, secret-pattern test fixtures use fake values. |
| Destructive path operation | Canonicalize and allowlist project/user-approved roots, reject symlink/path escape, explicit export/overwrite/delete approval, temporary writes plus atomic promotion, checkpoint before risky mutation. |
| Supply-chain compromise | Pin direct/transitive versions through lockfile, record source/license/hash, minimum release-age where practical, audit advisories, minimize dependencies, no runtime package installation. |
| Data over-disclosure | Per-dispatch disclosure and controls, send minimum selected text/renders/excerpts, never environment/unrelated files, project-level cloud and upload settings. |
| Log/privacy exposure | Redacted structured logs, user-visible logging controls, bounded retention, no telemetry by default, sanitized diagnostics export. |

## Secrets Lifecycle

Provider profiles in SQLite contain IDs, endpoints, preferences, and a reference to a protected secret, never the secret. The main process encrypts/decrypts with Electron `safeStorage` on Windows (DPAPI), supplies authorization headers directly to HTTPS requests, and does not return credentials to the renderer. Removing a provider deletes its protected blob and invalidates cached sessions.

DPAPI protects against other OS users, not malicious processes running as the same user. This limitation must be disclosed. Keys are never validated through shell commands or command-line arguments.

## Mode and Approval Enforcement

Mode permissions are checked twice: when tools are offered to a provider and when any tool request is executed. Plan Mode rejects every mutating tool ID regardless of prompt content. Approval records bind plan hash, scope, risk, project, scene revision, and expiry. Stale revisions or changed plans invalidate approval.

Action authority is separate from workflow mode and defaults to Guided. The main process
binds any Autonomous continuation to the persisted authority, current scene revision,
exact plan hash, tool, arguments, and structural risk. Automatic destructive or
privileged work and export/Python hard gates are denied even when the renderer requests
Autonomous authority. Goal Mode cannot change or expand authority.

## Files, Imports, and Sidecars

All paths are absolute after canonicalization and checked against approved roots. Archive extraction rejects absolute paths, drive changes, `..`, symlink escapes, and excessive sizes/counts. Sidecars are launched without a shell, with fixed executable/script paths and contained JSON request files. Blender opens untrusted files with automatic script execution disabled.

Export proposals bind kind, robot, destination, overwrite, final-package intent,
validation run, scene revision, and exact arguments. Blender writes only inside project
staging. OpenUSD rejects absolute/up-level dependencies, inventories every artifact, and
deeply reopens the promoted output; an existing destination requires a new explicit
overwrite proposal. Graceful app exit awaits bridge shutdown, and startup removes
dead/expired/malformed session descriptors before generating a fresh token.

Isaac experiments use the same containment rule. The app selects a configured runtime;
the renderer cannot supply an executable or script. A fixed worker receives a contained
JSON request without shell interpolation, copies the verified package into a unique
experiment, rejects symlinks/path escape, and hashes every request/result/log/image.
Generated Python is never executed in Isaac. Native view opens only a retained request
whose hash still matches its experiment manifest.

## Network Policy

Only provider HTTPS endpoints explicitly configured by the user and the loopback Blender bridge are required. No inbound non-loopback service, remote UI, analytics, advertising, or automatic asset download is enabled by default. Redirects and custom endpoints require validation and must never receive a credential intended for another origin.

## Security Verification

Acceptance tests cover Plan Mode mutation attempts, forged bridge sessions, stale/forged approvals, path traversal, malicious references, renderer IPC abuse, secret redaction, cloud-dispatch minimization, overwrite protection, and recovery after privileged failures. Security failures block release.

## Incident Handling

On suspected leakage: stop provider calls, revoke the affected key with the provider, delete protected local credentials, sanitize retained logs/evidence, document the incident privately, rotate any related secret, and add a regression test. Never commit a leaked key even after revocation.

During MS5 installed-launch verification, a diagnostic command mistakenly displayed one
ephemeral loopback descriptor. The exact app and Blender processes were stopped
immediately, revoking the session; the value was neither a provider credential nor
committed. Investigation produced DEC-025 and regression coverage for awaited shutdown,
stale-descriptor cleanup, and fresh-token issuance without descriptor logging.
