#!/usr/bin/env python3
"""Rebuild user's textured command HQ from verified binary upload chunks.
The source mesh, UVs and 1024/2048 texture resolutions are preserved; large
opaque PNG diffuse maps are encoded as high-quality JPEG to reduce bandwidth.
The grouped RADAR_DISH_PIVOT is the only added scene node.
"""
import base64
import hashlib
import json
import struct
from pathlib import Path

SOURCE = Path(".sandforge-import-hq")
TARGET = Path("src/assets/reborn/buildings-3d/sandforge_feldkommando_textured_plus.glb")
EXPECTED_SIZE = 7783052
EXPECTED_SHA256 = "dc9985641126bae0581257185632ea8993ccf0ce121373ab320937a41272dc2e"
parts = sorted(SOURCE.glob("part_*.b64"))
if len(parts) != 40:
    raise SystemExit(f"Expected 40 upload parts, got {len(parts)}")
payload = b"".join(base64.b64decode(p.read_text().strip(), validate=True) for p in parts)
assert len(payload) == EXPECTED_SIZE, f"Wrong binary size {len(payload)}"
actual = hashlib.sha256(payload).hexdigest()
assert actual == EXPECTED_SHA256, f"Asset SHA256 mismatch {actual}"
assert payload[:4] == b"glTF"
assert struct.unpack_from("<I", payload, 8)[0] == len(payload)
json_len = struct.unpack_from("<I", payload, 12)[0]
gltf = json.loads(payload[20:20+json_len])
assert len(gltf["images"]) == 26, "Missing original PBR texture references"
assert len(gltf["materials"]) == 29, "Missing original texture materials"
assert any(x.get("name") == "RADAR_DISH_PIVOT" for x in gltf["nodes"])
assert any(x.get("name") == "Desert_Camouflage_PBR" for x in gltf["materials"])
assert any(x.get("name") == "DISH_Dish_Porcelain" for x in gltf["nodes"])
TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_bytes(payload)
print(f"Verified new textured headquarters: {len(payload)} bytes; SHA256={actual}")
