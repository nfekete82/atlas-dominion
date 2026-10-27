"""Deterministic embedded PBR textures for Atlas Dominion's Leopard-style MBT.

All materials are glTF 2.0 compatible and self-contained. Face-projected UVs
preserve the existing articulated turret, gun and track components.
"""
from functools import lru_cache

import numpy as np
import trimesh
from PIL import Image, ImageDraw
from trimesh.visual.material import PBRMaterial

CAMO_SIZE = 2048
DETAIL_SIZE = 1024


def _field(rng, size, coarse):
    pixels = rng.integers(0, 256, (coarse, coarse), dtype=np.uint8)
    scaled = Image.fromarray(pixels, "L").resize(
        (size, size), Image.Resampling.BICUBIC
    )
    return np.asarray(scaled, dtype=np.float32) / 255.0


@lru_cache(maxsize=1)
def surfaces():
    rng = np.random.default_rng(17291)
    size = CAMO_SIZE
    broad = _field(rng, size, 7)
    medium = _field(rng, size, 18)
    secondary = _field(rng, size, 9)
    field = broad * .72 + medium * .28

    color = np.empty((size, size, 3), dtype=np.float32)
    color[:] = (157, 144, 109)
    color[field > .52] = (65, 78, 55)
    color[(field < .39) & (secondary > .49)] = (94, 69, 52)
    color[(field > .56) & (secondary > .62)] = (48, 57, 45)

    dust = _field(rng, size, 110)
    dust_alpha = np.clip((dust - .43) * .17, 0, .12)[..., None]
    color = color * (1 - dust_alpha) + np.array([178, 151, 110]) * dust_alpha
    grain = rng.integers(-9, 10, (size, size, 1), dtype=np.int16)
    camo = Image.fromarray(np.clip(color + grain, 0, 255).astype(np.uint8), "RGB")

    # Slight chipping rather than uniformly clean paint.
    marks = ImageDraw.Draw(camo, "RGBA")
    for _ in range(1200):
        x = int(rng.integers(0, size))
        y = int(rng.integers(0, size))
        x2 = min(size - 1, x + int(rng.integers(3, 18)))
        marks.line(
            (x, y, x2, y + int(rng.integers(-2, 3))),
            fill=(218, 191, 143, int(rng.integers(10, 40))),
            width=1,
        )

    size = DETAIL_SIZE
    wear = _field(rng, size, 95)
    micro = rng.integers(0, 256, (size, size), dtype=np.uint8).astype(np.float32) / 255
    grunge = np.clip(
        223 + (wear - .5) * 28 + (micro - .5) * 20, 0, 255
    ).astype(np.uint8)
    neutral_albedo = Image.fromarray(grunge, "L").convert("RGB")

    height = _field(rng, size, 160) * .65 + micro * .35
    dy, dx = np.gradient(height)
    normal = np.dstack((
        np.clip(128 - dx * 220, 0, 255),
        np.clip(128 + dy * 220, 0, 255),
        np.full((size, size), 249),
    )).astype(np.uint8)
    normal_map = Image.fromarray(normal, "RGB")

    # glTF packed metallic/roughness: G = roughness, B = metallic.
    variation = np.clip((wear - .5) * 32 + (micro - .5) * 16, -25, 25)

    def packed(roughness, metallic):
        green = np.clip(roughness + variation, 0, 255).astype(np.uint8)
        return Image.fromarray(np.dstack((
            np.full((size, size), 255, np.uint8),
            green,
            np.full((size, size), metallic, np.uint8),
        )), "RGB")

    return (
        camo, neutral_albedo, normal_map,
        packed(233, 28), packed(191, 216),
        packed(247, 4), packed(250, 0),
    )


def make_materials(palette, rgba):
    camo, grunge, normal, paint_mr, steel_mr, rubber_mr, fabric_mr = surfaces()
    materials = {}
    for name, value in palette.items():
        paint = name in (
            "tan", "tan_light", "sand", "olive",
            "olive_dark", "green", "brown", "rust",
        )
        steel = name in ("track", "steel", "metal", "dark", "wire", "bolt")
        rubber = name == "rubber"
        cloth = name in ("blue", "red", "flag_edge")
        camouflage = name in ("tan", "sand")

        materials[name] = PBRMaterial(
            name=name,
            baseColorFactor=([255, 255, 255, 255] if camouflage else rgba(value)),
            baseColorTexture=(
                camo if camouflage else grunge
                if (paint or steel or rubber or cloth) else None
            ),
            normalTexture=normal if (paint or steel) else None,
            metallicRoughnessTexture=(
                paint_mr if paint else steel_mr if steel
                else rubber_mr if rubber else fabric_mr if cloth else None
            ),
            metallicFactor=.85 if steel else .24 if paint else .03,
            roughnessFactor=.96 if (rubber or cloth) else .94,
            doubleSided=cloth,
        )
    return materials


def textured_geometry(mesh, material):
    """Give every triangle stable local planar UVs without breaking mesh pivots.

    About 0.42 repeats per world metre makes camo patches visible in 192px
    tactical sprites, while 2K albedo/1K normal maps preserve gallery detail.
    """
    points = np.asarray(mesh.vertices, dtype=np.float32)[mesh.faces]
    normal_axis = np.abs(np.asarray(mesh.face_normals)).argmax(axis=1)[:, None]
    u = np.where(normal_axis == 0, points[:, :, 2], points[:, :, 0])
    v = np.where(normal_axis == 1, points[:, :, 2], points[:, :, 1])
    uv = np.stack((u, v), axis=-1).reshape(-1, 2) * .42

    source_normals = np.asarray(mesh.vertex_normals)[mesh.faces].reshape(-1, 3).copy()
    vertices = points.reshape(-1, 3).copy()
    faces = np.arange(len(vertices), dtype=np.int64).reshape(-1, 3)
    result = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    result.vertex_normals = source_normals
    result.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    return result
