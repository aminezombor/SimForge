# SPDX-License-Identifier: Apache-2.0
"""Fixed, local-only NVIDIA Isaac Sim worker for SimForge.

The desktop launches this file with a discovered Python 3.12 Isaac Sim runtime and
validated file arguments. It never downloads assets, executes project scripts, or
writes outside the supplied experiment directory.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any


RESULT_PREFIX = "SIMFORGE_RESULT:"


def _emit(value: dict[str, Any]) -> None:
    print(f"{RESULT_PREFIX}{json.dumps(value, sort_keys=True)}", flush=True)


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


def _contained(root: Path, candidate: Path) -> Path:
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    if resolved_candidate != resolved_root and resolved_root not in resolved_candidate.parents:
        raise ValueError(f"Path escaped the approved experiment root: {resolved_candidate}")
    return resolved_candidate


def _relative_entry(value: object) -> Path:
    if not isinstance(value, str) or not value:
        raise ValueError("entryPoint must be a non-empty relative path")
    candidate = Path(value)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("entryPoint must stay inside the copied package")
    return candidate


def doctor() -> int:
    try:
        version = importlib.metadata.version("isaacsim")
        _emit(
            {
                "ok": True,
                "product": "NVIDIA Isaac Sim",
                "version": version,
                "python": sys.version.split()[0],
                "pythonExecutable": str(Path(sys.executable).resolve()),
                "eulaAcceptedForRun": os.environ.get("OMNI_KIT_ACCEPT_EULA") == "YES",
            }
        )
        return 0
    except Exception as error:
        _emit({"ok": False, "error": type(error).__name__, "message": str(error)})
        return 1


def _vector(value: Any) -> list[float]:
    return [float(value[0]), float(value[1]), float(value[2])]


def _world_position(prim: Any) -> list[float]:
    from pxr import Usd, UsdGeom

    matrix = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
    return _vector(matrix.ExtractTranslation())


def _project_view(stage: Any) -> tuple[list[float], list[float]]:
    from pxr import Usd, UsdGeom

    try:
        cache = UsdGeom.BBoxCache(
            Usd.TimeCode.Default(),
            [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy],
        )
        bounds = cache.ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()
        minimum = _vector(bounds.GetMin())
        maximum = _vector(bounds.GetMax())
        values = minimum + maximum
        if not all(math.isfinite(value) and abs(value) < 100_000 for value in values):
            raise ValueError("Project bounds are not finite")
        size = [maximum[index] - minimum[index] for index in range(3)]
        span = max(max(size), 1.5)
        center = [(minimum[index] + maximum[index]) / 2 for index in range(3)]
        target = [center[0], center[1], max(minimum[2] + span * 0.12, center[2])]
        distance = max(4.5, span * 1.15)
        eye = [center[0] + distance * 0.72, center[1] - distance, center[2] + distance * 0.62]
        return eye, target
    except Exception:
        return [5.0, -6.0, 4.0], [0.0, 0.0, 0.75]


def _create_probe(stage: Any, camera_eye: list[float], camera_target: list[float]) -> tuple[Any, Any]:
    from pxr import Gf, UsdGeom, UsdLux, UsdPhysics

    session = stage.GetSessionLayer()
    stage.SetEditTarget(session)
    world = stage.GetPrimAtPath("/World")
    if not world:
        world = UsdGeom.Xform.Define(stage, "/World").GetPrim()
        stage.SetDefaultPrim(world)

    physics_scene = UsdPhysics.Scene.Define(stage, "/World/SimForgePhysicsScene")
    physics_scene.CreateGravityDirectionAttr(Gf.Vec3f(0.0, 0.0, -1.0))
    physics_scene.CreateGravityMagnitudeAttr(9.81)

    ground = UsdGeom.Cube.Define(stage, "/World/SimForgeGround")
    ground.CreateSizeAttr(1.0)
    ground.AddTranslateOp().Set(Gf.Vec3d(0.0, 0.0, -0.05))
    ground.AddScaleOp().Set(Gf.Vec3d(20.0, 20.0, 0.1))
    UsdPhysics.CollisionAPI.Apply(ground.GetPrim())

    probe = UsdGeom.Cube.Define(stage, "/World/SimForgeProbe")
    probe.CreateSizeAttr(0.5)
    probe.CreateDisplayColorAttr([(0.06, 0.78, 0.65)])
    # Keep the fixed runtime probe outside authored project geometry so its
    # health metric cannot be contaminated by a robot or environment collision.
    probe.AddTranslateOp().Set(Gf.Vec3d(-6.0, -6.0, 2.0))
    UsdPhysics.CollisionAPI.Apply(probe.GetPrim())
    UsdPhysics.RigidBodyAPI.Apply(probe.GetPrim())
    UsdPhysics.MassAPI.Apply(probe.GetPrim()).CreateMassAttr(1.0)

    camera = UsdGeom.Camera.Define(stage, "/World/SimForgeExperimentCamera")
    camera.CreateFocalLengthAttr(32.0)
    camera_matrix = Gf.Matrix4d().SetLookAt(
        Gf.Vec3d(*camera_eye),
        Gf.Vec3d(*camera_target),
        Gf.Vec3d(0.0, 0.0, 1.0),
    ).GetInverse()
    UsdGeom.Xformable(camera.GetPrim()).MakeMatrixXform().Set(camera_matrix)

    light = UsdLux.DistantLight.Define(stage, "/World/SimForgeKeyLight")
    light.CreateIntensityAttr(3500.0)
    light.CreateAngleAttr(0.8)
    light.AddRotateXYZOp().Set(Gf.Vec3f(35.0, 20.0, -25.0))
    return probe.GetPrim(), camera.GetPrim()


def _capture(app: Any, camera_path: str, output: Path) -> bool:
    from omni.kit.viewport.utility import capture_viewport_to_file, get_active_viewport

    viewport = get_active_viewport()
    if viewport is None:
        return False
    viewport.camera_path = camera_path
    for _ in range(16):
        app.update()
    capture = capture_viewport_to_file(viewport, file_path=str(output), is_hdr=False)
    for _ in range(180):
        app.update()
        if output.is_file() and output.stat().st_size > 0:
            return True
        time.sleep(0.01)
    del capture
    return output.is_file() and output.stat().st_size > 0


def _robot_stability(stage: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    from pxr import UsdPhysics

    links: list[dict[str, Any]] = []
    for prim in stage.Traverse():
        link_id = prim.GetCustomDataByKey("simforge:linkId")
        world_position = prim.GetCustomDataByKey("simforge:worldPositionM")
        if not isinstance(link_id, str) or world_position is None:
            continue
        mass = UsdPhysics.MassAPI(prim).GetMassAttr().Get()
        if mass is None or float(mass) <= 0:
            continue
        links.append({"id": link_id, "massKg": float(mass), "positionM": _vector(world_position)})
    support = [
        link for link in links
        if "wheel" in link["id"].lower() or "caster" in link["id"].lower()
    ]
    if not links or len(support) < 3:
        evidence = {
            "applicable": False,
            "reason": "At least three mass-authored wheel/caster support links are required.",
            "massAuthoredLinkCount": len(links),
            "supportLinkIds": [link["id"] for link in support],
        }
        return {"id": "ISAAC-STABILITY-001", "status": "WARN", "evidence": evidence}, evidence

    total_mass = sum(link["massKg"] for link in links)
    center = [
        sum(link["massKg"] * link["positionM"][axis] for link in links) / total_mass
        for axis in range(3)
    ]
    bounds = {
        "minX": min(link["positionM"][0] for link in support),
        "maxX": max(link["positionM"][0] for link in support),
        "minY": min(link["positionM"][1] for link in support),
        "maxY": max(link["positionM"][1] for link in support),
    }
    margin = 0.01
    stable = (
        bounds["minX"] + margin <= center[0] <= bounds["maxX"] - margin
        and bounds["minY"] + margin <= center[1] <= bounds["maxY"] - margin
    )
    candidate = "arm_column_link" if any(link["id"] == "arm_column_link" for link in links) else max(
        (link for link in links if link not in support),
        key=lambda link: link["massKg"] * abs(link["positionM"][0] - center[0]),
        default=links[0],
    )["id"]
    evidence = {
        "applicable": True,
        "centerOfMassM": center,
        "supportBoundsM": bounds,
        "requiredInsetM": margin,
        "totalMassKg": total_mass,
        "massAuthoredLinkCount": len(links),
        "supportLinkIds": [link["id"] for link in support],
        "recommendedCorrection": {
            "strategy": "RETRACT_SUBTREE",
            "rootLinkId": candidate,
            "targetCenterOfMassXMaxM": bounds["maxX"] - 0.02,
        },
    }
    return {"id": "ISAAC-STABILITY-001", "status": "PASS" if stable else "FAIL", "evidence": evidence}, evidence


def run(request_path: Path) -> int:
    request_path = request_path.resolve()
    request = _read_json(request_path)
    experiment_root = Path(str(request["experimentRoot"])).resolve()
    _contained(experiment_root, request_path)
    package_root = _contained(experiment_root, Path(str(request["packageRoot"])))
    output_root = _contained(experiment_root, Path(str(request["outputRoot"])))
    entry_point = _contained(package_root, package_root / _relative_entry(request["entryPoint"]))
    if not entry_point.is_file():
        raise FileNotFoundError("Copied canonical USD entry point is missing")

    task = request.get("task")
    if not isinstance(task, dict) or task.get("id") != "static-settle-v1":
        raise ValueError("Only the fixed static-settle-v1 task is supported")
    steps = int(task.get("steps", 240))
    if steps < 60 or steps > 600:
        raise ValueError("Simulation steps must be between 60 and 600")
    output_root.mkdir(parents=True, exist_ok=False)
    media_root = output_root / "media"
    media_root.mkdir()
    started_at = time.time()

    # SimulationApp must be imported and constructed before importing omni or pxr.
    from isaacsim import SimulationApp

    app = SimulationApp(
        {
            "headless": True,
            "fast_shutdown": True,
            "width": 960,
            "height": 540,
            "window_width": 960,
            "window_height": 540,
            "multi_gpu": False,
            "anti_aliasing": 0,
            "limit_cpu_threads": 8,
            "enable_crashreporter": False,
            "extra_args": [
                "--/telemetry/enableAnonymousData=false",
                "--/telemetry/useOpenEndpoint=false",
                "--/telemetry/enableNVDF=false",
                "--/telemetry/enableSentry=false",
            ],
        }
    )

    import omni.timeline
    import omni.usd
    from pxr import UsdPhysics

    context = omni.usd.get_context()
    if not context.open_stage(str(entry_point)):
        raise RuntimeError("Isaac Sim could not open the copied canonical USD stage")
    for _ in range(12):
        app.update()
    stage = context.get_stage()
    if stage is None:
        raise RuntimeError("Isaac Sim returned no stage after opening the canonical package")

    source_prim_count = sum(1 for _ in stage.Traverse())
    source_link_count = sum(
        1 for prim in stage.Traverse() if prim.GetCustomDataByKey("simforge:linkId") is not None
    )
    source_articulation_count = sum(
        1 for prim in stage.Traverse() if prim.HasAPI(UsdPhysics.ArticulationRootAPI)
    )
    stability_check, stability_metrics = _robot_stability(stage)
    camera_eye, camera_target = _project_view(stage)
    probe, camera = _create_probe(stage, camera_eye, camera_target)
    initial = _world_position(probe)
    camera_path = camera.GetPath().pathString
    captured_media: list[Path] = []
    initial_media = media_root / "frame-000.png"
    if _capture(app, camera_path, initial_media):
        captured_media.append(initial_media)

    timeline = omni.timeline.get_timeline_interface()
    timeline.set_time_codes_per_second(60.0)
    timeline.play()
    samples: list[list[float]] = []
    capture_steps = {max(1, round(steps * fraction / 4)) for fraction in range(1, 5)}
    frame_index = 1
    for index in range(steps):
        app.update()
        if index % 15 == 0 or index == steps - 1:
            samples.append(_world_position(probe))
        if index + 1 in capture_steps:
            timeline.pause()
            frame_path = media_root / f"frame-{frame_index:03d}.png"
            if _capture(app, camera_path, frame_path):
                captured_media.append(frame_path)
            frame_index += 1
            if index + 1 < steps:
                timeline.play()
    timeline.pause()
    for _ in range(8):
        app.update()
    final = _world_position(probe)
    media_path = captured_media[-1] if captured_media else media_root / "frame-final.png"
    media_captured = bool(captured_media) or _capture(app, camera_path, media_path)
    if media_captured and not captured_media:
        captured_media.append(media_path)

    finite = all(math.isfinite(value) for point in samples + [initial, final] for value in point)
    vertical_drop = initial[2] - final[2]
    settled_height_error = abs(final[2] - 0.25)
    lateral_drift = math.hypot(final[0] - initial[0], final[1] - initial[1])
    checks = [
        {
            "id": "ISAAC-STAGE-001",
            "status": "PASS" if source_prim_count > 0 else "FAIL",
            "evidence": {
                "entryPoint": request["entryPoint"],
                "sourcePrimCount": source_prim_count,
                "robotLinkPrims": source_link_count,
                "articulationRoots": source_articulation_count,
            },
        },
        stability_check,
        {
            "id": "ISAAC-PHYSICS-001",
            "status": "PASS" if finite and vertical_drop > 1.0 and settled_height_error <= 0.08 else "FAIL",
            "evidence": {
                "steps": steps,
                "initialPositionM": initial,
                "finalPositionM": final,
                "verticalDropM": vertical_drop,
                "settledHeightErrorM": settled_height_error,
                "lateralDriftM": lateral_drift,
                "finite": finite,
            },
        },
        {
            "id": "ISAAC-MEDIA-001",
            "status": "PASS" if media_captured else "FAIL",
            "evidence": {
                "frameCount": len(captured_media),
                "relativePath": f"media/{media_path.name}",
                "bytes": sum(path.stat().st_size for path in captured_media),
                "sha256": _sha256(media_path) if media_captured else None,
            },
        },
    ]
    status = "PASSED" if not any(check["status"] == "FAIL" for check in checks) else "FAILED"
    result = {
        "schemaVersion": 1,
        "experimentId": request["experimentId"],
        "task": {
            "id": "static-settle-v1",
            "seed": int(task.get("seed", 20260719)),
            "steps": steps,
            "timeCodesPerSecond": 60,
        },
        "status": status,
        "source": {
            "entryPoint": request["entryPoint"],
            "entryPointSha256": _sha256(entry_point),
            "primCount": source_prim_count,
            "robotLinkPrims": source_link_count,
            "articulationRoots": source_articulation_count,
        },
        "metrics": {
            "initialPositionM": initial,
            "finalPositionM": final,
            "verticalDropM": vertical_drop,
            "settledHeightErrorM": settled_height_error,
            "lateralDriftM": lateral_drift,
            "sampleCount": len(samples),
            "robotStability": stability_metrics,
        },
        "checks": checks,
        "media": [
            {
                "relativePath": f"media/{path.name}",
                "sha256": _sha256(path),
                "bytes": path.stat().st_size,
            }
            for path in captured_media
        ],
        "runtime": {
            "product": "NVIDIA Isaac Sim",
            "version": importlib.metadata.version("isaacsim"),
            "python": sys.version.split()[0],
            "headless": True,
            "telemetryConsentAddedBySimForge": False,
        },
        "durationSeconds": round(time.time() - started_at, 3),
    }
    result_path = output_root / "result.json"
    _write_json(result_path, result)
    _emit({"ok": status == "PASSED", "resultPath": str(result_path), "result": result})

    # Isaac Sim 6.0.1 can raise a native access violation during Windows teardown
    # after all outputs are safely flushed. This worker is process-isolated, so a
    # direct process exit is the deterministic boundary and leaves no parent state.
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0 if status == "PASSED" else 2)


def view(request_path: Path) -> int:
    request_path = request_path.resolve()
    request = _read_json(request_path)
    experiment_root = Path(str(request["experimentRoot"])).resolve()
    _contained(experiment_root, request_path)
    package_root = _contained(experiment_root, Path(str(request["packageRoot"])))
    entry_point = _contained(package_root, package_root / _relative_entry(request["entryPoint"]))
    if not entry_point.is_file():
        raise FileNotFoundError("Copied canonical USD entry point is missing")

    from isaacsim import SimulationApp

    app = SimulationApp(
        {
            "headless": False,
            "fast_shutdown": False,
            "window_width": 1280,
            "window_height": 800,
            "multi_gpu": False,
            "limit_cpu_threads": 8,
            "enable_crashreporter": False,
            "extra_args": [
                "--/telemetry/enableAnonymousData=false",
                "--/telemetry/useOpenEndpoint=false",
                "--/telemetry/enableNVDF=false",
                "--/telemetry/enableSentry=false",
            ],
        }
    )

    import omni.timeline
    import omni.usd
    from omni.kit.viewport.utility import get_active_viewport

    context = omni.usd.get_context()
    if not context.open_stage(str(entry_point)):
        raise RuntimeError("Isaac Sim could not open the copied canonical USD stage")
    for _ in range(16):
        app.update()
    stage = context.get_stage()
    if stage is None:
        raise RuntimeError("Isaac Sim returned no interactive stage")
    camera_eye, camera_target = _project_view(stage)
    _, camera = _create_probe(stage, camera_eye, camera_target)
    viewport = get_active_viewport()
    if viewport is not None:
        viewport.camera_path = camera.GetPath().pathString
    timeline = omni.timeline.get_timeline_interface()
    timeline.set_time_codes_per_second(60.0)
    timeline.play()
    while app.is_running():
        app.update()
    timeline.stop()
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)


def main() -> int:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor")
    run_parser = commands.add_parser("run")
    run_parser.add_argument("--request", type=Path, required=True)
    view_parser = commands.add_parser("view")
    view_parser.add_argument("--request", type=Path, required=True)
    arguments = parser.parse_args()
    if arguments.command == "doctor":
        return doctor()
    return view(arguments.request) if arguments.command == "view" else run(arguments.request)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        _emit({"ok": False, "error": type(error).__name__, "message": str(error)})
        raise SystemExit(1) from error
