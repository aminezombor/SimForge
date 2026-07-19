# MS3 Owner Test

1. Double-click **SimForge Hackathon** on the desktop. Confirm no terminal opens and the
   header changes to **Blender connected**.
2. In Blender, select a mesh and move it upward so its bottom is above Z=0. Return to
   SimForge and choose **Run fresh** in the Validation panel.
3. Find `GEO-CONTACT-001`. Confirm it names the object path, shows deterministic
   support-plane evidence, and offers **Apply reversible safe fix**.
4. Apply the fix. Confirm Blender moves the object to ground contact, a checkpoint is
   listed, and a fresh run no longer reports that object. Choose **Undo latest safe
   fix** and confirm the original position/finding returns.
5. Scale a mesh in Blender without applying scale. Refresh/run validation, switch to
   Build mode, and find `GEO-TRANSFORM-001`. Confirm **Apply** is unavailable until you
   choose **Approve exact structural fix**, then apply it and observe revalidation.
6. Expand **Recovery checkpoints**. In Build mode approve one complete checkpoint,
   then restore it. Confirm a new pre-restore checkpoint appears and Blender/project
   state returns to the selected checkpoint.

Do not use a scene containing unsaved work you intend to preserve outside SimForge.
Checkpoint restore is intentionally real and replaces the active project working state
after a separate exact approval.
