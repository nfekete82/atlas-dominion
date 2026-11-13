# Sandforge Feldkommando MK2

The new HQ is the preferred live WebGL headquarters model. It is deliberately separate from the previous HQ3 binary, which remains a safe fallback if MK2 is not installed.

## Install the actual user-supplied GLB

Download `Sandforge_Feldkommando_MK2.glb` from the ChatGPT conversation into your Mac Downloads folder, then:

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git switch feat/webgl-feldkommando-mk2-20261114
npm ci
npm run assets:feldkommando-mk2 -- "$HOME/Downloads/Sandforge_Feldkommando_MK2.glb"
PORT=8107 npm run dev
```

The script validates the binary glTF header, all four door animation clips, the radar clip, and the five articulated door/radar nodes; it copies the file to `src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb`. It **does not** edit existing GLBs, player save data, building stats, or collision radii. The build copies `src/assets` into `dist/src/assets`.

To test: start a battle in WebGL; build a headquarters; produce an engineer. Both its twin sliding doors and the fence gate use the existing production sequence; the dish uses the authored `Radar_Scan` animation.

If the model is missing, WebGL falls back to `sandforge_funkzentrale_hq3_game_ready.glb`. The comparison gallery falls back too.

## Notes

The binary GLB was supplied separately in ChatGPT and cannot be committed through the current text-only GitHub integration. **Until you install it locally (or commit the file to the feature branch yourself), GitHub contains only the code integration, not the model bytes.**

This is a feature branch based on `develop`; no change to `main` or live deployment is implied.
