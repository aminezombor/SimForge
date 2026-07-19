# SPDX-License-Identifier: GPL-3.0-or-later
"""Create deterministic self-contained native-format fixtures with Blender itself."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


def output_root() -> Path:
    marker = sys.argv.index("--")
    target = Path(sys.argv[marker + 1]).resolve()
    target.mkdir(parents=True, exist_ok=True)
    return target


def main() -> None:
    target = output_root()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.5))
    cube = bpy.context.active_object
    if cube is None:
        raise RuntimeError("Fixture cube was not created")
    cube.name = "SimForge Native Fixture"
    material = bpy.data.materials.new("Fixture Teal")
    material.diffuse_color = (0.05, 0.75, 0.62, 1.0)
    cube.data.materials.append(material)
    bpy.ops.wm.save_as_mainfile(filepath=str(target / "fixture.blend"), check_existing=False)
    bpy.ops.object.select_all(action="DESELECT")
    cube.select_set(True)
    bpy.context.view_layer.objects.active = cube
    bpy.ops.wm.usd_export(
        filepath=str(target / "fixture.usdc"),
        selected_objects_only=True,
        export_materials=True,
    )
    bpy.ops.export_scene.gltf(
        filepath=str(target / "fixture.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
    )
    bpy.ops.export_scene.fbx(
        filepath=str(target / "fixture.fbx"),
        use_selection=True,
        bake_anim=False,
    )
    bpy.ops.wm.obj_export(
        filepath=str(target / "fixture.obj"),
        export_selected_objects=True,
        export_materials=False,
    )
    bpy.ops.wm.stl_export(
        filepath=str(target / "fixture.stl"),
        export_selected_objects=True,
    )


if __name__ == "__main__":
    main()
