# Privacy and Data Handling

## Principles

SimForge is local-first, data-minimizing, transparent about cloud processing, and usable without a SimForge-hosted account or telemetry service. The user owns project files and controls provider, upload, memory, and logging behavior.

## MS1-MS5 Implementation Status

Portable project and global SQLite, local chat, provider capability records, protected
credentials, per-dispatch probe disclosure, and no-telemetry behavior are implemented.
The renderer never receives a stored credential. Packaged credential evidence found no
plaintext test credential anywhere under app data while stored or after removal. Verified
USD export remains local and includes only the documented portable project manifest,
selected Blender source/geometry, generated scripts when present, activity evidence,
validation/review results, version/assumption/limitation metadata, and public notices; it
excludes credentials, global SQLite, provider profiles, and unrelated files.
Attachment/upload, diagnostics export, advanced memory controls, and project deletion
are not exposed yet and therefore cannot send or delete data silently; their full
control/evidence gate remains AT-032/MS6.

## Data Locations

| Data | Default location | Cloud behavior |
| ---- | ---------------- | -------------- |
| Project files, Blender source, assets, reports, checkpoints | User-selected portable project folder | Not sent unless selected content is required for an approved request |
| Conversations, plans, actions, validation, project memory | Project SQLite | Relevant message/context excerpts may be sent to the selected provider |
| Global preferences and optional global memory | `%LOCALAPPDATA%\SimForge\global.sqlite` | Not included unless enabled and relevant |
| Provider credentials | DPAPI-protected local blob | Sent only as HTTPS authentication to that provider; never placed in model input |
| Renders/images/references | Project folder | Sent only when visual/file upload is enabled and disclosed |
| Redacted logs | Local application data | No automatic telemetry; diagnostics export is user initiated |

## Cloud Dispatch Disclosure

Before a provider request, show provider, model, purpose, and whether the payload includes conversation text, project memory, extracted document text, images/renders, file metadata, or tool results. File uploads and visual review are independently controllable. Send the minimum relevant excerpt or derived render rather than an entire project when possible.

Never send API keys, credentials, environment files, unrelated files, hidden project content, raw logs containing private paths when a sanitized form suffices, or content outside the approved project/request scope.

Provider retention and training policies are governed by the user's provider agreement. SimForge must link current provider privacy documentation in settings and must not promise provider-side deletion it cannot enforce.

## Memory Controls

Project and global memory are visibly distinct. Users can inspect, edit, export, disable, or delete stored memory. Automatic compaction must preserve confirmed product/project decisions and cite its source messages. Deleting a conversation does not silently delete a checkpoint or project artifact; the UI states the affected scope before deletion.

## Retention and Deletion

- Projects remain until the user deletes or moves them.
- Local logs use bounded rotation and configurable retention.
- Provider credentials are deleted when the user removes them.
- A project export contains only documented project data and no global memory or provider credential.
- Project deletion and permanent purge are explicit, scoped, and confirmation-gated.
- Temporary previews, import staging, and failed export directories have visible cleanup behavior.

## Diagnostics and Submission Media

Diagnostics export is opt-in, previews exactly what will be included, and performs structural redaction. Screenshots, demo recordings, readiness examples, and repository fixtures use fake keys, non-sensitive paths, and redistributable assets. The `/feedback` Codex Session ID is preserved privately for the submission form unless the owner explicitly chooses to publish it.

## Privacy Acceptance

Release requires evidence that cloud disclosure is accurate, disabled upload settings are honored, project exports exclude secrets/global data, deletion scopes are clear, logs are redacted, and no telemetry occurs by default.
