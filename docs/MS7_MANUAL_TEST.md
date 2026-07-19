# MS7 Warehouse Manipulator Manual Test

## Prepare

1. Double-click **SimForge Hackathon**. SimForge and Blender 4.5.11 should open without
   terminal windows; wait for **Blender connected**.
2. In Blender choose **File > New > General**, delete the default objects, and use Metric
   units at scale `1.0`.
3. In SimForge choose **Build** and refresh the live scene.

## Build and Inspect

1. In **Warehouse mobile manipulator**, confirm the summary lists 12 links, 11 joints,
   3 sensors, and 15 warehouse objects.
2. Click **Review & approve build**, inspect the exact structural action, then click
   **Build checkpointed scene**.
3. Confirm Blender shows the teal wheeled base, articulated arm, two-finger gripper,
   sensor bodies, floor, pallets/cargo, shelving, and safety bollards.
4. Click **Validate**. The result must include `deterministic-robotics` and
   `deterministic-environment` with zero blocker/error findings. Informational physical
   assumptions must remain visible.
5. Click **Preview**. Orbit/pan/zoom the embedded workcell and select an object; the
   displayed revision must match fresh Blender truth.

## Review and Export

1. In the 3D dock, open materialized review. Confirm robot views plus
   **warehouse-overview** use assigned materials and identify the current scene revision.
2. In the Export dock choose **Canonical package**, select a new empty destination,
   approve the exact destination/overwrite scope, and export.
3. Confirm the result reports verified reopen and includes
   `environment/environment_geometry.usdc`, validation JSON, readiness Markdown,
   `manifest.json`, Blender source, and third-party notices.

## Expected Limits

The generated workcell is deliberately primitive and source-tagged. It proves the full
safe authoring/export loop, not finished industrial design or Isaac simulation. The
licensed imported-robot path is tested separately in MS8.
