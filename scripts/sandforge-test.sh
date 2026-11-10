#!/usr/bin/env bash
# Sandforge: repeatable, isolated local WebGL review on macOS / OrbStack.
# Run with: ~/sandforge-test.sh
# Override branch if needed: SANDFORGE_TEST_BRANCH=feat/example ~/sandforge-test.sh
set -euo pipefail

BRANCH="${SANDFORGE_TEST_BRANCH:-feat/webgl-desert-vfx-polish-20261110}"
BASE="${SANDFORGE_BASE:-$HOME/Projects/sandforge-bastion-wars}"
WT="${SANDFORGE_REVIEW_DIR:-$HOME/Projects/sandforge-desert-vfx-review}"
CONTAINER="sandforge-local-test"
IMAGE="sandforge-local-test:latest"
LABEL="com.sandforge.purpose"
LABEL_VALUE="local-review"

fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null || fail "Git fehlt."
command -v docker >/dev/null || fail "Docker/OrbStack fehlt."
command -v curl >/dev/null || fail "curl fehlt."
[[ -d "$BASE" ]] || fail "Sandforge-Repository fehlt: $BASE"
git -C "$BASE" rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "Kein Git-Repository: $BASE"
docker info >/dev/null 2>&1 || fail "Docker ist nicht erreichbar. OrbStack starten."

printf '\n=== 1/4 GitHub-Stand aktualisieren ===\n'
git -C "$BASE" fetch --no-tags origin   "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"

if [[ ! -e "$WT" ]]; then
  git -C "$BASE" worktree add --detach "$WT" "origin/$BRANCH"
else
  [[ "$(git -C "$WT" rev-parse --show-toplevel 2>/dev/null)" == "$WT" ]] ||
    fail "Review-Verzeichnis ist kein passender Git-Worktree: $WT"
  [[ -z "$(git -C "$WT" status --porcelain)" ]] ||
    fail "Lokale Änderungen im Review-Worktree – nicht überschrieben: $WT"
  git -C "$WT" switch --detach "origin/$BRANCH"
fi

SHORT_SHA="$(git -C "$WT" rev-parse --short=10 HEAD)"
printf 'Review-Commit: %s\n' "$SHORT_SHA"

printf '\n=== 2/4 Docker-Image erstellen ===\n'
# Build FIRST: a failed build leaves the previous running test untouched.
docker build --label "$LABEL=$LABEL_VALUE" -t "$IMAGE" "$WT"

printf '\n=== 3/4 Vorherigen eigenen Testcontainer ersetzen ===\n'
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  OWNER="$(docker inspect --format "{{ index .Config.Labels \"$LABEL\" }}" "$CONTAINER")"
  [[ "$OWNER" == "$LABEL_VALUE" ]] ||
    fail "Container $CONTAINER existiert, wurde aber nicht von diesem Skript angelegt."
  docker rm -f "$CONTAINER" >/dev/null
fi

docker run -d --name "$CONTAINER"   --label "$LABEL=$LABEL_VALUE"   -p 127.0.0.1::8095 "$IMAGE" >/dev/null

PORT="$(docker port "$CONTAINER" 8095/tcp | awk -F: 'NR==1 {print $NF}')"
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "Docker-Port konnte nicht ermittelt werden."

printf '\n=== 4/4 Server prüfen und Browser öffnen ===\n'
URL="http://127.0.0.1:$PORT/webgl-preview.html?bastions=4&seed=2074&biome=desert&play=1&perf=1"
curl --fail --silent --show-error --retry 30 --retry-delay 1   --retry-connrefused "http://127.0.0.1:$PORT/healthz" >/dev/null ||
  fail "Healthcheck fehlgeschlagen. Logs: docker logs $CONTAINER"

printf '\nSandforge Wüste – Commit %s\n%s\n\n' "$SHORT_SHA" "$URL"
if command -v open >/dev/null; then
  open "$URL"
fi
