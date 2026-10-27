"""Targeted regression tests for procedural tank PBR surfaces.

Run: PYTHONPATH=scripts python -m unittest discover -s tests -p test_tank_pbr.py
"""
import io
import unittest

import numpy as np
import trimesh

from tank_pbr_textures import make_materials, textured_geometry


PALETTE = {
    "tan": "#a8976e",
    "olive": "#485342",
    "steel": "#3f4541",
    "rubber": "#1f2220",
    "blue": "#1c60df",
    "red": "#da2633",
}


def rgba(value):
    value = value.lstrip("#")
    return [int(value[i:i + 2], 16) for i in (0, 2, 4)] + [255]


class TankPBRTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.materials = make_materials(PALETTE, rgba)

    def test_embedded_map_resolution_and_categories(self):
        mats = self.materials
        self.assertEqual(mats["tan"].baseColorTexture.size, (2048, 2048))
        self.assertEqual(mats["tan"].normalTexture.size, (1024, 1024))
        self.assertEqual(mats["tan"].metallicRoughnessTexture.size, (1024, 1024))
        self.assertIsNotNone(mats["steel"].normalTexture)
        self.assertIsNotNone(mats["rubber"].metallicRoughnessTexture)
        self.assertTrue(mats["blue"].doubleSided)
        self.assertTrue(mats["red"].doubleSided)
        self.assertIsNone(mats["blue"].normalTexture)

    def test_face_projections_have_finite_uvs_and_preserve_surface(self):
        source = trimesh.creation.box(extents=(2, 1, 4))
        result = textured_geometry(source, self.materials["tan"])
        self.assertEqual(result.visual.uv.shape, (len(result.vertices), 2))
        self.assertTrue(np.isfinite(result.visual.uv).all())
        np.testing.assert_allclose(result.bounds, source.bounds)
        self.assertAlmostEqual(result.area, source.area, places=4)
        self.assertEqual(len(result.faces), len(source.faces))

    def test_glb_roundtrip_preserves_pbr_materials(self):
        scene = trimesh.Scene()
        for name, material in self.materials.items():
            scene.add_geometry(
                textured_geometry(trimesh.creation.box(), material),
                node_name=name,
            )
        binary = scene.export(file_type="glb")
        result = trimesh.load(io.BytesIO(binary), file_type="glb", force="scene")
        self.assertEqual(len(result.geometry), len(self.materials))
        for geometry in result.geometry.values():
            self.assertIsNotNone(geometry.visual.uv)
        tan = next(
            g.visual.material for g in result.geometry.values()
            if g.visual.material.name == "tan"
        )
        self.assertIsNotNone(tan.normalTexture)
        self.assertIsNotNone(tan.metallicRoughnessTexture)


if __name__ == "__main__":
    unittest.main()
