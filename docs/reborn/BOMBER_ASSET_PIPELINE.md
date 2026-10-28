# Sandforge PBR bomber asset pipeline

The **source-of-truth** is the two authored GLBs in `src/assets/reborn/animation/bomber-{0,1}.glb`, not the original procedural bomber.
The battle runtime uses **PNG/JSON atlases**, while `model-3d.html?model=bomber` previews the GLBs.

- Both GLBs contain embedded base color, normal and metallic/roughness textures.
- Original nose points to -Z; the atlas renderer adds a 180-degree Y rotation to match gameplay.
- Named glTF clip `Propellers_Continuous` animates both propellers.
- Each atlas renders 16 facings and 8 time-based phases each for idle and walk at 192x192.
- `node scripts/render-unit-atlases.mjs --hd bomber` only writes **PNG/JSON**, never rewrites bomber GLBs.
- Existing backup folder `.sandforge-bomber-backup/` is ignored by Git.

## Finish on your Mac (GLBs must already be installed)

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin feat/sandforge-bomber-pbr-sprites-20261028
git switch -c feat/sandforge-bomber-pbr-sprites-20261028 --track origin/feat/sandforge-bomber-pbr-sprites-20261028
bash scripts/finalize-bomber.sh
```

The finalizer validates and renders the assets, builds, runs regression tests,
commits **only** Bomber GLB/PNG/JSON media, pushes the feature branch and rebuilds
Docker on port 8095.

Do not run general `assets:animations` if you only want to update the bomber.
