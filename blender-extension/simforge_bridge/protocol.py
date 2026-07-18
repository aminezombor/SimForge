# SPDX-License-Identifier: GPL-3.0-or-later
"""Versioned length-prefixed JSON framing used by the SimForge bridge."""

from __future__ import annotations

import json
import struct
from typing import Any

MAX_FRAME_BYTES = 1_048_576
PROTOCOL_VERSION = 1


def encode_frame(value: Any) -> bytes:
    payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if len(payload) > MAX_FRAME_BYTES:
        raise ValueError("Bridge frame exceeds size limit")
    return struct.pack(">I", len(payload)) + payload


class FrameDecoder:
    def __init__(self) -> None:
        self._buffer = bytearray()

    def push(self, chunk: bytes) -> list[Any]:
        self._buffer.extend(chunk)
        messages: list[Any] = []
        while len(self._buffer) >= 4:
            size = struct.unpack(">I", self._buffer[:4])[0]
            if size > MAX_FRAME_BYTES:
                raise ValueError("Bridge frame exceeds size limit")
            if len(self._buffer) < 4 + size:
                break
            payload = bytes(self._buffer[4 : 4 + size])
            del self._buffer[: 4 + size]
            messages.append(json.loads(payload.decode("utf-8")))
        return messages
