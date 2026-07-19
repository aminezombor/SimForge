# MS5 Verified USD Manual Test

1. Double-click **SimForge Hackathon** on the desktop and wait for both SimForge and
   Blender 4.5.11. Confirm the header changes from **Blender waiting** to **Blender live**.
2. Select **Build**. In **Robotics Build**, approve the exact robot build, then build it.
3. Click **Render materialized review** and confirm the five images show the current robot.
4. In **Validation**, click **Run fresh**. Continue only with zero blockers and zero errors.
5. In **Verified USD**, keep **Canonical package**, choose an empty destination, and click
   **Review exact export**. Check the scene revision, destination, and overwrite state.
6. Approve the destination/final package, then click **Export, reopen, and verify**.
7. Confirm the result says **canonical export verified** and every deterministic check
   passed. Open the destination and verify `scene.usda`, `robot/`, `environment/`,
   `source/`, `validation/`, `manifest.json`, and `THIRD_PARTY_NOTICES.md` exist.
8. Repeat with **Quick .usdc**. Selecting an existing file must fail until the explicit
   overwrite box is checked and a new exact proposal is approved.

Expected: no terminal opens; rejected or cancelled proposals create no destination;
successful artifacts reopen through the bundled OpenUSD runtime. Visual images are
advisory—the JSON/Markdown reports and deterministic checks are the readiness evidence.
