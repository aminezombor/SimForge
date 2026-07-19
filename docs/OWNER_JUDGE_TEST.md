# Owner and Judge Test Procedure

## Purpose

Validate the v0.1.2 release through normal UI controls. Do not paste credentials into
Codex, chat, terminals, screenshots, or this document. Record failures with the visible
message, current scene revision, and screenshot only.

## Owner Launch Check (2 minutes)

1. Close existing SimForge and Blender windows.
2. Double-click `Desktop\SimForge.lnk`. Expected within 20 seconds: SimForge and Blender
   open, no terminal or PowerShell window appears, and the header changes from **Blender
   waiting** to **Blender live · r…**.
3. Click the header Blender status, or Settings → Environment. Click **Recheck**.
4. Expect passes for Blender 4.5, Blender extension, authenticated bridge, writable local
   storage, private loopback, bundled OpenUSD, and NVIDIA driver. Provider and Isaac rows
   may warn when not configured; warnings do not disable Blender/USD authoring.

Evidence: one full workspace screenshot and one Doctor screenshot, with private paths
cropped if needed.

## NVIDIA Setup (2–4 minutes)

1. Settings → AI providers → Provider credentials → NVIDIA.
2. Type the key directly into the password field and click **Save securely**.
3. Click **Discover models**. Expected: configured status and non-zero model count.
4. Select the intended Nemotron model only when it appears in discovery. Text-only
   Nemotron must show no vision capability; rendered-image review remains local or routes
   only to a separately probed visual model.

If discovery fails, retain the exact error, confirm network/key access, and use the
disclosed local deterministic fallback for the demo. Do not repeatedly expose or copy the key.

## Guided Conversational Loop (6–10 minutes)

1. Confirm **Guided** authority beneath the composer. A new workspace must show only the
   empty conversational prompt; advanced fixtures remain behind **Advanced**.
2. Enter `prepare for me in blender a wheeled robot with a gripper hand`. Review
   **Approve plan & build**, inspect the exact scope (12 links, 11 joints, 3 sensors,
   15 warehouse objects), and confirm the native approval dialog.
3. Expected: the blank metric Blender scene visibly becomes the robot/workcell; no factory
   Cube, Camera, or Light remains. Activity records a checkpoint and scene `r1`; the
   embedded preview and deterministic validation bind to that revision.
4. Enter `export this robot to USD for simulation`, choose an empty parent folder, and
   confirm the exact destination. Expected: verified package, `scene.usda`, relative
   layers, `manifest.json`, validation JSON, readiness report, previews, source, and
   notices, plus 12 passing reopen checks.
5. Enter `send it to simulation in Isaac Sim`, approve the fixed task, and review the
   retained stability failure. Approve the bounded checkpointed arm correction, export
   scene `r2` to a new folder, and rerun. Expected: `PASSED`, retained checks/frames, and
   a native Isaac viewport showing the robot move through the 1.2 m waypoint task.

## Authority Acceptance (3 minutes)

- **Guided:** request a mutation; it must wait for a human click.
- **Balanced:** a preconditioned safe local correction may continue; structural work waits.
- **Autonomous:** the exact approved structural simulation correction may continue only
  inside its plan and current revision.
- In every mode, try export/overwrite and observe a human gate. Automated delete,
  privileged simulation/Python, privacy-sensitive dispatch, changed plan, or stale revision
  must fail closed. Goal Mode must not change the saved authority.

## Isaac Before/After (3–6 minutes)

1. With a verified canonical export, open Simulate → **Review local simulation** →
   **Approve exact run** → **Run in Isaac Sim**.
2. Expected first run: retained frames/metrics and deterministic stability failure.
3. Click **Analyze evidence**. Expected: selected provider/model and advisory narrative;
   deterministic values remain the authority.
4. In Guided, review and approve the checkpointed Blender correction. Re-export, then
   rerun. Expected: passing child experiment linked to the failed parent. **Open native
   view** visualizes the exact retained experiment in Isaac Sim.

If Isaac is unavailable, show the retained sanitized before/after evidence in
`docs/evidence/ms11b/` and state that Isaac is optional and separately installed.

## Release/Recovery Matrix

| Check | Expected result |
| ----- | --------------- |
| Installer launch | SimForge opens normally; unsigned Windows warning is disclosed |
| Portable launch | Same app behavior without installation |
| Upgrade 0.1.0 → 0.1.1 | App updates; normal profile database hash is unchanged |
| Uninstall | App and shortcut removed; project folders and `%LOCALAPPDATA%\SimForge` retained |
| OpenUSD | Bundled Python 3.13.14 / usd-core 26.5 doctor and relocated reopen pass |
| Security/privacy | Electron fuses, renderer, isolated credential, privacy, and secret scans pass |

## Troubleshooting

- **Blender waiting:** start Blender from the SimForge shortcut, enable the extension,
  then Recheck. Close stale Blender processes before retrying.
- **Unsupported Blender:** install the 4.5 LTS line; newer major versions are not claimed.
- **Provider warning:** save the key in Settings and run discovery; local deterministic
  validation/export still works without cloud inference.
- **Stale scene:** refresh/review again after any manual Blender edit; old approval is invalid.
- **SmartScreen:** use **More info → Run anyway** only if SHA-256 matches, or use the
  portable ZIP. The v0.1.2 installer is intentionally disclosed as unsigned.
- **Isaac limited/unavailable:** core authoring remains supported. Larger experiments may
  require at least NVIDIA's published 32 GB RAM / 16 GB VRAM baseline.

Pass criteria: all required states above are observable, screenshots contain no secrets,
and any fallback is narrated honestly.
