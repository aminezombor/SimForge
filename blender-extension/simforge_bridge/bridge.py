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
                "scale": list(obj.scale),
                "dimensions": list(obj.dimensions),
                "materialNames": [slot.material.name for slot in obj.material_slots if slot.material],
            }
        )
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "projectId": descriptor.get("projectId", "unknown"),
        "sceneRevision": _revision(),
        "sceneName": bpy.context.scene.name,
        "blenderFile": bpy.data.filepath or None,
        "capturedAt": _utc_now(),
        "objects": objects,
    }


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
