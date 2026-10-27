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
python -m pip install numpy trimesh
ATLAS_TANK_OUT=src/assets/reborn/animation python scripts/create_atlas_leopard.py
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
