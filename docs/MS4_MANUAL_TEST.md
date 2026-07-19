# MS4 Primitive Robot Manual Test

## Prepare

1. Double-click **SimForge Hackathon** on the desktop. SimForge and Blender 4.5.11
   should open without a terminal window; wait for **Blender connected**.
2. In Blender choose **File > New > General**, press `A`, then `X` to delete the default
   objects. Under Scene Properties > Units select **Metric** with scale `1.0`.
3. In SimForge select **Build** and click **Refresh live scene**.

## Build and Validate

1. In **Robotics Build**, inspect the RobotGraph facts and physical-assumption notice.
2. Click **Approve exact robot build**, then **Build approved robot**.
3. Confirm Blender visibly contains a teal base, dark drive wheels/rear caster, and amber
   sensor bodies. The build button is replaced by a materialized-state message.
4. Click **Run fresh** in Validation. The result must include the
   `deterministic-robotics` channel with no robotics blocker/error. Informational
   assumption/contact findings are allowed and must remain visible.
5. Expand Recovery checkpoints and confirm a robot-materialization checkpoint exists.

## Review Evidence

1. Click **Render materialized review**.
2. Confirm lit three-quarter, front, side, close-up, and sensor views appear inside the
   app. They must show assigned materials; the sensor view must show the amber camera
   mounted on the chassis, not a blank frame or material-less viewport.
3. Confirm each review labels its Blender scene revision and says the images are
   advisory. Deterministic validation remains the readiness authority.

## Expected Limit

This is the stable primitive generated-robot path. Canonical USD export is MS5, the
integrated final workspace is MS6, and the warehouse manipulator is MS7.
