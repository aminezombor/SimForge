# Third-Party Notices

SimForge desktop source is Apache-2.0. The separately packaged Blender extension in
`blender-extension/` is GPL-3.0-or-later. Third-party components remain under their
own licenses; this file does not relicense them.

## Runtime JavaScript

The MS1 production dependency audit (`pnpm licenses list --prod --json`) found:

- MIT: `@assistant-ui/react` 0.14.27 and its assistant-ui/Radix/React UI
  dependencies; React 19.2.7; React DOM 19.2.7; Scheduler 0.27.0; TypeBox
  0.34.52; Ajv 8.20.0; Ajv Formats 3.0.1; and their MIT dependencies.
- BSD-3-Clause: fast-uri 3.1.3.
- MIT: `fast-xml-parser` 5.10.0 and its retained production dependencies. SimForge
  configures entity processing off and adds separate declaration/URL/path limits; the
  parser never executes Xacro or source code.

Electron 43.1.1 is MIT-licensed and includes Chromium/Node components. Its packaged
`LICENSE`, `LICENSES.chromium.html`, and version files are retained in the Electron
distribution. Electron Forge, Vite, Vitest, ESLint, pnpm, and related packages are
development tooling and retain their upstream licenses.

## Python, OpenUSD, and Blender

- `usd-core` 26.5 is embedded in the fixed export runtime under its upstream
  `LicenseRef-TOST-1.0` terms.
- CPython 3.13.14 is embedded for that worker and retains the Python Software Foundation
  License. SimForge invokes it only through the fixed JSON-driven OpenUSD sidecar.
- Blender 4.5 LTS is an external GPL prerequisite and is not redistributed by SimForge.
- The SimForge Blender extension includes its GPL-3.0-or-later notice and SPDX metadata.

## Included Demonstration Asset

The MS8 imported-robot demonstration includes selected unmodified source files from the
Open Robotics `ros/urdf_tutorial` repository at commit
`050f1e47cfdb2c5f3eb0746bc15c57e6a870faef`, under BSD-3-Clause:

- `urdf/07-physics.urdf`
- `meshes/l_finger.dae`
- `meshes/l_finger_tip.dae`
- the upstream `LICENSE`

Exact source URLs, byte counts, and SHA-256 digests are recorded in
`sample-data/imports/ros-urdf-tutorial-r2d2/SOURCE.json`. The retained files are
unmodified. SimForge converts the URDF into its neutral RobotGraph; COLLADA finger meshes
are kept as source evidence but intentionally approximated with disclosed box primitives.
