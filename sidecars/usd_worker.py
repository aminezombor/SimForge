# SPDX-License-Identifier: Apache-2.0
"""Fixed OpenUSD authoring and verification worker for SimForge.

The desktop invokes this file directly with a pinned Python executable, never through a
shell. Inputs are validated JSON files. The worker does not download assets, execute
scripts, or follow paths outside the explicitly supplied staging/package roots.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, sort_keys=True))


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("JSON root must be an object")
    return value


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _identifier(value: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_]", "_", value)
    if not clean:
        clean = "unnamed"
    if clean[0].isdigit():
        clean = f"_{clean}"
    return clean


def _contained(root: Path, candidate: Path) -> Path:
    root = root.resolve()
    candidate = candidate.resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"Path escaped approved root: {candidate}")
    return candidate


def _set_conventions(stage: Any) -> None:
    from pxr import UsdGeom

    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)


def doctor() -> int:
    try:
        from pxr import Usd, UsdPhysics

        _emit(
            {
                "ok": True,
                "python": sys.version.split()[0],
                "usdVersion": ".".join(str(value) for value in Usd.GetVersion()),
                "usdPhysics": hasattr(UsdPhysics, "ArticulationRootAPI"),
            }
        )
        return 0
    except Exception as error:
        _emit({"ok": False, "error": type(error).__name__, "message": str(error)})
        return 1


def spike(output: Path) -> int:
    from pxr import Usd, UsdGeom

    output = output.resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Usd.Stage.CreateNew(str(output))
    _set_conventions(stage)
    root = UsdGeom.Xform.Define(stage, "/World")
    stage.SetDefaultPrim(root.GetPrim())
    root.GetPrim().SetCustomDataByKey("simforge:spike", True)
    stage.GetRootLayer().Save()

    reopened = Usd.Stage.Open(str(output))
    valid = bool(reopened) and (
        reopened.GetDefaultPrim().GetPath().pathString == "/World"
        and UsdGeom.GetStageUpAxis(reopened) == UsdGeom.Tokens.z
        and UsdGeom.GetStageMetersPerUnit(reopened) == 1.0
    )
    _emit(
        {
            "ok": valid,
            "output": str(output),
            "defaultPrim": reopened.GetDefaultPrim().GetPath().pathString if reopened else None,
            "upAxis": UsdGeom.GetStageUpAxis(reopened) if reopened else None,
            "metersPerUnit": UsdGeom.GetStageMetersPerUnit(reopened) if reopened else None,
            "sha256": _sha256(output),
        }
    )
    return 0 if valid else 1


def _normalize_geometry(path: Path) -> dict[str, Any]:
    from pxr import Usd

    stage = Usd.Stage.Open(str(path))
    if stage is None:
        raise RuntimeError("Blender geometry layer could not be opened")
    _set_conventions(stage)
    default_prim = stage.GetDefaultPrim()
    if not default_prim:
        roots = list(stage.GetPseudoRoot().GetChildren())
        if not roots:
            raise RuntimeError("Blender geometry layer has no root prim")
        stage.SetDefaultPrim(roots[0])
        default_prim = roots[0]
    stage.GetRootLayer().Save()
    return {
        "defaultPrim": default_prim.GetPath().pathString,
        "primCount": sum(1 for _ in stage.Traverse()),
    }


def _link_paths(graph: dict[str, Any]) -> dict[str, str]:
    children: dict[str, list[str]] = {}
    for joint in graph["joints"]:
        children.setdefault(joint["parentLinkId"], []).append(joint["childLinkId"])
    paths: dict[str, str] = {}

    def visit(link_id: str, parent: str) -> None:
        path = f"{parent}/{_identifier(link_id)}"
        paths[link_id] = path
        for child in sorted(children.get(link_id, [])):
            visit(child, path)

    visit(graph["rootLinkId"], "/Robot/Links")
    for link in graph["links"]:
        if link["id"] not in paths:
            paths[link["id"]] = f"/Robot/Links/Unattached/{_identifier(link['id'])}"
    return paths


def _author_materials(path: Path, graph: dict[str, Any]) -> None:
    from pxr import Gf, Sdf, Usd, UsdShade

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    root = stage.DefinePrim("/Robot", "Xform")
    stage.SetDefaultPrim(root)
    stage.DefinePrim("/Robot/Materials", "Scope")
    for material in graph["materials"]:
        material_path = f"/Robot/Materials/{_identifier(material['id'])}"
        usd_material = UsdShade.Material.Define(stage, material_path)
        shader = UsdShade.Shader.Define(stage, f"{material_path}/PreviewSurface")
        shader.CreateIdAttr("UsdPreviewSurface")
        color = material["baseColor"]
        shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(
            Gf.Vec3f(float(color[0]), float(color[1]), float(color[2]))
        )
        shader.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(float(color[3]))
        shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(float(material["metallic"]))
        shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(float(material["roughness"]))
        usd_material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
        usd_material.GetPrim().SetCustomDataByKey("simforge:materialId", material["id"])
    stage.GetRootLayer().Save()


def _author_collision(stage: Any, link_path: str, link: dict[str, Any]) -> None:
    from pxr import Gf, UsdGeom, UsdPhysics

    geometry = link.get("collision")
    if geometry is None:
        return
    collision_path = f"{link_path}/Collision"
    primitive = geometry["primitive"]
    if primitive == "BOX":
        shape = UsdGeom.Cube.Define(stage, collision_path)
        shape.CreateSizeAttr(1.0)
        shape.AddScaleOp().Set(Gf.Vec3d(*(float(value) for value in geometry["size"])))
    elif primitive == "CYLINDER":
        shape = UsdGeom.Cylinder.Define(stage, collision_path)
        shape.CreateAxisAttr(UsdGeom.Tokens.y)
        shape.CreateRadiusAttr(float(geometry["radius"]))
        shape.CreateHeightAttr(float(geometry["depth"]))
    else:
        shape = UsdGeom.Sphere.Define(stage, collision_path)
        shape.CreateRadiusAttr(float(geometry["radius"]))
    UsdPhysics.CollisionAPI.Apply(shape.GetPrim())
    shape.GetPrim().SetCustomDataByKey("simforge:linkId", link["id"])
    shape.GetPrim().SetCustomDataByKey("simforge:physicsMaterialId", link.get("physicsMaterialId"))


def _axis_token(axis: list[float]) -> str:
    from pxr import UsdPhysics

    absolute = [abs(float(value)) for value in axis]
    index = absolute.index(max(absolute)) if max(absolute) > 0 else 0
    return [UsdPhysics.Tokens.x, UsdPhysics.Tokens.y, UsdPhysics.Tokens.z][index]


def _author_physics(path: Path, graph: dict[str, Any]) -> dict[str, str]:
    from pxr import Gf, Usd, UsdPhysics

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    root = stage.DefinePrim("/Robot", "Xform")
    stage.SetDefaultPrim(root)
    UsdPhysics.ArticulationRootAPI.Apply(root)
    root.SetCustomDataByKey("simforge:selfCollisionPolicy", graph["selfCollision"]["policy"])
    root.SetCustomDataByKey("simforge:selfCollisionNote", graph["selfCollision"]["note"])
    link_paths = _link_paths(graph)
    for link in graph["links"]:
        link_prim = stage.DefinePrim(link_paths[link["id"]], "Xform")
        link_prim.SetCustomDataByKey("simforge:linkId", link["id"])
        link_prim.SetCustomDataByKey("simforge:dynamic", bool(link["dynamic"]))
        link_prim.SetCustomDataByKey("simforge:materialId", link["materialId"])
        link_prim.SetCustomDataByKey("simforge:massSource", link["massKg"]["source"])
        link_prim.SetCustomDataByKey("simforge:massNote", link["massKg"]["note"])
        if link["dynamic"]:
            UsdPhysics.RigidBodyAPI.Apply(link_prim)
        mass_api = UsdPhysics.MassAPI.Apply(link_prim)
        if link["massKg"].get("value") is not None:
            mass_api.CreateMassAttr(float(link["massKg"]["value"]))
        if link["centerOfMassM"].get("value") is not None:
            mass_api.CreateCenterOfMassAttr(Gf.Vec3f(*(float(v) for v in link["centerOfMassM"]["value"])))
        if link["inertiaDiagonalKgM2"].get("value") is not None:
            mass_api.CreateDiagonalInertiaAttr(
                Gf.Vec3f(*(float(v) for v in link["inertiaDiagonalKgM2"]["value"]))
            )
        _author_collision(stage, link_paths[link["id"]], link)

    stage.DefinePrim("/Robot/Joints", "Scope")
    for joint in graph["joints"]:
        joint_path = f"/Robot/Joints/{_identifier(joint['id'])}"
        if joint["type"] == "FIXED":
            usd_joint = UsdPhysics.FixedJoint.Define(stage, joint_path)
        elif joint["type"] in {"REVOLUTE", "CONTINUOUS"}:
            usd_joint = UsdPhysics.RevoluteJoint.Define(stage, joint_path)
            usd_joint.CreateAxisAttr(_axis_token(joint["axis"]))
            if joint["limits"] is not None:
                usd_joint.CreateLowerLimitAttr(float(joint["limits"]["lower"]))
                usd_joint.CreateUpperLimitAttr(float(joint["limits"]["upper"]))
        else:
            usd_joint = UsdPhysics.PrismaticJoint.Define(stage, joint_path)
            usd_joint.CreateAxisAttr(_axis_token(joint["axis"]))
            if joint["limits"] is not None:
                usd_joint.CreateLowerLimitAttr(float(joint["limits"]["lower"]))
                usd_joint.CreateUpperLimitAttr(float(joint["limits"]["upper"]))
        usd_joint.CreateBody0Rel().SetTargets([link_paths[joint["parentLinkId"]]])
        usd_joint.CreateBody1Rel().SetTargets([link_paths[joint["childLinkId"]]])
        position = joint["origin"]["position"]
        usd_joint.CreateLocalPos0Attr(Gf.Vec3f(*(float(value) for value in position)))
        usd_joint.GetPrim().SetCustomDataByKey("simforge:jointId", joint["id"])
        usd_joint.GetPrim().SetCustomDataByKey("simforge:jointType", joint["type"])
        usd_joint.GetPrim().SetCustomDataByKey(
            "simforge:axis",
            Gf.Vec3d(*(float(value) for value in joint["axis"])),
        )
        if joint.get("drive"):
            drive_name = "angular" if joint["type"] in {"REVOLUTE", "CONTINUOUS"} else "linear"
            drive = UsdPhysics.DriveAPI.Apply(usd_joint.GetPrim(), drive_name)
            drive.CreateTypeAttr(UsdPhysics.Tokens.force)
            drive.CreateMaxForceAttr(float(joint["drive"]["maxForce"]))
            usd_joint.GetPrim().SetCustomDataByKey("simforge:driveMode", joint["drive"]["mode"])
    stage.GetRootLayer().Save()
    return link_paths


def _author_sensors(path: Path, graph: dict[str, Any], link_paths: dict[str, str]) -> None:
    from pxr import Gf, Sdf, Usd, UsdGeom

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    root = stage.DefinePrim("/Robot", "Xform")
    stage.SetDefaultPrim(root)
    stage.DefinePrim("/Robot/Sensors", "Scope")
    for sensor in graph["sensors"]:
        sensor_path = f"/Robot/Sensors/{_identifier(sensor['id'])}"
        if sensor["type"] == "CAMERA":
            schema = UsdGeom.Camera.Define(stage, sensor_path)
            prim = schema.GetPrim()
        else:
            schema = UsdGeom.Xform.Define(stage, sensor_path)
            prim = schema.GetPrim()
        prim.SetCustomDataByKey("simforge:sensorId", sensor["id"])
        prim.SetCustomDataByKey("simforge:sensorType", sensor["type"])
        prim.SetCustomDataByKey("simforge:parentLinkPath", link_paths[sensor["parentLinkId"]])
        prim.CreateAttribute("simforge:fieldOfViewDegrees", Sdf.ValueTypeNames.Float).Set(
            float(sensor["fieldOfViewDegrees"] or 0.0)
        )
        position = sensor["pose"]["position"]
        prim.CreateAttribute("simforge:positionMeters", Sdf.ValueTypeNames.Float3).Set(
            Gf.Vec3f(*(float(value) for value in position))
        )
    stage.GetRootLayer().Save()


def _author_robot(path: Path, graph: dict[str, Any], geometry_info: dict[str, Any]) -> None:
    from pxr import Usd, UsdGeom

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    root = UsdGeom.Xform.Define(stage, "/Robot")
    stage.SetDefaultPrim(root.GetPrim())
    root.GetPrim().SetCustomDataByKey("simforge:robotId", graph["robotId"])
    root.GetPrim().SetCustomDataByKey("simforge:units", graph["units"])
    root.GetPrim().SetCustomDataByKey("simforge:coordinateConvention", graph["coordinateConvention"])
    root.GetPrim().SetCustomDataByKey("simforge:geometryDefaultPrim", geometry_info["defaultPrim"])
    visual = UsdGeom.Xform.Define(stage, "/Robot/Visual")
    visual.GetPrim().GetReferences().AddReference("./geometry/robot_geometry.usdc")
    stage.GetRootLayer().subLayerPaths = [
        "./materials/robot_materials.usda",
        "./physics/robot_physics.usda",
        "./sensors/robot_sensors.usda",
    ]
    stage.GetRootLayer().Save()


def _author_environment(
    path: Path,
    graph: dict[str, Any] | None,
    geometry_info: dict[str, Any] | None,
) -> None:
    from pxr import Usd, UsdGeom

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    root = UsdGeom.Xform.Define(stage, "/Environment")
    stage.SetDefaultPrim(root.GetPrim())
    if graph is None:
        root.GetPrim().SetCustomDataByKey("simforge:placeholder", True)
    else:
        root.GetPrim().SetCustomDataByKey("simforge:environmentId", graph["environmentId"])
        root.GetPrim().SetCustomDataByKey("simforge:units", graph["units"])
        root.GetPrim().SetCustomDataByKey("simforge:coordinateConvention", graph["coordinateConvention"])
        root.GetPrim().SetCustomDataByKey("simforge:geometryDefaultPrim", geometry_info["defaultPrim"])
        visual = UsdGeom.Xform.Define(stage, "/Environment/Visual")
        visual.GetPrim().GetReferences().AddReference("./environment_geometry.usdc")
        for entry in graph["objects"]:
            prim = UsdGeom.Xform.Define(stage, f"/Environment/Objects/{_identifier(entry['id'])}").GetPrim()
            prim.SetCustomDataByKey("simforge:objectId", entry["id"])
            prim.SetCustomDataByKey("simforge:category", entry["category"])
            prim.SetCustomDataByKey("simforge:static", bool(entry["static"]))
            prim.SetCustomDataByKey("simforge:materialId", entry["materialId"])
            prim.SetCustomDataByKey("simforge:hasCollision", entry.get("collision") is not None)
    stage.GetRootLayer().Save()


def _author_scene(path: Path, request: dict[str, Any]) -> None:
    from pxr import Usd, UsdGeom

    stage = Usd.Stage.CreateNew(str(path))
    _set_conventions(stage)
    world = UsdGeom.Xform.Define(stage, "/World")
    stage.SetDefaultPrim(world.GetPrim())
    world.GetPrim().SetCustomDataByKey("simforge:exportId", request["exportId"])
    world.GetPrim().SetCustomDataByKey("simforge:sceneRevision", int(request["sceneRevision"]))
    robot = UsdGeom.Xform.Define(stage, "/World/Robot")
    robot.GetPrim().GetReferences().AddReference("./robot/robot.usda")
    environment = UsdGeom.Xform.Define(stage, "/World/Environment")
    environment.GetPrim().GetReferences().AddReference("./environment/environment.usda")
    stage.GetRootLayer().Save()


def _core_checks(
    package_root: Path,
    graph: dict[str, Any],
    environment_graph: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    from pxr import Usd, UsdGeom, UsdPhysics

    checks: list[dict[str, Any]] = []

    def add(check_id: str, passed: bool, evidence: dict[str, Any]) -> None:
        checks.append({"id": check_id, "status": "PASS" if passed else "FAIL", "evidence": evidence})

    required = [
        "scene.usda",
        "robot/robot.usda",
        "robot/geometry/robot_geometry.usdc",
        "robot/materials/robot_materials.usda",
        "robot/physics/robot_physics.usda",
        "robot/sensors/robot_sensors.usda",
        "environment/environment.usda",
    ]
    if environment_graph is not None:
        required.append("environment/environment_geometry.usdc")
    missing = [value for value in required if not (package_root / value).is_file()]
    add("USD-LAYERS-001", not missing, {"required": required, "missing": missing})
    stage = Usd.Stage.Open(str(package_root / "scene.usda"))
    add("USD-STAGE-001", stage is not None, {"entryPoint": "scene.usda"})
    if stage is None:
        return checks
    add(
        "USD-CONVENTION-001",
        UsdGeom.GetStageUpAxis(stage) == UsdGeom.Tokens.z and UsdGeom.GetStageMetersPerUnit(stage) == 1.0,
        {
            "upAxis": UsdGeom.GetStageUpAxis(stage),
            "metersPerUnit": UsdGeom.GetStageMetersPerUnit(stage),
            "defaultPrim": stage.GetDefaultPrim().GetPath().pathString if stage.GetDefaultPrim() else None,
        },
    )
    references: list[dict[str, str]] = []
    invalid_references: list[str] = []
    for relative in required:
        layer_path = package_root / relative
        if not layer_path.is_file():
            continue
        layer = stage.GetRootLayer().FindOrOpen(str(layer_path))
        if not layer:
            invalid_references.append(relative)
            continue
        for reference in list(layer.subLayerPaths) + list(layer.GetExternalReferences()):
            references.append({"layer": relative, "asset": reference})
            candidate = Path(reference)
            if candidate.is_absolute() or ".." in candidate.parts:
                invalid_references.append(f"{relative}:{reference}")
                continue
            resolved = (layer_path.parent / candidate).resolve()
            if package_root.resolve() not in resolved.parents and resolved != package_root.resolve():
                invalid_references.append(f"{relative}:{reference}")
            elif not resolved.exists():
                invalid_references.append(f"{relative}:{reference}")
    add("USD-REFERENCES-001", not invalid_references, {"references": references, "invalid": invalid_references})

    robot_stage = Usd.Stage.Open(str(package_root / "robot/robot.usda"))
    robot_root = robot_stage.GetPrimAtPath("/Robot") if robot_stage else None
    articulation = bool(robot_root and robot_root.HasAPI(UsdPhysics.ArticulationRootAPI))
    identified_link_prims = [
        prim for prim in robot_stage.Traverse()
        if prim.GetCustomDataByKey("simforge:linkId") is not None
    ] if robot_stage else []
    link_prims = [prim for prim in identified_link_prims if prim.HasAPI(UsdPhysics.MassAPI)]
    joint_prims = [
        prim for prim in robot_stage.Traverse()
        if prim.GetCustomDataByKey("simforge:jointId") is not None
    ] if robot_stage else []
    add(
        "USD-ROBOT-001",
        articulation and len(link_prims) == len(graph["links"]) and len(joint_prims) == len(graph["joints"]),
        {
            "articulationRoot": articulation,
            "links": len(link_prims),
            "visualAndPhysicsLinkPrims": len(identified_link_prims),
            "joints": len(joint_prims),
        },
    )
    collision_prims = [
        prim for prim in robot_stage.Traverse() if prim.HasAPI(UsdPhysics.CollisionAPI)
    ] if robot_stage else []
    mass_prims = [
        prim for prim in link_prims if prim.HasAPI(UsdPhysics.MassAPI)
    ]
    add(
        "USD-PHYSICS-001",
        len(collision_prims) == len([link for link in graph["links"] if link.get("collision")])
        and len(mass_prims) == len(graph["links"]),
        {"collisions": len(collision_prims), "massSchemas": len(mass_prims)},
    )
    material_prims = [
        prim for prim in robot_stage.Traverse()
        if prim.GetCustomDataByKey("simforge:materialId") is not None and prim.GetTypeName() == "Material"
    ] if robot_stage else []
    add("USD-MATERIAL-001", len(material_prims) == len(graph["materials"]), {"materials": len(material_prims)})
    sensor_prims = [
        prim for prim in robot_stage.Traverse()
        if prim.GetCustomDataByKey("simforge:sensorId") is not None
    ] if robot_stage else []
    add("USD-SENSOR-001", len(sensor_prims) == len(graph["sensors"]), {"sensors": len(sensor_prims)})
    environment_stage = Usd.Stage.Open(str(package_root / "environment/environment.usda"))
    environment_prims = [
        prim for prim in environment_stage.Traverse()
        if prim.GetCustomDataByKey("simforge:objectId") is not None
    ] if environment_stage else []
    expected_environment_objects = len(environment_graph["objects"]) if environment_graph else 0
    environment_root = environment_stage.GetPrimAtPath("/Environment") if environment_stage else None
    environment_identity = environment_root.GetCustomDataByKey("simforge:environmentId") if environment_root else None
    add(
        "USD-ENVIRONMENT-001",
        (
            environment_stage is not None and
            len(environment_prims) == expected_environment_objects and
            environment_identity == (environment_graph["environmentId"] if environment_graph else None)
        ),
        {
            "environmentId": environment_identity,
            "objects": len(environment_prims),
            "expectedObjects": expected_environment_objects,
            "placeholder": environment_graph is None,
        },
    )
    return checks


def _readiness_markdown(request: dict[str, Any], checks: list[dict[str, Any]]) -> str:
    source_validation = request["sourceValidation"]
    blocking = int(source_validation["summary"]["blocker"]) + int(source_validation["summary"]["error"])
    ready = blocking == 0 and all(check["status"] == "PASS" for check in checks)
    lines = [
        "# SimForge USD Readiness Report",
        "",
        f"- Export ID: `{request['exportId']}`",
        f"- Project: {request['project']['name']} (`{request['project']['id']}`)",
        f"- Robot: `{request['graph']['robotId']}`",
        f"- Environment: `{request['environmentGraph']['environmentId']}`" if request.get("environmentGraph") else "- Environment: none (neutral placeholder layer)",
        f"- Blender scene revision: `{request['sceneRevision']}`",
        f"- Ready: **{'YES' if ready else 'NO'}**",
        "- Convention: Z-up, meters-per-unit 1.0, right-handed X-forward robot graph",
        "",
        "## Deterministic USD Checks",
        "",
    ]
    lines.extend(f"- `{check['id']}`: **{check['status']}**" for check in checks)
    lines.extend([
        "",
        "## Source Validation Summary",
        "",
        f"- Blockers: {source_validation['summary']['blocker']}",
        f"- Errors: {source_validation['summary']['error']}",
        f"- Warnings: {source_validation['summary']['warning']}",
        f"- Informational: {source_validation['summary']['info']}",
        "",
        "## Physical Assumptions",
        "",
    ])
    assumptions = list(request["graph"].get("assumptions", []))
    if request.get("environmentGraph"):
        assumptions.extend(request["environmentGraph"].get("assumptions", []))
    lines.extend(f"- {value}" for value in assumptions)
    lines.extend(["", "## Known Limitations", ""])
    lines.extend(f"- {value}" for value in request.get("limitations", []))
    lines.extend([
        "",
        "Visual review is advisory. Deterministic Blender and OpenUSD checks are the evidence source.",
        "Isaac Sim execution is not required for this package.",
        "",
    ])
    return "\n".join(lines)


def _file_inventory(package_root: Path) -> list[dict[str, Any]]:
    roles = {
        ".usd": "usd-layer",
        ".usda": "usd-layer",
        ".usdc": "usd-layer",
        ".png": "preview",
        ".blend": "blender-source",
        ".json": "machine-data",
        ".md": "documentation",
    }
    files: list[dict[str, Any]] = []
    for file in sorted(path for path in package_root.rglob("*") if path.is_file()):
        relative = file.relative_to(package_root).as_posix()
        if relative == "manifest.json":
            continue
        files.append(
            {
                "path": relative,
                "role": roles.get(file.suffix.lower(), "source-artifact"),
                "bytes": file.stat().st_size,
                "sha256": _sha256(file),
            }
        )
    return files


def _validation_document(request: dict[str, Any], checks: list[dict[str, Any]]) -> dict[str, Any]:
    assumptions = list(request["graph"].get("assumptions", []))
    if request.get("environmentGraph"):
        assumptions.extend(request["environmentGraph"].get("assumptions", []))
    return {
        "schemaVersion": 1,
        "exportId": request["exportId"],
        "sceneRevision": request["sceneRevision"],
        "sourceValidation": request["sourceValidation"],
        "usdChecks": checks,
        "assumptions": assumptions,
        "limitations": request.get("limitations", []),
        "modelAssertionUsedAsEvidence": False,
    }


def author_export(request_path: Path) -> int:
    from pxr import Usd

    request = _read_json(request_path.resolve())
    staging_root = Path(request["stagingRoot"]).resolve()
    package_root = _contained(staging_root, Path(request["packageRoot"]))
    geometry_path = _contained(package_root, package_root / "robot/geometry/robot_geometry.usdc")
    if not geometry_path.is_file():
        raise FileNotFoundError("Blender geometry layer is missing")
    graph = request["graph"]
    environment_graph = request.get("environmentGraph")
    geometry_info = _normalize_geometry(geometry_path)
    environment_geometry_path = package_root / "environment/environment_geometry.usdc"
    environment_geometry_info = None
    if environment_graph is not None:
        environment_geometry_path = _contained(package_root, environment_geometry_path)
        if not environment_geometry_path.is_file():
            raise FileNotFoundError("Blender environment geometry layer is missing")
        environment_geometry_info = _normalize_geometry(environment_geometry_path)
    _author_materials(package_root / "robot/materials/robot_materials.usda", graph)
    link_paths = _author_physics(package_root / "robot/physics/robot_physics.usda", graph)
    _author_sensors(package_root / "robot/sensors/robot_sensors.usda", graph, link_paths)
    _author_robot(package_root / "robot/robot.usda", graph, geometry_info)
    _author_environment(
        package_root / "environment/environment.usda",
        environment_graph,
        environment_geometry_info,
    )
    _author_scene(package_root / "scene.usda", request)

    checks = _core_checks(package_root, graph, environment_graph)
    validation_path = package_root / "validation/validation-results.json"
    report_path = package_root / "validation/readiness-report.md"
    _write_json(validation_path, _validation_document(request, checks))
    report_path.write_text(_readiness_markdown(request, checks), encoding="utf-8")
    files = _file_inventory(package_root)
    assumptions = list(graph.get("assumptions", []))
    if environment_graph is not None:
        assumptions.extend(environment_graph.get("assumptions", []))
    manifest = {
        "schemaVersion": 1,
        "exportId": request["exportId"],
        "kind": request["kind"],
        "appVersion": request["appVersion"],
        "createdAt": request["createdAt"],
        "entryPoint": "scene.usda",
        "project": request["project"],
        "robotId": graph["robotId"],
        "sceneRevision": request["sceneRevision"],
        "conventions": {"upAxis": "Z", "metersPerUnit": 1.0, "robotForwardAxis": "X"},
        "sourceValidationRunId": request["sourceValidation"]["id"],
        "validation": {"checks": checks, "summary": request["sourceValidation"]["summary"]},
        "assumptions": assumptions,
        "limitations": request.get("limitations", []),
        "files": files,
    }
    if environment_graph is not None:
        manifest["environmentId"] = environment_graph["environmentId"]
    _write_json(package_root / "manifest.json", manifest)

    output_path: Path = package_root
    if request["kind"] == "quick":
        output_path = _contained(staging_root, Path(request["quickOutput"]))
        if output_path.exists():
            raise FileExistsError("Quick export output already exists")
        stage = Usd.Stage.Open(str(package_root / "scene.usda"))
        if stage is None:
            raise RuntimeError("Canonical stage could not be opened for flattening")
        stage.Flatten(addSourceFileComment=False).Export(str(output_path))
    result = verify_path(
        output_path,
        graph if request["kind"] == "quick" else None,
        environment_graph if request["kind"] == "quick" else None,
    )
    result.update({"manifest": manifest, "output": str(output_path)})
    _emit(result)
    return 0 if result["ok"] else 1


def _quick_checks(
    path: Path,
    graph: dict[str, Any] | None = None,
    environment_graph: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    from pxr import Usd, UsdGeom, UsdPhysics

    stage = Usd.Stage.Open(str(path))
    checks: list[dict[str, Any]] = []

    def add(check_id: str, passed: bool, evidence: dict[str, Any]) -> None:
        checks.append({"id": check_id, "status": "PASS" if passed else "FAIL", "evidence": evidence})

    add("USD-STAGE-001", stage is not None, {"path": path.name})
    if stage is None:
        return checks
    add(
        "USD-CONVENTION-001",
        UsdGeom.GetStageUpAxis(stage) == UsdGeom.Tokens.z and UsdGeom.GetStageMetersPerUnit(stage) == 1.0,
        {
            "upAxis": UsdGeom.GetStageUpAxis(stage),
            "metersPerUnit": UsdGeom.GetStageMetersPerUnit(stage),
            "defaultPrim": stage.GetDefaultPrim().GetPath().pathString if stage.GetDefaultPrim() else None,
        },
    )
    articulation = any(prim.HasAPI(UsdPhysics.ArticulationRootAPI) for prim in stage.Traverse())
    identified_links = [
        prim for prim in stage.Traverse()
        if prim.GetCustomDataByKey("simforge:linkId") is not None
    ]
    links = [prim for prim in identified_links if prim.HasAPI(UsdPhysics.MassAPI)]
    add(
        "USD-ROBOT-001",
        articulation and (graph is None or len(links) == len(graph["links"])),
        {
            "articulationRoot": articulation,
            "links": len(links),
            "visualAndPhysicsLinkPrims": len(identified_links),
        },
    )
    if environment_graph is not None:
        environment_prims = [
            prim for prim in stage.Traverse()
            if prim.GetCustomDataByKey("simforge:objectId") is not None
        ]
        add(
            "USD-ENVIRONMENT-001",
            len(environment_prims) == len(environment_graph["objects"]),
            {"objects": len(environment_prims), "expectedObjects": len(environment_graph["objects"])},
        )
    add("USD-HASH-001", True, {"sha256": _sha256(path), "bytes": path.stat().st_size})
    return checks


def verify_path(
    path: Path,
    graph: dict[str, Any] | None = None,
    environment_graph: dict[str, Any] | None = None,
) -> dict[str, Any]:
    path = path.resolve()
    if path.is_file():
        checks = _quick_checks(path, graph, environment_graph)
        return {
            "ok": all(check["status"] == "PASS" for check in checks),
            "kind": "quick",
            "path": str(path),
            "checks": checks,
        }
    if not path.is_dir():
        raise FileNotFoundError("Export path does not exist")
    manifest_path = path / "manifest.json"
    manifest = _read_json(manifest_path)
    checks = list(manifest["validation"]["checks"])
    hash_failures: list[str] = []
    for entry in manifest["files"]:
        candidate = _contained(path, path / entry["path"])
        if not candidate.is_file() or candidate.stat().st_size != int(entry["bytes"]) or _sha256(candidate) != entry["sha256"]:
            hash_failures.append(entry["path"])
    checks.append(
        {
            "id": "USD-HASH-001",
            "status": "PASS" if not hash_failures else "FAIL",
            "evidence": {"fileCount": len(manifest["files"]), "failures": hash_failures},
        }
    )
    scene = None
    portability_failures: list[str] = []
    deep_evidence: dict[str, Any] = {}
    try:
        from pxr import Sdf, Usd, UsdGeom, UsdPhysics

        entry_point = _contained(path, path / manifest["entryPoint"])
        scene = Usd.Stage.Open(str(entry_point))
        for entry in manifest["files"]:
            relative = Path(entry["path"])
            if relative.is_absolute() or ".." in relative.parts:
                portability_failures.append(entry["path"])
                continue
            if relative.suffix.lower() not in {".usd", ".usda", ".usdc"}:
                continue
            layer_path = _contained(path, path / relative)
            layer = Sdf.Layer.FindOrOpen(str(layer_path))
            if layer is None:
                portability_failures.append(entry["path"])
                continue
            for reference in list(layer.subLayerPaths) + list(layer.GetExternalReferences()):
                asset = Path(reference)
                if asset.is_absolute() or ".." in asset.parts:
                    portability_failures.append(f"{entry['path']}:{reference}")
                    continue
                resolved = _contained(path, layer_path.parent / asset)
                if not resolved.exists():
                    portability_failures.append(f"{entry['path']}:{reference}")
        if scene is not None:
            traversed = list(scene.Traverse())
            original = {check["id"]: check.get("evidence", {}) for check in checks}
            physics_links = [prim for prim in traversed if prim.HasAPI(UsdPhysics.MassAPI)]
            joints = [prim for prim in traversed if prim.GetCustomDataByKey("simforge:jointId") is not None]
            collisions = [prim for prim in traversed if prim.HasAPI(UsdPhysics.CollisionAPI)]
            materials = [
                prim for prim in traversed
                if prim.GetTypeName() == "Material"
                and prim.GetCustomDataByKey("simforge:materialId") is not None
            ]
            sensors = [prim for prim in traversed if prim.GetCustomDataByKey("simforge:sensorId") is not None]
            articulation = any(prim.HasAPI(UsdPhysics.ArticulationRootAPI) for prim in traversed)
            deep_evidence = {
                "usedLayers": len(scene.GetUsedLayers()),
                "traversedPrims": len(traversed),
                "articulationRoot": articulation,
                "links": len(physics_links),
                "joints": len(joints),
                "collisions": len(collisions),
                "materials": len(materials),
                "sensors": len(sensors),
                "upAxis": UsdGeom.GetStageUpAxis(scene),
                "metersPerUnit": UsdGeom.GetStageMetersPerUnit(scene),
            }
            expected_robot = original.get("USD-ROBOT-001", {})
            expected_physics = original.get("USD-PHYSICS-001", {})
            expected_material = original.get("USD-MATERIAL-001", {})
            expected_sensor = original.get("USD-SENSOR-001", {})
            deep_ok = (
                articulation
                and len(physics_links) == int(expected_robot.get("links", -1))
                and len(joints) == int(expected_robot.get("joints", -1))
                and len(collisions) == int(expected_physics.get("collisions", -1))
                and len(materials) == int(expected_material.get("materials", -1))
                and len(sensors) == int(expected_sensor.get("sensors", -1))
                and UsdGeom.GetStageUpAxis(scene) == UsdGeom.Tokens.z
                and UsdGeom.GetStageMetersPerUnit(scene) == 1.0
            )
            checks.append(
                {
                    "id": "USD-DEEP-REOPEN-001",
                    "status": "PASS" if deep_ok else "FAIL",
                    "evidence": deep_evidence,
                }
            )
    except Exception as error:
        portability_failures.append(f"{type(error).__name__}: {error}")
        scene = None
    checks.append(
        {
            "id": "USD-PORTABILITY-001",
            "status": "PASS" if scene is not None and not portability_failures else "FAIL",
            "evidence": {
                "entryPoint": manifest["entryPoint"],
                "reopenedAtCurrentLocation": scene is not None,
                "failures": portability_failures,
            },
        }
    )
    return {
        "ok": all(check["status"] == "PASS" for check in checks),
        "kind": "canonical",
        "path": str(path),
        "manifest": manifest,
        "checks": checks,
    }


def verify_command(path: Path) -> int:
    result = verify_path(path)
    _emit(result)
    return 0 if result["ok"] else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("doctor")
    spike_parser = subcommands.add_parser("spike")
    spike_parser.add_argument("--output", type=Path, required=True)
    export_parser = subcommands.add_parser("export")
    export_parser.add_argument("--request", type=Path, required=True)
    verify_parser = subcommands.add_parser("verify")
    verify_parser.add_argument("--path", type=Path, required=True)
    arguments = parser.parse_args()
    if arguments.command == "doctor":
        return doctor()
    if arguments.command == "spike":
        return spike(arguments.output)
    if arguments.command == "export":
        return author_export(arguments.request)
    return verify_command(arguments.path)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        _emit({"ok": False, "error": type(error).__name__, "message": str(error)})
        raise SystemExit(1) from error
