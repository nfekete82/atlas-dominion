#!/usr/bin/env bash
# One-time local import of the user's original 120-second ElevenLabs music.
# Use from any directory: bash ~/Projects/sandforge-facilities-test/scripts/install-sandforge-music.sh
# The MP3 is intentionally NOT recreated from an imitation synth track:
# copy the existing exact recording from the user's Downloads folder.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH='feat/webgl-facilities-preview-smallarms-20261110'
TARGET='src/assets/reborn/music/sandforge-theme.mp3'
SOURCE="${1:-$HOME/Downloads/ElevenLabs_audio_elevenlabs-music-v2-5_Cinematic orche_2026-11-11T09_51_18.mp3}"

if [[ ! -f "$SOURCE" && "${1:-}" == "" ]]; then
  # Compatible with renamed downloads but never blindly picks an unrelated MP3.
  SOURCE="$(find "$HOME/Downloads" -maxdepth 1 -type f \
    -name 'ElevenLabs_audio_elevenlabs-music-v2-5_Cinematic*2026-11-11*.mp3' \
    -print -quit 2>/dev/null || true)"
fi
if [[ ! -f "$SOURCE" ]]; then
  echo 'Musikdatei nicht gefunden. Gib den vollständigen MP3-Pfad als Argument an.' >&2
  exit 2
fi
cd "$ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Arbeitsverzeichnis enthält lokale Änderungen; nichts überschrieben.' >&2
  echo 'Bitte Änderungen erst sichern/committen, danach diesen Import erneut starten.' >&2
  exit 3
fi
git fetch origin "$BRANCH"
git switch -C "$BRANCH" "origin/$BRANCH"
mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"
echo "Original-Soundtrack: $(du -h "$TARGET" | cut -f1) · $(basename "$SOURCE")"
git add -- "$TARGET"
if ! git diff --cached --quiet -- "$TARGET"; then
  git commit -m "asset(audio): import original Sandforge cinematic soundtrack"
  git push origin "HEAD:$BRANCH"
  echo 'Musikdatei ist jetzt in GitHub PR #280 enthalten.'
else
  echo 'Musikdatei liegt bereits unverändert im Repository.'
fi
npm run build
echo
echo 'Fertig. Starte Sandforge wie bisher:'
echo '  PORT=8197 node scripts/serve.mjs'
echo 'Öffne: http://127.0.0.1:8197/webgl-preview.html'
echo 'Musiklautstärke: Spielmenü -> Optionen -> Musiklautstärke (standardmäßig 22 %)'
