#!/usr/bin/env bash
# Add the user's second ElevenLabs track to the existing Sandforge test branch.
# Usage: bash scripts/install-sandforge-ambient.sh ~/Downloads/sandforge-ambient-patrol.mp3
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH='feat/webgl-facilities-preview-smallarms-20261110'
TARGET='src/assets/reborn/music/sandforge-ambient-patrol.mp3'
SOURCE="${1:-$HOME/Downloads/sandforge-ambient-patrol.mp3}"
# The original ElevenLabs upload may already exist in ~/Downloads.
if [[ -z "${1:-}" && ! -f "$SOURCE" ]]; then
 SOURCE="$HOME/Downloads/ElevenLabs_audio_elevenlabs-music-v2-5_Atmospheric mil_2026-11-11T17_02_41.mp3"
fi
if [[ ! -f "$SOURCE" ]]; then
 echo "MP3 nicht gefunden: $SOURCE" >&2
 echo 'Lade die MP3 aus ChatGPT herunter und übergib den vollständigen Pfad.' >&2
 exit 2
fi
if ! command -v git >/dev/null || ! command -v npm >/dev/null; then
 echo 'Git und npm werden benötigt.' >&2; exit 2
fi
cd "$ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
 echo 'Uncommittete Änderungen im Testordner: nichts überschrieben.' >&2
 git status --short; exit 3
fi
git fetch origin "$BRANCH"
git switch -C "$BRANCH" "origin/$BRANCH"
mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"
git add -- "$TARGET"
if ! git diff --cached --quiet -- "$TARGET"; then
 git commit -m "asset(audio): add Sandforge ambient patrol soundtrack"
 git push origin "HEAD:$BRANCH"
 echo 'Neuer 3-Minuten-Track wurde auf den Sandforge-Testbranch gepusht.'
else
 echo 'Neue MP3 ist bereits im Repository.'
fi
npm run build
echo 'Playlist fertig. Zum Starten: PORT=8197 node scripts/serve.mjs'
