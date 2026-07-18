# MS1/MS2 Manual Test Guide

This guide exercises only the completed MS1/MS2 foundation. It does not claim MS3
validation, robot generation, or product USD export.

## Start

1. Double-click **SimForge Hackathon** on the Windows desktop.
2. Wait up to 20 seconds. SimForge and Blender 4.5.11 LTS should open with no terminal.
3. Confirm SimForge shows **Blender connected** and a numeric **Scene r…** value.
4. In Environment Doctor, expect Blender and Python to pass. OpenUSD may say “not
   bootstrapped”; embedding that runtime remains MS5/MS9 work.

If Blender is already open from this launcher, the shortcut reuses it. If Blender was
closed while SimForge stayed open, use the shortcut again to reopen and reconnect it.

## Test the Safety and Scene Loop

1. Select **Plan**. Confirm **Create checkpointed cube** and **Run local
   AI-to-Blender slice** are disabled. This is the non-mutating policy check.
2. Select **Build**, then **Refresh live scene**.
3. Click **Create checkpointed cube**. Expect Blender’s Outliner to contain
   `SimForge Cube`, the scene revision to increase, and checkpoint/action entries in
   Activity. Select the object in Blender and press Numpad `.` to frame it if needed.
4. In Blender, select the cube and press `G`, `X`, `1`, `Enter`. Wait briefly, then
   click Activity **Refresh**. Expect “Manual Blender edit detected” with a changed
   count and a newer revision.
5. Still in Build, click **Run local AI-to-Blender slice**. This uses the deterministic
   offline provider fixture and should add `SimForge Primitive` through the structured,
   checkpointed tool path. It sends no cloud data.

## Test Persistent Goal Execution

1. Select **Goal** and keep the default inspection-cube goal.
2. Click **Create task plan**, inspect its four tasks, then **Approve exact plan**.
3. Click **Start / resume**, then **Run next task** four times.
4. Expect every task to complete, `SimForge Goal Cube` to appear in Blender, and the
   UI to continue stating that deterministic validation is not run until MS3.

To test persistence, pause a newly running goal, close and reopen SimForge with the
desktop shortcut, and confirm the paused plan returns before resuming it.

## Optional Live NVIDIA Probe

Provider Settings should say the NVIDIA credential is stored with Windows protection.
Click **Discover models**, choose `nvidia/nemotron-3-ultra-550b-a55b`, review the
on-screen disclosure, and click **Send disclosed text probe**. Expect a successful
selection reason and `Vision: false`. This sends one small text-only capability request
to NVIDIA and may count toward provider usage; no file or image is attached.

## Expected Boundaries and Troubleshooting

- Normal Chat currently uses a local deterministic response fixture; cloud-backed
  authoring chat is later work.
- The app is an unsigned user-local test build, not the MS9 installer.
- If the header says **Blender waiting**, close only the Blender window and double-click
  **SimForge Hackathon** again. If it still waits, close both windows and relaunch once.
- Project/checkpoint data stays under `%LOCALAPPDATA%\SimForge`; the installed test
  binaries are under `%LOCALAPPDATA%\Programs\SimForge`.
- Record any failed step with the visible error, current scene revision, and which mode
  was selected. Never include an API key in a screenshot or report.
