# Leopard-inspired Kampfpanzer (Atlas Dominion Reborn)

Original procedural 3D reconstruction inspired by the supplied tank reference.
The model is **not** a licensed or extracted tank mesh.

## Faction assets

- `src/assets/reborn/animation/tank-0.glb`: woodland camouflage, blue roof pennant.
- `src/assets/reborn/animation/tank-1.glb`: same chassis, red roof pennant.
- `tank-{team}.png` / `.json`: runtime vehicle atlas for 16 orientations and movement/turn phases.

The 3D gallery loads the faction GLBs. The RTS gameplay renders pre-baked
sprite atlases; replacing GLB alone does not replace the in-game visuals.

## Build

```bash
python -m pip install numpy scipy trimesh pillow
ATLAS_TANK_OUT=src/assets/reborn/animation python scripts/create_atlas_leopard.py
PYTHONPATH=scripts python -m unittest discover -s tests -p test_tank_pbr.py
npm ci
npm ci --prefix tests/browser
# Browser prerequisites: npx --prefix tests/browser playwright install chromium
ATLAS_BROWSER_CHANNEL=chromium node scripts/render-unit-atlases.mjs --hd tank
npm run build
```

The feature branch GitHub Actions workflow runs this build and commits
both models and atlas PNG/JSON files. A compressed seed file initially
holds the Python generator, restored as editable Python source by CI.

## Integration conventions

- Front: +Z, up: +Y.
- `Tank_Turret` and `Tank_Gun` are independently named GLB groups.
- `MuzzleOpening` and `FactionFlagCloth` are explicit components.
- Turret and cannon remain separately composited in the directional atlases.
- Tank body is normalized independently of barrel length to preserve
  infantry/vehicle scale balance.

## PBR material pipeline (October 2026)

- `scripts/tank_pbr_textures.py` procedurally paints deterministic **2048px woodland camouflage** with wear, dust and chips (not just flat material colors).
- Painted steel, bare metal, track rubber and team-flag cloth use separate **1024px surface detail**. The GLB embeds albedo, tangent-space normal and packed glTF metallic/roughness textures; no network texture URLs are needed.
- Per-face UV mapping preserves all individually named tank parts, the independent `Tank_Turret` / `Tank_Gun` pivots and the blue/red cloth flags.
- `scripts/animation/render.js` respects authored PBR maps during offline baking. The RTS continues to load pre-baked 192px PNG/JSON atlas frames, not full 2K textures.
- The workflow runs targeted Python surface/round-trip tests, validates UVs and embedded textures of both final GLBs, and checks all 16 headings and movement clips.
- Keep separate team identity on the pennants; avoid tinting camouflage red or blue.

### Local rebuild

```bash
python3 -m pip install numpy scipy trimesh pillow
ATLAS_TANK_OUT=src/assets/reborn/animation python3 scripts/create_atlas_leopard.py
PYTHONPATH=scripts python3 -m unittest discover -s tests -p 'test_tank_pbr.py'
ATLAS_BROWSER_CHANNEL=chromium node scripts/render-unit-atlases.mjs --hd tank
npm run build
```

Rendering the tactical atlas requires the repository's Playwright Chromium dependencies.
