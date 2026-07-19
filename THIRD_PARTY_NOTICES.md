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

No third-party robot, texture, environment, or sample asset is included through MS5.
