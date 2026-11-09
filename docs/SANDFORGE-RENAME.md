# Sandforge: Bastion Wars — Projektumbenennung (09.11.2026)

## Ziel und Bestand

- **Offizieller Spieltitel:** Sandforge: Bastion Wars.
- **Technischer Projektname:** `sandforge` (npm-Metadaten und primärer Docker-Compose-Service).
- **GitHub-Repository (bereits umbenannt):** `nfekete82/sandforge` (zuvor `nfekete82/atlas-dominion`).
- **Lokaler Ordner:** `~/Projects/sandforge-bastion-wars` ist bereits korrekt; nicht notwendig, ihn umzubenennen.
- WebGL/Three.js läuft bei aktuellen Builds unter `/`, Canvas weiterhin unter `/classic.html`.
- Der Uberspace-Deploy bleibt für ungeprüfte WebGL-Releases gesperrt. Der bestehende Produktivcontainer auf Port 8095 bleibt unverändert.

## GitHub-Repository (Umbenennung bestätigt)

Am 09.11.2026 wurde der bestehende GitHub-Repository-Name bereits von `nfekete82/atlas-dominion` auf **`nfekete82/sandforge`** geändert. Die GitHub-Repository-ID, Historie, PR-Nummern und Issues sind erhalten geblieben.

In der bestehenden lokalen Projektkopie den Origin-Remote umstellen:

```sh
cd "$HOME/Projects/sandforge-bastion-wars"
git remote -v
git remote set-url origin https://github.com/nfekete82/sandforge.git
git fetch origin --prune
git remote -v
```

Bei SSH-Zugängen stattdessen `git@github.com:nfekete82/sandforge.git` verwenden. Ältere GitHub-Links werden von GitHub normalerweise umgeleitet; CI-Konfigurationen, Webhooks, Umgebungsvariablen und fest verdrahtete Links dennoch separat prüfen. **Kein neues Repository klonen oder die Git-Historie umschreiben, um nur den Namen zu ändern.**

## Kompatibilität und ältere Kennungen

- Alte `ATLAS_BASE_URL`, `ATLAS_BROWSER_CHANNEL`, `ATLAS_TEST_DPR` bleiben als Browser-Test-Fallbacks erhalten; `SANDFORGE_*` haben Vorrang.
- Sprite-**Atlanten** (`*atlas*` in Renderer-/Asset-Dateinamen) sind ein grafischer Fachbegriff und kein falscher Spielname.
- Alte Savegame-Schlüssel, IndexedDB-Datenbanken, Kartenformat, Entity-IDs, URLs und Dateipfade bleiben **absichtlich unverändert**. Spielstanddaten müssen nicht gelöscht oder konvertiert werden.
- Historische Dokumente und validierte Tests dürfen alte Projektbezeichnungen enthalten, wenn eine Änderung keinen funktionalen Nutzen bringt.
- Die `CODEX_PROMPT.md` enthält aktuelle Sandforge-Anweisungen; die frühere Atlas-Dominion-Aufgabe liegt archiviert unter `docs/legacy/`.

## Docker ohne produktive Änderung

`compose.yaml` verwendet jetzt `sandforge` als Service. **Dadurch ändert sich die Compose-Service-Identität**: Ein bestehender alter Container kann beim nächsten `up` als Orphan bestehen bleiben; mit demselben Hostport 8095 wäre auch ein Bind-Konflikt möglich. Produktionscontainer nicht nebenbei ersetzen oder mit `--remove-orphans` löschen.

Vor dem späteren produktiven Wechsel Namen/Volumes/Containerliste ansehen und ein kontrolliertes Update samt Rollback planen. Für unabhängige Testläufe den vorhandenen Vorschau-Stack nutzen:

```sh
docker compose -p sandforge-rc2-preview -f compose.rc2-preview.yaml up --build -d
# Vorschau: http://127.0.0.1:8106/
docker compose -p sandforge-rc2-preview -f compose.rc2-preview.yaml down
```

## Lokale Abnahme vor Merge/Deployment

```sh
npm ci
npm ci --prefix tests/browser
npm run build
node --test tests/sandforge-project-identity-20261109.test.mjs
node --test tests/webgl-engineer-reliable-input-20261109.test.mjs tests/webgl-no-constant-engine-hum-20261109.test.mjs
SANDFORGE_BROWSER_CHANNEL=chromium npm run test:webgl-integration
```

Danach Browserbild/Audio/Pionier/HUD und echte Savegame-Fortsetzung im separaten Preview prüfen. **Kein Merge, kein Release, kein Port-8095-Deployment durch diesen Rename-Branch.**
