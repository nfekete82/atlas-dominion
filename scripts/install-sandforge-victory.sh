#!/usr/bin/env bash
# Import the actual user-provided victory image into the Sandforge WebGL branch.
# Usage: bash scripts/install-sandforge-victory.sh "$HOME/Downloads/sandforge-victory.png"
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH='feat/webgl-facilities-preview-smallarms-20261110'
TARGET='src/assets/reborn/ui/sandforge-victory.png'
SOURCE="${1:-$HOME/Downloads/sandforge-victory.png}"
if [[ ! -f "$SOURCE" && -z "${1:-}" ]]; then
 SOURCE="$HOME/Downloads/sieg_über_der_wüstenfront.png"
fi
if [[ ! -f "$SOURCE" ]]; then
 printf 'Siegbild fehlt: %s\\n' "$SOURCE" >&2
 echo 'Speichere das Bild aus ChatGPT in Downloads als sandforge-victory.png.' >&2
 exit 2
fi
cd "$ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
 echo 'Lokale Änderungen vorhanden. Nichts überschrieben.' >&2
 git status --short
 exit 3
fi
git fetch origin "$BRANCH"
git switch -C "$BRANCH" "origin/$BRANCH"
mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"
git add -- "$TARGET"
if ! git diff --cached --quiet -- "$TARGET"; then
 git commit -m "asset(webgl): embed original Sandforge victory illustration"
 git push origin "HEAD:$BRANCH"
 echo 'Original-Siegbild in Testbranch übernommen.'
else
 echo 'Siegbild liegt bereits im Testbranch.'
fi
npm run build
echo 'Test starten: PORT=8197 node scripts/serve.mjs'
