# SPDX-License-Identifier: GPL-3.0-or-later

bl_info = {
    "name": "SimForge Bridge",
    "author": "SimForge Contributors",
    "version": (0, 1, 0),
    "blender": (4, 5, 0),
    "location": "View3D > Sidebar > SimForge",
    "description": "Authenticated local bridge between SimForge and Blender",
    "category": "Development",
}

import os

import bpy
from bpy.app.handlers import persistent

from . import bridge


class SIMFORGE_OT_connect(bpy.types.Operator):
    bl_idname = "simforge.connect"
    bl_label = "Connect SimForge"
    bl_description = "Connect to the latest authenticated local SimForge session"

    def execute(self, _context):
        bridge.connect()
        self.report({"INFO"}, "SimForge connection started")
        return {"FINISHED"}


class SIMFORGE_OT_disconnect(bpy.types.Operator):
    bl_idname = "simforge.disconnect"
    bl_label = "Disconnect"

    def execute(self, _context):
        bridge.disconnect()
        return {"FINISHED"}


class SIMFORGE_PT_bridge(bpy.types.Panel):
    bl_label = "SimForge Bridge"
    bl_idname = "SIMFORGE_PT_bridge"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "SimForge"

    def draw(self, _context):
        layout = self.layout
        layout.label(text="Connected" if bridge.is_connected() else "Disconnected")
        if bridge.is_connected():
            layout.operator(SIMFORGE_OT_disconnect.bl_idname)
        else:
            layout.operator(SIMFORGE_OT_connect.bl_idname)


CLASSES = (SIMFORGE_OT_connect, SIMFORGE_OT_disconnect, SIMFORGE_PT_bridge)


def _auto_connect():
    if os.environ.get("SIMFORGE_AUTO_CONNECT") == "1":
        bridge.connect()
    return None


@persistent
def _reconnect_after_file_load(_unused):
    if os.environ.get("SIMFORGE_AUTO_CONNECT") == "1":
        bridge.connect()


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    if bridge.depsgraph_update_handler not in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.append(bridge.depsgraph_update_handler)
    if _reconnect_after_file_load not in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.append(_reconnect_after_file_load)
    if os.environ.get("SIMFORGE_AUTO_CONNECT") == "1" and not bpy.app.timers.is_registered(_auto_connect):
        bpy.app.timers.register(_auto_connect, first_interval=1.0, persistent=True)


def unregister():
    bridge.disconnect()
    if bpy.app.timers.is_registered(_auto_connect):
        bpy.app.timers.unregister(_auto_connect)
    if bridge.depsgraph_update_handler in bpy.app.handlers.depsgraph_update_post:
        bpy.app.handlers.depsgraph_update_post.remove(bridge.depsgraph_update_handler)
    if _reconnect_after_file_load in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.remove(_reconnect_after_file_load)
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
