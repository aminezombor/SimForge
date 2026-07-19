# MS9C Installed Acceptance

- Date: 2026-07-19
- Build: SimForge 0.1.2 installed desktop candidate
- Platform: Windows 11 x64, Blender 4.5.11 LTS, Isaac Sim 6.0.1
- Acceptance: AT-041 and AT-042 local owner run
- Recording: owner-controlled OBS capture; video is not committed

## Visible Sequence and Results

1. `Desktop\SimForge.lnk` opened SimForge and Blender without visible terminals.
2. Blender opened the blank metric `SimForge Starter.blend`; no Cube, Camera, or Light
   existed. SimForge opened an uncluttered new chat, reported Blender live at `r0`, and
   showed the remembered `NVIDIA · nemotron-3-ultra-550b-a55b` route.
3. The exact prompt `prepare for me in blender a wheeled robot with a gripper hand`
   produced a reviewable action. Exact approval created 12 links, 11 joints, 3 sensors,
   15 warehouse objects, collision/physics metadata, a checkpoint, and Blender scene `r1`.
   The live scene contained 73 authored objects and no factory-scene clutter.
4. `export this robot to USD for simulation` correctly selected Export, not Simulate.
   Exact destination approval produced a canonical package with physics/composition
   layers and 12 passing OpenUSD reopen checks.
5. The first approved Isaac run retained task/media/physics evidence and exposed the
   intended center-of-mass/support stability failure.
6. Guided authority required review and approval before a checkpointed -0.1248 m arm
   subtree retraction. Blender advanced to `r2`; no silent correction occurred.
7. The corrected canonical package again passed all 12 reopen checks. Its approved Isaac
   rerun passed, opened in the native Isaac viewport, and visibly moved the robot through
   the bounded 1.2 m waypoint task toward the yellow target.

## Deterministic Verification

- `pnpm verify`: 57 passing tests, 6 opt-in tests skipped; TypeScript, ESLint, and a
  210-file secret scan pass.
- Real Blender regression: actual factory Cube/Camera/Light are recognized, reported,
  removed during approved materialization, and absent afterward.
- Retained sanitized waypoint evidence: `docs/evidence/ms9c-waypoint/`.
- No API key, loopback token, private feedback ID, or generated Chromium profile is in
  committed evidence.

## Remaining Human Delivery Work

Edit the recording below three minutes, add narration, upload it to YouTube, verify the
public release links, provide the private `/feedback` Session ID only in Devpost, and
confirm the final public submission action.
