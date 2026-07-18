# SPDX-License-Identifier: GPL-3.0-or-later
"""Headless Blender host for opt-in real bridge acceptance tests."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import bpy


def _argument(name: str) -> Path:
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    index = arguments.index(name)
    return Path(arguments[index + 1]).resolve()


extension_root = os.environ.get("SIMFORGE_EXTENSION_ROOT")
if not extension_root:
    raise RuntimeError("SIMFORGE_EXTENSION_ROOT is required")
sys.path.insert(0, extension_root)

from simforge_bridge import bridge  # noqa: E402

control = _argument("--control")
control.mkdir(parents=True, exist_ok=True)
manual_request = control / "manual-edit.request"
manual_complete = control / "manual-edit.complete"
stop_request = control / "stop.request"

bridge.connect()
deadline = time.time() + 90
while time.time() < deadline and not stop_request.exists():
    bridge._process_requests()  # Main-thread queue pump used by Blender's timer in interactive mode.
    if manual_request.exists() and not manual_complete.exists():
        bpy.ops.mesh.primitive_uv_sphere_add(location=(2.0, 0.0, 1.0))
        changed = bpy.context.active_object
        if changed is None:
            raise RuntimeError("Manual fixture could not create an object")
        changed.name = "Manual Sphere"
        bpy.context.view_layer.update()
        bridge._OUTBOUND.put(
            {
                "protocolVersion": bridge.PROTOCOL_VERSION,
                "kind": "event",
                "eventId": "real-manual-edit",
                "projectId": bridge._DESCRIPTOR.get("projectId", "unknown"),
                "sceneRevision": bridge._increment_revision(),
                "eventType": "scene.changed",
                "changedEntityIds": [bridge._object_id(changed)],
                "summary": "Manual Blender edit detected",
            }
        )
        manual_complete.write_text("done", encoding="utf-8")
    time.sleep(0.02)

bridge.disconnect()
