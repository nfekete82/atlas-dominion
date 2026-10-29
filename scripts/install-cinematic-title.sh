#!/usr/bin/env bash
# Install the separately distributed, user-approved cinematic Sandforge title.
# Must run inside the clean cinematic feature worktree.
set -Eeuo pipefail
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ART="${1:?Usage: bash scripts/install-cinematic-title.sh /absolute/path/start-screen-cinematic.webp}"
BRANCH="feat/sandforge-cinematic-title-20261029"
TARGET_ASSET="$PROJECT/src/assets/reborn/start-screen-cinematic.webp"
EXPECTED="0d76a158786352cad42d8b52133306f5f387db16403e607b162d5c19b0654deb"

cd "$PROJECT"
if [[ ! -f "$ART" ]]; then echo "STOP: Artwork not found: $ART"; exit 1; fi
if [[ "$(shasum -a 256 "$ART" | awk '{print $1}')" != "$EXPECTED" ]]; then
 echo "STOP: Artwork checksum mismatch. Keep the original supplied package."; exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
 echo "STOP: Existing local modifications would be lost. Nothing changed."; git status -sb; exit 1
fi

echo "=== Sharp 1606 x 979 cinematic title artwork ==="
cp "$ART" "$TARGET_ASSET"
echo "=== Install dependencies and build ==="
npm ci
npm run build
test -s "dist/src/assets/reborn/start-screen-cinematic.webp"
echo "=== All Node simulation tests ==="
npm test
echo "=== Browser dependencies ==="
npm --prefix tests/browser ci
(cd tests/browser && npx playwright install chromium)
echo "=== Campaign title + actual gameplay browser tests ==="
(cd tests/browser && ATLAS_BROWSER_CHANNEL=chromium npx playwright test --config=playwright.config.mjs sandforge-title-menu.spec.mjs reborn-gameplay-update.spec.mjs --reporter=line)
echo "=== Commit artwork to matching code branch ==="
git add -- "$TARGET_ASSET"
git diff --cached --check
if ! git diff --cached --quiet; then
 git commit -m "assets(menu): ship crisp Sandforge cinematic title artwork"
fi
echo "=== Deploy new Sandforge game container ==="
docker compose -p sandforge-bastion-wars up -d --build --force-recreate
curl -fsS --retry 20 --retry-delay 2 --retry-all-errors --max-time 5 \
 -o /dev/null -w 'Sandforge HTTP %{http_code}\n' 'http://127.0.0.1:8095/'
echo "=== Publish tested assets and code to GitHub ==="
git push origin HEAD:"$BRANCH"
echo "=== Version ==="
git log -1 --oneline
git status -sb
echo "=== CINEMATIC TITLE INSTALLED ==="
