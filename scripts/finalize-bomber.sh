#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH="feat/sandforge-bomber-pbr-sprites-20261028"
if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
 echo "STOP: Switch to $BRANCH first" >&2; exit 1
fi
if ! git diff --cached --quiet; then
 echo "STOP: Staged changes already exist; refusing to include another task." >&2; exit 1
fi
# Preserve other local work by only accepting known preinstalled bomber changes.
while IFS= read -r f; do
 case "$f" in
 src/assets/reborn/animation/bomber-0.glb|src/assets/reborn/animation/bomber-1.glb|src/assets/reborn/animation/bomber-0.json|src/assets/reborn/animation/bomber-1.json|src/assets/reborn/animation/bomber-0.png|src/assets/reborn/animation/bomber-1.png) ;;
 *) echo "STOP: Unrelated tracked modification: $f" >&2; exit 1 ;;
 esac
done < <(git diff --name-only)
node - <<'JS'
const fs=require('node:fs'),p='src/assets/reborn/animation/';
for(const team of [0,1]){
 const b=fs.readFileSync(p+'bomber-'+team+'.glb');
 if(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2)throw Error('Invalid bomber GLB for '+team);
 const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
 if(!json.animations?.some(c=>c.name==='Propellers_Continuous'))throw Error('Old/unanimated bomber GLB still installed: '+team);
 console.log('Bomber',team,Math.round(b.length/1048576*10)/10,'MiB, PBR source verified');
}
JS
echo "=== Re-render only bomber sprite atlases (keep GLB source) ==="
npm run assets:animations:hd -- bomber
echo "=== Build & targeted and regression tests ==="
npm run build
node --test tests/reborn-bomber-pbr.test.mjs tests/reborn-animation.test.mjs
echo "=== Check changes ==="
git diff --check
git add -- src/assets/reborn/animation/bomber-0.glb src/assets/reborn/animation/bomber-1.glb \
 src/assets/reborn/animation/bomber-0.png src/assets/reborn/animation/bomber-1.png \
 src/assets/reborn/animation/bomber-0.json src/assets/reborn/animation/bomber-1.json
if ! git diff --cached --quiet; then
 git commit -m "feat(assets): install animated PBR bomber and bake gameplay atlases"
 git push -u origin "$BRANCH"
else
 echo "Bomber assets unchanged; no commit necessary."
fi
echo "=== Docker update ==="
docker compose -p sandforge-bastion-wars up -d --build --force-recreate --remove-orphans
curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 \
 --max-time 5 -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8095/
git status -sb
echo "Done: http://127.0.0.1:8095/model-3d.html?model=bomber"
