# Sandforge – Meshy model swap (owner-supplied 3D assets)

## Status

The user supplied three real Meshy GLBs: military command bunker, an armed
Desert Sentinel, and a tank. The **rocket-launcher file has not been uploaded
yet**, so neither the infantry rocket launcher nor artillery visuals were
silently replaced with another model.

The original uploads are unusually large (HQ ~108 MB, tank ~84 MB, infantry
~9.8 MB); an optional separately delivered game-ready pack reduces them to
~1.54 MB, ~2.04 MB and ~0.88 MB respectively. The packed GLBs preserve
the model silhouette with vertex clustering and retain the source's main
texture at 768 pixels. High-resolution normals were removed for FPS.

### What is integrated

- Opt-in asset routing via `?models=meshy` (or `?meshy=1`).
- New HQ and tank visuals, with original built-in models as loading fallback.
- Tank pivot `Tank_Turret`, split from the single original photoscan-like
  mesh at the upper hull: the engine can yaw it with the same combat heading.
  More accurate rigid segmentation requires manual cleanup in Blender.
- Production, selection, team-identification overlays, AI and saved games
  use the original Sandforge identifiers.
- Building and unit cards render the selected GLB with the existing image
  pipeline.
- The uploaded armed soldier GLB is **not skinned and has no animation
  clips**. In-match infantry therefore keeps the original fully animated
  rig unless `&meshyStaticSoldier=1` is deliberately added. Do not turn that
  mode on for normal gameplay if walking/shooting/death movements matter.
- A future owner-supplied `artillery.glb` can be imported and enabled in the
  same pipeline. A static `rocket.glb` currently requires the explicit
  static-soldier flag.

## Install the downloaded pack locally

Unzip `sandforge_meshy_rts_assets.zip` from this chat into a temporary
folder, for example `~/Downloads/sandforge-meshy`.

Run these commands **in a fresh worktree checked out from this PR**:

```sh
node scripts/install-meshy-assets.mjs "$HOME/Downloads/sandforge-meshy"
npm ci
npm run build:3d
PORT=8299 npm run preview
```

Open `http://127.0.0.1:8299/?models=meshy&bastions=4&seed=2074&play=1`.

To compare against the current Sandforge originals, open the exact same URL
without `models=meshy`.

Models are intentionally not committed to a public repository: the user's
original Meshy assets and license requirements must be handled separately.
The importer verifies glTF headers and optionally verifies SHA-256 hashes
from the optimized pack's manifest. The game fallback handles absent models.

## Not complete

- HQ door alignment is still a visual QA item. The author's GLB was a
  single static mesh, so it cannot inherit open/close door animations directly.
- Soldier model is static; requires animation-ready rigging and skinning.
- Rocket launcher GLB is missing; cannot replace unseen asset.
- Need on-device gameplay comparison, look angle / pivot tuning, and
  performance checks with dozens of tanks and HQs.
