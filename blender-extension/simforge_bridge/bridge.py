# SPDX-License-Identifier: GPL-3.0-or-later
"""Loopback-only SimForge bridge. All bpy access stays on Blender's main thread."""

from __future__ import annotations

import json
import hashlib
import os
import queue
import socket
import threading
import time
import traceback
import uuid
from pathlib import Path
from typing import Any

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

from .protocol import FrameDecoder, PROTOCOL_VERSION, encode_frame

_REQUESTS: queue.Queue[dict[str, Any]] = queue.Queue()
_OUTBOUND: queue.Queue[dict[str, Any]] = queue.Queue()
_STOP = threading.Event()
_THREAD: threading.Thread | None = None
_DESCRIPTOR: dict[str, Any] | None = None
_CONNECTED = False
_INTERNAL_MUTATION = False
_SCENE_REVISION = 0
_SESSION_IDS: dict[int, str] = {}


def _runtime_directory() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        raise RuntimeError("LOCALAPPDATA is unavailable")
    return Path(local) / "SimForge" / "runtime"


def _latest_descriptor() -> tuple[Path, dict[str, Any]]:
    directory = _runtime_directory()
    candidates: list[tuple[float, Path, dict[str, Any]]] = []
    for file_path in directory.glob("*.json"):
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            if (
                data.get("protocolVersion") == PROTOCOL_VERSION
                and data.get("projectId")
                and data.get("token")
                and data.get("port")
            ):
                candidates.append((file_path.stat().st_mtime, file_path, data))
        except (OSError, ValueError, TypeError):
            continue
    if not candidates:
        raise RuntimeError("No active SimForge runtime descriptor was found")
    _, path_value, descriptor = max(candidates, key=lambda entry: entry[0])
    if time.time() >= _iso_timestamp(descriptor["expiresAt"]):
        raise RuntimeError("The SimForge runtime descriptor has expired")
    return path_value, descriptor


def _iso_timestamp(value: str) -> float:
    from datetime import datetime

    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def is_connected() -> bool:
    return _CONNECTED


def connect() -> None:
    global _THREAD
    if _THREAD and _THREAD.is_alive():
        return
    _STOP.clear()
    _THREAD = threading.Thread(target=_socket_worker, name="SimForgeBridge", daemon=True)
    _THREAD.start()
    if not bpy.app.timers.is_registered(_process_requests):
        bpy.app.timers.register(_process_requests, first_interval=0.05, persistent=True)


def disconnect() -> None:
    _STOP.set()


def _socket_worker() -> None:
    global _CONNECTED, _DESCRIPTOR, _SCENE_REVISION
    auto_reconnect = os.environ.get("SIMFORGE_AUTO_CONNECT") == "1"
    while not _STOP.is_set():
        try:
            _, descriptor = _latest_descriptor()
            _DESCRIPTOR = descriptor
            _SCENE_REVISION = max(_SCENE_REVISION, int(descriptor.get("revisionFloor", 0)))
            with socket.create_connection(("127.0.0.1", int(descriptor["port"])), timeout=5) as sock:
                sock.settimeout(0.1)
                sock.sendall(
                    encode_frame(
                        {
                            "protocolVersion": PROTOCOL_VERSION,
                            "kind": "handshake",
                            "token": descriptor["token"],
                            "projectId": descriptor["projectId"],
                            "client": "simforge-blender-extension",
                        }
                    )
                )
                decoder = FrameDecoder()
                _CONNECTED = True
                while not _STOP.is_set():
                    try:
                        chunk = sock.recv(65_536)
                        if not chunk:
                            break
                        for message in decoder.push(chunk):
                            if message.get("kind") == "request":
                                _REQUESTS.put(message)
                    except socket.timeout:
                        pass
                    while True:
                        try:
                            sock.sendall(encode_frame(_OUTBOUND.get_nowait()))
                        except queue.Empty:
                            break
        except Exception:
            if not auto_reconnect:
                traceback.print_exc()
        finally:
            _CONNECTED = False
            _DESCRIPTOR = None
        if not auto_reconnect:
            break
        if _STOP.wait(1.0):
            break


def _process_requests() -> float:
    for _ in range(10):
        try:
            request = _REQUESTS.get_nowait()
        except queue.Empty:
            break
        _OUTBOUND.put(_handle_request(request))
    return 0.05


def _handle_request(request: dict[str, Any]) -> dict[str, Any]:
    pre_revision = _revision()
    base = {
        "protocolVersion": PROTOCOL_VERSION,
        "kind": "response",
        "requestId": str(request.get("requestId", "missing")),
        "preRevision": pre_revision,
        "postRevision": pre_revision,
        "changedEntityIds": [],
        "warnings": [],
    }
    try:
        _validate_request(request)
        operation = request["operation"]
        expected = request.get("expectedSceneRevision")
        if operation != "scene.snapshot" and expected is not None and expected != pre_revision:
            raise BridgeOperationError("STALE_SCENE", "Blender scene revision changed")
        result, changed_ids, mutated = _execute(operation, request.get("payload", {}))
        post_revision = _increment_revision() if mutated else _revision()
        return {
            **base,
            "ok": True,
            "postRevision": post_revision,
            "changedEntityIds": changed_ids,
            "result": result,
        }
    except BridgeOperationError as error:
        return {**base, "ok": False, "error": {"code": error.code, "message": str(error)}}
    except Exception as error:
        traceback.print_exc()
        return {
            **base,
            "ok": False,
            "error": {"code": "BLENDER_OPERATION_FAILED", "message": str(error)},
        }


def _validate_request(request: dict[str, Any]) -> None:
    if request.get("protocolVersion") != PROTOCOL_VERSION or request.get("kind") != "request":
        raise BridgeOperationError("INVALID_REQUEST", "Unsupported bridge request")
    if not _DESCRIPTOR or request.get("projectId") != _DESCRIPTOR.get("projectId"):
        raise BridgeOperationError("PROJECT_MISMATCH", "Request project does not match session")
    if _iso_timestamp(request["deadline"]) <= time.time():
        raise BridgeOperationError("DEADLINE_EXCEEDED", "Request deadline passed")


def _execute(operation: str, payload: dict[str, Any]) -> tuple[Any, list[str], bool]:
    global _INTERNAL_MUTATION
    if operation == "scene.snapshot":
        return _snapshot(), [], False
    if operation == "checkpoint.create":
        filepath = _safe_project_path(str(payload.get("filepath", "")))
        filepath.parent.mkdir(parents=True, exist_ok=True)
        if filepath.exists():
            raise BridgeOperationError("CHECKPOINT_EXISTS", "Checkpoint path already exists")
        bpy.ops.wm.save_as_mainfile(filepath=str(filepath), copy=True)
        return {"filepath": str(filepath)}, [], False
    if operation == "checkpoint.restore":
        filepath = _safe_project_path(str(payload.get("filepath", "")))
        destination = _safe_project_path(str(payload.get("destination", "")))
        if not filepath.is_file() or filepath.suffix.lower() != ".blend":
            raise BridgeOperationError("CHECKPOINT_MISSING", "Checkpoint Blender source is unavailable")
        if destination.suffix.lower() != ".blend":
            raise BridgeOperationError("INVALID_DESTINATION", "Restored Blender source requires a .blend destination")
        _INTERNAL_MUTATION = True
        try:
            bpy.ops.wm.open_mainfile(filepath=str(filepath), load_ui=False)
            bpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False)
            bpy.context.view_layer.update()
            return {
                "filepath": str(filepath),
                "destination": str(destination),
                "restored": True,
            }, [], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "object.create_primitive":
        primitive = str(payload.get("primitive", "CUBE")).upper()
        name = str(payload.get("name", "SimForge Primitive"))[:128]
        location = _vector(payload.get("location", [0, 0, 0]))
        _INTERNAL_MUTATION = True
        try:
            operators = {
                "CUBE": bpy.ops.mesh.primitive_cube_add,
                "CYLINDER": bpy.ops.mesh.primitive_cylinder_add,
                "SPHERE": bpy.ops.mesh.primitive_uv_sphere_add,
            }
            operator = operators.get(primitive)
            if operator is None:
                raise BridgeOperationError("INVALID_PRIMITIVE", "Unsupported primitive")
            operator(location=location)
            obj = bpy.context.active_object
            if obj is None:
                raise BridgeOperationError("CREATE_FAILED", "Blender did not create an object")
            obj.name = name
            obj["simforge.id"] = str(uuid.uuid4())
            bpy.context.view_layer.update()
            return {"objectId": obj["simforge.id"], "name": obj.name}, [obj["simforge.id"]], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "object.delete":
        object_id = str(payload.get("objectId", ""))
        obj = _object_by_id(object_id)
        if obj is None:
            raise BridgeOperationError("OBJECT_NOT_FOUND", "Object was not found")
        _INTERNAL_MUTATION = True
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.context.view_layer.update()
            return {"objectId": object_id}, [object_id], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "object.set_location":
        object_id = str(payload.get("objectId", ""))
        obj = _object_by_id(object_id)
        if obj is None:
            raise BridgeOperationError("OBJECT_NOT_FOUND", "Object was not found")
        location = _vector(payload.get("location"))
        _INTERNAL_MUTATION = True
        try:
            previous = list(obj.location)
            obj.location = location
            bpy.context.view_layer.update()
            return {
                "objectId": object_id,
                "previousLocation": previous,
                "location": list(obj.location),
            }, [object_id], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "object.apply_scale":
        object_id = str(payload.get("objectId", ""))
        obj = _object_by_id(object_id)
        if obj is None:
            raise BridgeOperationError("OBJECT_NOT_FOUND", "Object was not found")
        if obj.type != "MESH":
            raise BridgeOperationError("OBJECT_TYPE_UNSUPPORTED", "Scale application requires a mesh object")
        _INTERNAL_MUTATION = True
        selected = list(bpy.context.selected_objects)
        active = bpy.context.view_layer.objects.active
        previous_scale = list(obj.scale)
        try:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            with bpy.context.temp_override(
                object=obj,
                active_object=obj,
                selected_objects=[obj],
                selected_editable_objects=[obj],
            ):
                result = bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            if "FINISHED" not in result:
                raise BridgeOperationError("APPLY_SCALE_FAILED", "Blender did not apply object scale")
            bpy.context.view_layer.update()
            return {
                "objectId": object_id,
                "previousScale": previous_scale,
                "scale": list(obj.scale),
            }, [object_id], True
        finally:
            bpy.ops.object.select_all(action="DESELECT")
            for selected_object in selected:
                if selected_object.name in bpy.context.scene.objects:
                    selected_object.select_set(True)
            if active and active.name in bpy.context.scene.objects:
                bpy.context.view_layer.objects.active = active
            _INTERNAL_MUTATION = False
    if operation == "robot.materialize":
        graph = payload.get("graph")
        _validate_robot_graph(graph)
        robot_id = str(graph["robotId"])
        if any(obj.get("simforge.robot.id") == robot_id for obj in bpy.context.scene.objects):
            raise BridgeOperationError("ROBOT_EXISTS", "A robot with this stable ID already exists")
        _INTERNAL_MUTATION = True
        try:
            result = _materialize_robot(graph)
            bpy.context.view_layer.update()
            return result, result["changedEntityIds"], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "robot.set_link_pose":
        robot_id = str(payload.get("robotId", ""))
        link_id = str(payload.get("linkId", ""))
        reason = str(payload.get("reason", ""))
        obj = next((
            value for value in bpy.context.scene.objects
            if value.get("simforge.robot.id") == robot_id and
            value.get("simforge.role") == "link" and
            value.get("simforge.link.id") == link_id
        ), None)
        if obj is None or not reason:
            raise BridgeOperationError("ROBOT_LINK_NOT_FOUND", "Robot link or displayed reason is missing")
        position = _vector(payload.get("position"))
        rotation = _vector(payload.get("rotationEuler"))
        previous_position = list(obj.matrix_world.translation)
        previous_rotation = list(obj.matrix_world.to_euler())
        scale = obj.matrix_world.to_scale()
        _INTERNAL_MUTATION = True
        try:
            obj.matrix_world = Matrix.LocRotScale(
                Vector(position),
                Euler(rotation).to_quaternion(),
                scale,
            )
            bpy.context.view_layer.update()
            return {
                "robotId": robot_id,
                "linkId": link_id,
                "previousPosition": previous_position,
                "previousRotationEuler": previous_rotation,
                "position": list(obj.matrix_world.translation),
                "rotationEuler": list(obj.matrix_world.to_euler()),
            }, [str(obj["simforge.id"])], True
        finally:
            _INTERNAL_MUTATION = False
    if operation == "preview.generate":
        preview_id = str(payload.get("previewId", ""))
        output_path = _safe_project_path(str(payload.get("outputPath", "")))
        if not preview_id or output_path.suffix.lower() != ".glb":
            raise BridgeOperationError("INVALID_PREVIEW", "Preview identity and .glb destination are required")
        if output_path.exists():
            raise BridgeOperationError("PREVIEW_EXISTS", "Preview output already exists")
        visual_objects = [
            obj for obj in bpy.context.scene.objects
            if obj.type == "MESH" and obj.visible_get() and
            obj.get("simforge.role") != "collision"
        ]
        if not visual_objects:
            raise BridgeOperationError("PREVIEW_EMPTY", "No visible mesh objects are available for preview")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        selected = list(bpy.context.selected_objects)
        active = bpy.context.view_layer.objects.active
        try:
            bpy.ops.object.select_all(action="DESELECT")
            for obj in visual_objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = visual_objects[0]
            export_result = bpy.ops.export_scene.gltf(
                filepath=str(output_path),
                export_format="GLB",
                use_selection=True,
                export_apply=True,
                export_yup=True,
                export_extras=True,
                export_cameras=False,
                export_lights=False,
            )
            if "FINISHED" not in export_result or not output_path.is_file():
                raise BridgeOperationError("PREVIEW_EXPORT_FAILED", "Blender GLB preview export failed")
            return {
                "previewId": preview_id,
                "filepath": str(output_path),
                "objectCount": len(visual_objects),
            }, [], False
        finally:
            bpy.ops.object.select_all(action="DESELECT")
            for selected_object in selected:
                if selected_object.name in bpy.context.scene.objects:
                    selected_object.select_set(True)
            if active and active.name in bpy.context.scene.objects:
                bpy.context.view_layer.objects.active = active
    if operation == "selection.set":
        object_id = str(payload.get("objectId", ""))
        target = next((
            obj for obj in bpy.context.scene.objects
            if str(obj.get("simforge.id", "")) == object_id
        ), None)
        if target is None:
            raise BridgeOperationError("OBJECT_NOT_FOUND", "Selected preview object is unavailable in Blender")
        bpy.ops.object.select_all(action="DESELECT")
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        return {"objectId": object_id, "name": target.name}, [], False
    if operation == "review.render":
        robot_id = str(payload.get("robotId", ""))
        label = str(payload.get("label", ""))
        review_id = str(payload.get("reviewId", ""))
        output_directory = _safe_project_path(str(payload.get("outputDirectory", "")))
        if not robot_id or not label or not review_id:
            raise BridgeOperationError("INVALID_REVIEW", "Review identity and label are required")
        if output_directory.exists():
            raise BridgeOperationError("REVIEW_EXISTS", "Review output directory already exists")
        output_directory.mkdir(parents=True, exist_ok=False)
        files = _render_robot_review(robot_id, output_directory)
        return {
            "robotId": robot_id,
            "reviewId": review_id,
            "label": label,
            "files": files,
            "width": 512,
            "height": 512,
            "materialized": True,
        }, [], False
    if operation == "export.package":
        robot_id = str(payload.get("robotId", ""))
        export_id = str(payload.get("exportId", ""))
        export_kind = str(payload.get("kind", ""))
        staging_directory = _safe_project_path(str(payload.get("stagingDirectory", "")))
        if not robot_id or not export_id or export_kind not in {"quick", "canonical"}:
            raise BridgeOperationError("INVALID_EXPORT", "Export identity, kind, and robot are required")
        if staging_directory.exists():
            raise BridgeOperationError("EXPORT_STAGING_EXISTS", "Export staging directory already exists")
        visual_objects = [
            obj for obj in bpy.context.scene.objects
            if obj.get("simforge.robot.id") == robot_id and
            obj.get("simforge.role") in {"link", "sensor-visual"}
        ]
        if not visual_objects:
            raise BridgeOperationError("ROBOT_NOT_FOUND", "Robot geometry is unavailable for export")
        package_root = staging_directory / "package"
        geometry_path = package_root / "robot" / "geometry" / "robot_geometry.usdc"
        source_path = package_root / "source" / "project.blend"
        geometry_path.parent.mkdir(parents=True, exist_ok=False)
        source_path.parent.mkdir(parents=True, exist_ok=False)
        selected = list(bpy.context.selected_objects)
        active = bpy.context.view_layer.objects.active
        try:
            bpy.ops.object.select_all(action="DESELECT")
            for obj in visual_objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = visual_objects[0]
            source_result = bpy.ops.wm.save_as_mainfile(filepath=str(source_path), copy=True)
            if "FINISHED" not in source_result:
                raise BridgeOperationError("SOURCE_EXPORT_FAILED", "Blender source copy failed")
            export_result = bpy.ops.wm.usd_export(
                filepath=str(geometry_path),
                selected_objects_only=True,
                visible_objects_only=False,
                export_animation=False,
                export_materials=True,
                export_meshes=True,
                export_custom_properties=True,
                custom_properties_namespace="simforge",
                relative_paths=True,
                root_prim_path="/BlenderGeometry",
                meters_per_unit=1.0,
                convert_scene_units="CUSTOM",
            )
            if "FINISHED" not in export_result or not geometry_path.is_file():
                raise BridgeOperationError("USD_GEOMETRY_EXPORT_FAILED", "Blender USD geometry export failed")
            return {
                "exportId": export_id,
                "kind": export_kind,
                "robotId": robot_id,
                "packageRoot": str(package_root),
                "geometryPath": str(geometry_path),
                "sourcePath": str(source_path),
                "geometryObjectCount": len(visual_objects),
            }, [], False
        finally:
            bpy.ops.object.select_all(action="DESELECT")
            for selected_object in selected:
                if selected_object.name in bpy.context.scene.objects:
                    selected_object.select_set(True)
            if active and active.name in bpy.context.scene.objects:
                bpy.context.view_layer.objects.active = active
    if operation == "python.execute":
        script = payload.get("script")
        intent = payload.get("intent")
        script_hash = payload.get("scriptHash")
        declared_paths = payload.get("allowedPaths")
        if not isinstance(script, str) or not script.strip():
            raise BridgeOperationError("INVALID_SCRIPT", "Approved script is empty")
        if not isinstance(intent, str) or not intent.strip():
            raise BridgeOperationError("INVALID_INTENT", "Approved script intent is missing")
        actual_hash = hashlib.sha256(script.encode("utf-8")).hexdigest()
        if script_hash != actual_hash:
            raise BridgeOperationError("SCRIPT_HASH_MISMATCH", "Approved script hash changed")
        if not isinstance(declared_paths, list) or not all(isinstance(value, str) for value in declared_paths):
            raise BridgeOperationError("INVALID_ALLOWED_PATHS", "Approved path declarations are invalid")
        allowed_paths = tuple(str(_safe_project_path(value)) for value in declared_paths)
        _INTERNAL_MUTATION = True
        try:
            exec(
                compile(script, "<simforge-approved>", "exec"),
                {
                    "bpy": bpy,
                    "__name__": "__simforge__",
                    "SIMFORGE_ALLOWED_PATHS": allowed_paths,
                },
            )
            bpy.context.view_layer.update()
            return {"executed": True}, [], True
        finally:
            _INTERNAL_MUTATION = False
    raise BridgeOperationError("OPERATION_UNSUPPORTED", f"Unsupported operation: {operation}")


def _snapshot() -> dict[str, Any]:
    descriptor = _DESCRIPTOR or {}
    objects = []
    for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
        object_id = _object_id(obj)
        objects.append(
            {
                "id": object_id,
                "name": obj.name,
                "type": obj.type,
                "parentId": _object_id(obj.parent) if obj.parent else None,
                "location": list(obj.location),
                "rotation": list(obj.rotation_euler),
                "worldLocation": list(obj.matrix_world.translation),
                "worldRotation": list(obj.matrix_world.to_euler()),
                "scale": list(obj.scale),
                "dimensions": list(obj.dimensions),
                "visible": not obj.hide_get() and not obj.hide_viewport and not obj.hide_render,
                "worldBounds": _world_bounds(obj),
                "mesh": _mesh_evidence(obj),
                "materialNames": [slot.material.name for slot in obj.material_slots if slot.material],
                "metadata": _simforge_metadata(obj),
            }
        )
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "projectId": descriptor.get("projectId", "unknown"),
        "sceneRevision": _revision(),
        "sceneName": bpy.context.scene.name,
        "blenderFile": bpy.data.filepath or None,
        "capturedAt": _utc_now(),
        "unitSystem": bpy.context.scene.unit_settings.system,
        "unitScale": bpy.context.scene.unit_settings.scale_length,
        "lengthUnit": bpy.context.scene.unit_settings.length_unit,
        "upAxis": "Z",
        "externalFiles": _external_files(),
        "objects": objects,
    }


def _world_bounds(obj) -> dict[str, list[float]] | None:
    if obj.type != "MESH" or not obj.bound_box:
        return None
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [min(corner[axis] for corner in corners) for axis in range(3)],
        "max": [max(corner[axis] for corner in corners) for axis in range(3)],
    }


def _mesh_evidence(obj) -> dict[str, int] | None:
    if obj.type != "MESH" or obj.data is None:
        return None
    mesh = obj.data
    working = bmesh.new()
    try:
        working.from_mesh(mesh)
        working.normal_update()
        loose_vertices = sum(1 for vertex in working.verts if not vertex.link_edges)
        non_manifold = sum(1 for edge in working.edges if not edge.is_manifold)
        degenerate_faces = sum(1 for face in working.faces if face.calc_area() <= 1e-12)
        zero_edges = sum(1 for edge in working.edges if edge.calc_length() <= 1e-9)
        normal_issues = sum(1 for face in working.faces if face.normal.length_squared <= 1e-18)
        return {
            "vertexCount": len(working.verts),
            "edgeCount": len(working.edges),
            "polygonCount": len(working.faces),
            "looseVertexCount": loose_vertices,
            "nonManifoldEdgeCount": non_manifold,
            "degenerateFaceCount": degenerate_faces,
            "zeroLengthEdgeCount": zero_edges,
            "normalIssueCount": normal_issues,
        }
    finally:
        working.free()


def _external_files() -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.source != "FILE":
            continue
        raw_path = image.filepath or ""
        resolved = bpy.path.abspath(raw_path) if raw_path else ""
        packed = image.packed_file is not None
        files.append(
            {
                "kind": "image",
                "datablock": image.name,
                "path": raw_path,
                "exists": bool(resolved) and Path(resolved).is_file(),
                "packed": packed,
            }
        )
    return files


def _simforge_metadata(obj) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for key in sorted(value for value in obj.keys() if str(value).startswith("simforge.")):
        value = obj[key]
        if isinstance(value, (str, int, float, bool)) or value is None:
            metadata[str(key)] = value
        elif hasattr(value, "to_list"):
            metadata[str(key)] = list(value.to_list())
        elif isinstance(value, (list, tuple)):
            metadata[str(key)] = list(value)
        else:
            metadata[str(key)] = str(value)
    return metadata


def _validate_robot_graph(graph: Any) -> None:
    if not isinstance(graph, dict) or graph.get("schemaVersion") != 1:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "RobotGraph schema version is unsupported")
    robot_id = graph.get("robotId")
    if not isinstance(robot_id, str) or not robot_id or len(robot_id) > 128:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot stable ID is invalid")
    collections = ("materials", "links", "joints", "sensors")
    limits = {"materials": 64, "links": 256, "joints": 256, "sensors": 128}
    for name in collections:
        values = graph.get(name)
        if not isinstance(values, list) or len(values) > limits[name]:
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", f"RobotGraph {name} are invalid")
    if not graph["links"]:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "RobotGraph requires at least one link")
    for name in ("links", "joints", "sensors", "materials"):
        identifiers = [value.get("id") for value in graph[name] if isinstance(value, dict)]
        if len(identifiers) != len(graph[name]) or any(
            not isinstance(value, str) or not value or len(value) > 128 for value in identifiers
        ) or len(set(identifiers)) != len(identifiers):
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", f"RobotGraph {name} IDs are invalid")
    link_ids = {link["id"] for link in graph["links"]}
    if graph.get("rootLinkId") not in link_ids:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot root link is missing")
    material_ids = {material["id"] for material in graph["materials"]}
    for link in graph["links"]:
        if link.get("materialId") not in material_ids:
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot link material is missing")
        _validate_robot_geometry(link.get("visual"))
        if link.get("collision") is not None:
            _validate_robot_geometry(link.get("collision"))
    for joint in graph["joints"]:
        if joint.get("parentLinkId") not in link_ids or joint.get("childLinkId") not in link_ids:
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot joint link reference is missing")
    for sensor in graph["sensors"]:
        if sensor.get("parentLinkId") not in link_ids:
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot sensor link reference is missing")


def _validate_robot_geometry(geometry: Any) -> None:
    if not isinstance(geometry, dict) or geometry.get("primitive") not in {"BOX", "CYLINDER", "SPHERE"}:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot geometry primitive is invalid")
    primitive = geometry["primitive"]
    if primitive == "BOX":
        size = geometry.get("size")
        if not isinstance(size, list) or len(size) != 3 or any(float(value) <= 0 for value in size):
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot box dimensions are invalid")
    elif primitive == "CYLINDER":
        if float(geometry.get("radius", 0)) <= 0 or float(geometry.get("depth", 0)) <= 0:
            raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot cylinder dimensions are invalid")
    elif float(geometry.get("radius", 0)) <= 0:
        raise BridgeOperationError("INVALID_ROBOT_GRAPH", "Robot sphere radius is invalid")


def _materialize_robot(graph: dict[str, Any]) -> dict[str, Any]:
    robot_id = str(graph["robotId"])
    collection = bpy.data.collections.new(f"SF Robot - {graph['name']}")
    bpy.context.scene.collection.children.link(collection)
    materials = {
        str(spec["id"]): _robot_material(robot_id, spec)
        for spec in graph["materials"]
    }
    collision_material = materials.get("collision-guide") or next(iter(materials.values()))
    changed_ids: list[str] = []

    root = bpy.data.objects.new(str(graph["name"]), None)
    collection.objects.link(root)
    root_id = f"{robot_id}:root"
    _stable_object(root, root_id, robot_id, "robot-root")
    root["simforge.robot.root_link"] = str(graph["rootLinkId"])
    root["simforge.robot.units"] = str(graph["units"])
    root["simforge.robot.coordinate_convention"] = str(graph["coordinateConvention"])
    root["simforge.robot.self_collision_policy"] = str(graph["selfCollision"]["policy"])
    root["simforge.robot.self_collision_note"] = str(graph["selfCollision"]["note"])
    root["simforge.robot.assumptions"] = json.dumps(graph.get("assumptions", []), separators=(",", ":"))
    changed_ids.append(root_id)

    links: dict[str, Any] = {}
    collisions: dict[str, Any] = {}
    for link in graph["links"]:
        pose = link["pose"]
        link_object = _create_robot_geometry(
            collection,
            str(link["name"]),
            link["visual"],
            pose,
            materials[str(link["materialId"])],
        )
        stable_id = f"{robot_id}:link:{link['id']}"
        _stable_object(link_object, stable_id, robot_id, "link")
        link_object["simforge.link.id"] = str(link["id"])
        link_object["simforge.link.dynamic"] = bool(link["dynamic"])
        link_object["simforge.link.material_id"] = str(link["materialId"])
        if link.get("physicsMaterialId"):
            link_object["simforge.link.physics_material_id"] = str(link["physicsMaterialId"])
        _set_physical_metadata(link_object, link)
        links[str(link["id"])] = link_object
        changed_ids.append(stable_id)

        if link.get("collision") is not None:
            collision = _create_robot_geometry(
                collection,
                f"{link['name']} Collision",
                link["collision"],
                pose,
                collision_material,
            )
            collision_id = f"{robot_id}:collision:{link['id']}"
            _stable_object(collision, collision_id, robot_id, "collision")
            collision["simforge.collision.link_id"] = str(link["id"])
            collision.display_type = "WIRE"
            collision.hide_render = True
            collisions[str(link["id"])] = collision
            changed_ids.append(collision_id)

    joints: dict[str, Any] = {}
    for joint in graph["joints"]:
        joint_object = bpy.data.objects.new(str(joint["name"]), None)
        collection.objects.link(joint_object)
        joint_object.empty_display_type = "ARROWS"
        joint_object.empty_display_size = 0.16
        joint_object.location = _vector(joint["origin"]["position"])
        joint_object.rotation_euler = _vector(joint["origin"]["rotationEuler"])
        joint_id = f"{robot_id}:joint:{joint['id']}"
        _stable_object(joint_object, joint_id, robot_id, "joint")
        joint_object["simforge.joint.id"] = str(joint["id"])
        joint_object["simforge.joint.type"] = str(joint["type"])
        joint_object["simforge.joint.parent_link_id"] = str(joint["parentLinkId"])
        joint_object["simforge.joint.child_link_id"] = str(joint["childLinkId"])
        joint_object["simforge.joint.axis"] = [float(value) for value in joint["axis"]]
        if joint.get("limits"):
            joint_object["simforge.joint.limit_lower"] = float(joint["limits"]["lower"])
            joint_object["simforge.joint.limit_upper"] = float(joint["limits"]["upper"])
            joint_object["simforge.joint.effort"] = float(joint["limits"]["effort"])
        if joint.get("drive"):
            joint_object["simforge.joint.drive_mode"] = str(joint["drive"]["mode"])
            joint_object["simforge.joint.drive_max_force"] = float(joint["drive"]["maxForce"])
        joints[str(joint["id"])] = joint_object
        changed_ids.append(joint_id)

    _parent_preserve_world(links[str(graph["rootLinkId"])], root)
    for joint in graph["joints"]:
        joint_object = joints[str(joint["id"])]
        parent_link = links[str(joint["parentLinkId"])]
        child_link = links[str(joint["childLinkId"])]
        _parent_preserve_world(joint_object, parent_link)
        _parent_preserve_world(child_link, joint_object)
    for link_id, collision in collisions.items():
        _parent_preserve_world(collision, links[link_id])

    for sensor in graph["sensors"]:
        sensor_object = bpy.data.objects.new(str(sensor["name"]), None)
        collection.objects.link(sensor_object)
        sensor_object.empty_display_type = "CUBE" if sensor["type"] == "IMU" else "CONE"
        sensor_object.empty_display_size = 0.12
        sensor_object.location = _vector(sensor["pose"]["position"])
        sensor_object.rotation_euler = _vector(sensor["pose"]["rotationEuler"])
        sensor_id = f"{robot_id}:sensor:{sensor['id']}"
        _stable_object(sensor_object, sensor_id, robot_id, "sensor")
        sensor_object["simforge.sensor.id"] = str(sensor["id"])
        sensor_object["simforge.sensor.type"] = str(sensor["type"])
        sensor_object["simforge.sensor.parent_link_id"] = str(sensor["parentLinkId"])
        if sensor.get("fieldOfViewDegrees") is not None:
            sensor_object["simforge.sensor.field_of_view_degrees"] = float(sensor["fieldOfViewDegrees"])
        _parent_preserve_world(sensor_object, links[str(sensor["parentLinkId"])])
        changed_ids.append(sensor_id)

        sensor_visual = _create_sensor_visual(
            collection,
            sensor,
            materials.get("sensor-amber") or next(iter(materials.values())),
        )
        sensor_visual_id = f"{sensor_id}:visual"
        _stable_object(sensor_visual, sensor_visual_id, robot_id, "sensor-visual")
        sensor_visual["simforge.sensor.id"] = str(sensor["id"])
        sensor_visual["simforge.sensor.type"] = str(sensor["type"])
        _parent_preserve_world(sensor_visual, sensor_object)
        changed_ids.append(sensor_visual_id)

    return {
        "robotId": robot_id,
        "rootObjectId": root_id,
        "linkCount": len(graph["links"]),
        "jointCount": len(graph["joints"]),
        "sensorCount": len(graph["sensors"]),
        "collisionCount": len(collisions),
        "changedEntityIds": changed_ids,
    }


def _robot_material(robot_id: str, spec: dict[str, Any]):
    name = f"SF {robot_id} - {spec['name']}"
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = tuple(float(value) for value in spec["baseColor"])
    material.metallic = float(spec["metallic"])
    material.roughness = float(spec["roughness"])
    return material


def _create_robot_geometry(collection, name: str, geometry: dict[str, Any], pose: dict[str, Any], material):
    location = _vector(pose["position"])
    rotation = _vector(pose["rotationEuler"])
    primitive = geometry["primitive"]
    if primitive == "BOX":
        bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
        obj = bpy.context.active_object
        obj.dimensions = _vector(geometry["size"])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    elif primitive == "CYLINDER":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=48,
            radius=float(geometry["radius"]),
            depth=float(geometry["depth"]),
            location=location,
            rotation=rotation,
        )
        obj = bpy.context.active_object
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=32,
            ring_count=16,
            radius=float(geometry["radius"]),
            location=location,
            rotation=rotation,
        )
        obj = bpy.context.active_object
    if obj is None:
        raise BridgeOperationError("ROBOT_BUILD_FAILED", "Blender did not create robot geometry")
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def _create_sensor_visual(collection, sensor: dict[str, Any], material):
    pose = sensor["pose"]
    sensor_type = str(sensor["type"])
    dimensions = [0.18, 0.13, 0.12] if sensor_type == "CAMERA" else [0.11, 0.11, 0.08]
    return _create_robot_geometry(
        collection,
        f"{sensor['name']} Visual",
        {"primitive": "BOX", "size": dimensions},
        pose,
        material,
    )


def _stable_object(obj, stable_id: str, robot_id: str, role: str) -> None:
    obj["simforge.id"] = stable_id
    obj["simforge.robot.id"] = robot_id
    obj["simforge.role"] = role


def _set_physical_metadata(obj, link: dict[str, Any]) -> None:
    mass = link["massKg"]
    obj["simforge.mass.source"] = str(mass["source"])
    obj["simforge.mass.note"] = str(mass["note"])
    if mass.get("value") is not None:
        obj["simforge.mass.kg"] = float(mass["value"])
    center = link["centerOfMassM"]
    obj["simforge.center_of_mass.source"] = str(center["source"])
    obj["simforge.center_of_mass.note"] = str(center["note"])
    if center.get("value") is not None:
        obj["simforge.center_of_mass.m"] = [float(value) for value in center["value"]]
    inertia = link["inertiaDiagonalKgM2"]
    obj["simforge.inertia.source"] = str(inertia["source"])
    obj["simforge.inertia.note"] = str(inertia["note"])
    if inertia.get("value") is not None:
        obj["simforge.inertia.diagonal_kg_m2"] = [float(value) for value in inertia["value"]]


def _parent_preserve_world(child, parent) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def _render_robot_review(robot_id: str, output_directory: Path) -> list[dict[str, str]]:
    visual_objects = [
        obj for obj in bpy.context.scene.objects
        if obj.get("simforge.robot.id") == robot_id and obj.get("simforge.role") == "link"
    ]
    if not visual_objects:
        raise BridgeOperationError("ROBOT_NOT_FOUND", "Robot visual links are unavailable for review")
    if any(not obj.material_slots or not any(slot.material for slot in obj.material_slots) for obj in visual_objects):
        raise BridgeOperationError("MATERIALS_REQUIRED", "Materialized review rejects material-less robot links")

    scene = bpy.context.scene
    original = {
        "camera": scene.camera,
        "engine": scene.render.engine,
        "filepath": scene.render.filepath,
        "file_format": scene.render.image_settings.file_format,
        "resolution_x": scene.render.resolution_x,
        "resolution_y": scene.render.resolution_y,
        "resolution_percentage": scene.render.resolution_percentage,
        "film_transparent": scene.render.film_transparent,
        "world_color": tuple(scene.world.color) if scene.world else None,
    }
    temporary_objects: list[Any] = []
    temporary_data: list[Any] = []
    temporary_materials: list[Any] = []
    try:
        bounds = [_world_bounds(obj) for obj in visual_objects]
        valid_bounds = [value for value in bounds if value]
        minimum = Vector([min(value["min"][axis] for value in valid_bounds) for axis in range(3)])
        maximum = Vector([max(value["max"][axis] for value in valid_bounds) for axis in range(3)])
        center = (minimum + maximum) * 0.5
        radius = max((maximum - minimum).length, 1.0)

        camera_data = bpy.data.cameras.new(f"SF Review Camera {output_directory.name}")
        camera = bpy.data.objects.new("SF Review Camera", camera_data)
        scene.collection.objects.link(camera)
        temporary_objects.append(camera)
        temporary_data.append(camera_data)
        camera_data.lens = 52
        scene.camera = camera

        ground_material = bpy.data.materials.new("SF Review Ground")
        ground_material.diffuse_color = (0.055, 0.075, 0.09, 1)
        ground_material.roughness = 0.82
        temporary_materials.append(ground_material)
        bpy.ops.mesh.primitive_plane_add(size=max(radius * 8, 12), location=(center.x, center.y, 0))
        ground = bpy.context.active_object
        ground.name = "SF Review Ground"
        ground.data.materials.append(ground_material)
        temporary_objects.append(ground)
        temporary_data.append(ground.data)

        for name, location, energy, size in (
            ("Key", center + Vector((radius * 1.4, -radius * 1.4, radius * 1.8)), 1100, 4.0),
            ("Fill", center + Vector((-radius, radius * 1.2, radius)), 650, 3.0),
            ("Rim", center + Vector((-radius * 1.2, -radius, radius * 1.5)), 850, 2.5),
        ):
            light_data = bpy.data.lights.new(f"SF Review {name}", type="AREA")
            light_data.energy = energy
            light_data.shape = "DISK"
            light_data.size = size
            light = bpy.data.objects.new(f"SF Review {name}", light_data)
            scene.collection.objects.link(light)
            light.location = location
            _look_at(light, center)
            temporary_objects.append(light)
            temporary_data.append(light_data)

        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.render.image_settings.file_format = "PNG"
        scene.render.resolution_x = 512
        scene.render.resolution_y = 512
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        if scene.world:
            scene.world.color = (0.012, 0.018, 0.028)

        views = [
            ("three-quarter", center + Vector((radius * 1.35, -radius * 1.35, radius * 0.9)), center),
            ("front", center + Vector((radius * 1.9, 0, radius * 0.35)), center),
            ("side", center + Vector((0, -radius * 1.9, radius * 0.35)), center),
            ("close-up", center + Vector((radius, -radius, radius * 0.55)), center + Vector((0.15, 0, 0.05))),
        ]
        sensor = next((
            obj for obj in bpy.context.scene.objects
            if obj.get("simforge.robot.id") == robot_id and obj.get("simforge.sensor.type") == "CAMERA"
            and obj.get("simforge.role") == "sensor-visual"
        ), None)
        if sensor is not None:
            sensor_position = sensor.matrix_world.translation.copy()
            views.append((
                "sensor",
                sensor_position + Vector((radius * 1.05, -radius * 1.05, radius * 0.72)),
                sensor_position,
            ))

        results: list[dict[str, str]] = []
        for name, location, target in views:
            camera.location = location
            _look_at(camera, target)
            filename = f"{name}.png"
            scene.render.filepath = str(output_directory / filename)
            bpy.ops.render.render(write_still=True)
            results.append({"view": name, "filepath": str(output_directory / filename)})
        return results
    finally:
        scene.camera = original["camera"]
        scene.render.engine = original["engine"]
        scene.render.filepath = original["filepath"]
        scene.render.image_settings.file_format = original["file_format"]
        scene.render.resolution_x = original["resolution_x"]
        scene.render.resolution_y = original["resolution_y"]
        scene.render.resolution_percentage = original["resolution_percentage"]
        scene.render.film_transparent = original["film_transparent"]
        if scene.world and original["world_color"] is not None:
            scene.world.color = original["world_color"]
        for obj in reversed(temporary_objects):
            if obj.name in bpy.data.objects:
                bpy.data.objects.remove(obj, do_unlink=True)
        for data in temporary_data:
            if isinstance(data, bpy.types.Camera) and data.name in bpy.data.cameras:
                bpy.data.cameras.remove(data)
            elif isinstance(data, bpy.types.Light) and data.name in bpy.data.lights:
                bpy.data.lights.remove(data)
            elif isinstance(data, bpy.types.Mesh) and data.name in bpy.data.meshes:
                bpy.data.meshes.remove(data)
        for material in temporary_materials:
            if material.name in bpy.data.materials:
                bpy.data.materials.remove(material)


def _look_at(obj, target: Vector) -> None:
    direction = target - obj.location
    if direction.length <= 1e-9:
        return
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _safe_project_path(raw: str) -> Path:
    if not raw or not _DESCRIPTOR:
        raise BridgeOperationError("INVALID_PATH", "Checkpoint path is missing")
    root = Path(str(_DESCRIPTOR["projectRoot"])).resolve()
    target = Path(raw).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise BridgeOperationError("PATH_OUTSIDE_PROJECT", "Checkpoint path is outside the project") from error
    return target


def _vector(value: Any) -> tuple[float, float, float]:
    if not isinstance(value, list) or len(value) != 3:
        raise BridgeOperationError("INVALID_VECTOR", "Expected a three-value vector")
    return tuple(float(entry) for entry in value)


def _object_by_id(object_id: str):
    return next((obj for obj in bpy.context.scene.objects if _object_id(obj) == object_id), None)


def _object_id(obj) -> str:
    persistent = obj.get("simforge.id")
    if persistent:
        return str(persistent)
    pointer = int(obj.as_pointer())
    if pointer not in _SESSION_IDS:
        _SESSION_IDS[pointer] = str(uuid.uuid4())
    return _SESSION_IDS[pointer]


def _revision() -> int:
    return _SCENE_REVISION


def _increment_revision() -> int:
    global _SCENE_REVISION
    _SCENE_REVISION += 1
    return _SCENE_REVISION


def depsgraph_update_handler(_scene, depsgraph) -> None:
    if _INTERNAL_MUTATION or not _CONNECTED:
        return
    changed_ids: list[str] = []
    for update in depsgraph.updates:
        obj = getattr(update, "id", None)
        if isinstance(obj, bpy.types.Object):
            changed_ids.append(_object_id(obj))
    if not changed_ids:
        return
    revision = _increment_revision()
    descriptor = _DESCRIPTOR or {}
    _OUTBOUND.put(
        {
            "protocolVersion": PROTOCOL_VERSION,
            "kind": "event",
            "eventId": str(uuid.uuid4()),
            "projectId": descriptor.get("projectId", "unknown"),
            "sceneRevision": revision,
            "eventType": "scene.changed",
            "changedEntityIds": sorted(set(changed_ids)),
            "summary": "Manual Blender edit detected",
        }
    )


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class BridgeOperationError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
