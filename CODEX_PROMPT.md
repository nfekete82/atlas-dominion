# Sandforge: Bastion Wars — Entwicklungsauftrag

Dies ist ein **WebGL-3D-RTS**, kein geografisches Atlas-Dominion-Spiel. Der bestehende ältere Auftrag ist ausschließlich als [historisches Dokument](docs/legacy/atlas-dominion-codex-prompt.md) archiviert.

## Projekt
- Offizieller Spieltitel: **Sandforge: Bastion Wars**; Projekt-, npm- und Docker-Name: **sandforge**.
- GitHub-Repository: `nfekete82/sandforge` (früher `nfekete82/atlas-dominion`, bereits umbenannt).
- Lokaler Arbeitsordner auf dem Eigentümer-Mac: `~/Projects/sandforge-bastion-wars`. Nicht ohne Aufforderung umbenennen.
- Rendering: Three.js/WebGL 3D auf `/`; alte Canvas-Version auf `/classic.html`.
- Quellcode: `src/reborn/` (Simulation), `scripts/webgl-*.js` (3D und UI), `src/reborn/webgl-classic-hud.css`.
- Vollbreites HUD, beige/sandfarbene Gebäude, Pionier-Baufolgen, neun Forschungsupgrades und Langstreckenrakete beibehalten.

## Sichere Arbeitsweise
1. Vor Änderungen den neuesten Entwicklungsbranch und die gestapelten PRs prüfen. Nicht blind von historischem `main` ausgehen.
2. Änderungen nur auf isolierten Branches/Worktrees; produktiven Docker-Port `8095` und Uberspace nicht überschreiben.
3. `npm ci`, `npm run build`, passende Node-Tests und echte Chromium-/WebGL-Browsertests vor Übernahme.
4. Spielstandformat, IndexedDB-Keys, Karten-Seeds, importierte Assetpfade und vorhandene Umgebungsvariablen nicht ohne explizite Migration ändern.
5. Canonical Browser-Testvariablen `SANDFORGE_BASE_URL`, `SANDFORGE_BROWSER_CHANNEL`, `SANDFORGE_TEST_DPR`; bisherige `ATLAS_*`-Variablen vorerst als Alias unterstützen.
6. Kein ungeprüfter Merge in `main`, kein Release und kein automatisches Deployment.

Siehe [Projektumbenennung](docs/SANDFORGE-RENAME.md) und [README](README.md).
