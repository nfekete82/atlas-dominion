# Atlas Precision Legionnaire — authored visual replacement

The user supplied a realistic high-poly soldier and the separately modelled Atlas Precision Carbine. This feature replaces **only** the blue/red infantry role. Engineer, medic and heavy infantry continue to use the previous animation set.

## What changes
- `src/assets/reborn/prototype/infantry-{0,1}.glb`: original realistic soldier mesh plus detailed AR-type weapon, embedded soldier and weapon PBR textures, colored faction insignia, `Atlas_MuzzleBore` and five named root-motion clips.
- `infantry-{0,1}.png` and `.json`: replacement **in-game** Canvas 2D atlases, not just gallery models. Every team has eight view directions and 296 registered frames.
- No change to HP, cost, walk speed, attack timing, hitbox, AI, other roles, factions or save data.

**Animation limitation:** the supplied original `soldier.glb` was an unrigged, fused mesh. The GLBs include simple whole-body root transforms for animation playback and the tactical sprites contain authored bob/recoil/hit/fall projections. **These are not full skeletal running, aiming or death animations.** The original 3D soldier and rifle have not been replaced by low-poly primitives. To obtain realistic joint motion, the body needs a proper skin, bones, hand grips and a rifle socket before rebaking.

The binary GLB and PNG assets are installed from the companion `atlas-precision-legionnaire-game-patch.zip`, not generated on GitHub from text. The archive carries `INSTALL.command` for safe local import and the source bakers. After installing, commit the six infantry assets to this feature branch and push from the local Mac. The branch by itself only contains source integration, validation and safety guards.

## Checks after installation

```sh
npm run build
node --test tests/reborn-premium-legionnaire.test.mjs tests/reborn-animation.test.mjs
docker compose -p atlas-dominion up -d --build
curl -fsS http://127.0.0.1:8095/src/assets/reborn/prototype/infantry-0.json | grep 'version'
```

`npm run assets:detailed-infantry` now refuses to overwrite installed premium infantry unless `--overwrite-premium` is explicitly provided. `--support` remains available for medic and engineer.
