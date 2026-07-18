# SPDX-License-Identifier: Apache-2.0
"""Minimal OpenUSD compatibility worker for SimForge's MS1 packaging spike."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, sort_keys=True))


def doctor() -> int:
    try:
        from pxr import Usd

        _emit(
            {
                "ok": True,
                "python": sys.version.split()[0],
                "usdVersion": ".".join(str(value) for value in Usd.GetVersion()),
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
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    root = UsdGeom.Xform.Define(stage, "/World")
    stage.SetDefaultPrim(root.GetPrim())
    root.GetPrim().SetCustomDataByKey("simforge:spike", True)
    stage.GetRootLayer().Save()

    reopened = Usd.Stage.Open(str(output))
    if reopened is None:
        raise RuntimeError("OpenUSD could not reopen the authored layer")
    valid = (
        reopened.GetDefaultPrim().GetPath().pathString == "/World"
        and UsdGeom.GetStageUpAxis(reopened) == UsdGeom.Tokens.z
        and UsdGeom.GetStageMetersPerUnit(reopened) == 1.0
    )
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    _emit(
        {
            "ok": valid,
            "output": str(output),
            "defaultPrim": reopened.GetDefaultPrim().GetPath().pathString,
            "upAxis": UsdGeom.GetStageUpAxis(reopened),
            "metersPerUnit": UsdGeom.GetStageMetersPerUnit(reopened),
            "sha256": digest,
        }
    )
    return 0 if valid else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("doctor")
    spike_parser = subcommands.add_parser("spike")
    spike_parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    if arguments.command == "doctor":
        return doctor()
    return spike(arguments.output)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        _emit({"ok": False, "error": type(error).__name__, "message": str(error)})
        raise SystemExit(1) from error
