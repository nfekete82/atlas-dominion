# Sandforge: Bastion Wars — Hinweise für KI-Entwicklungsarbeiten

**Offizieller Name:** Sandforge: Bastion Wars. Das GitHub-Repository ist `nfekete82/sandforge`; npm- und Docker-Projektbezeichner im neuen Entwicklungszweig sind `sandforge`.

## Aktive Codebasis finden

Der GitHub-Default-Branch `main` ist derzeit ein älterer Canvas-Snapshot. **Keine neue Sandforge-WebGL-Funktion allein auf Basis von `main` entwickeln oder daraus veröffentlichen.**

Aktueller WebGL-Entwicklungszweig: `chore/sandforge-project-identity-20261109`, gestapelt auf `feat/webgl-cohesive-buildings-research-icons-20261109`.

- Gameplay/Simulation: `src/reborn/`
- WebGL-Bühne, Kamera, HUD, Fahrzeuge: `scripts/webgl-*.js`
- WebGL-HUD-Styling: `src/reborn/webgl-classic-hud.css`
- Browser-Tests: `tests/browser/`
- Technische Details: [aktueller README](https://github.com/nfekete82/sandforge/blob/chore/sandforge-project-identity-20261109/README.md)
- [Sichere Rename-Migration](https://github.com/nfekete82/sandforge/blob/chore/sandforge-project-identity-20261109/docs/SANDFORGE-RENAME.md)

## Regeln

1. Den tatsächlichen lokalen Branch, Git-Status, laufenden Worktree und gestapelte Draft-PRs prüfen, bevor Dateien geändert werden.
2. In einem isolierten Worktree testen, keine uncommitteten Arbeiten überschreiben und nicht den produktiven Docker-Port `8095` verändern.
3. Die aktuelle 3D-Version auf `/` und die klassische Canvas-Version auf `/classic.html` getrennt halten.
4. Aktuelle Gameplay-Elemente beibehalten: Bau per Pionier, ein durchgehendes HUD, Einheitenproduktion, Forschung, KI und strategische Raketen.
5. Kein globales Umbenennen von internen Savegame-/IndexedDB-IDs, Sprite-Atlanten, fest verdrahteten Assetpfaden oder Legacy-Schemata.
6. Testvariablen `SANDFORGE_BASE_URL`, `SANDFORGE_BROWSER_CHANNEL`, `SANDFORGE_TEST_DPR` verwenden; die alten `ATLAS_*`-Variablen vorerst als Fallback erhalten.
7. Vor einer Integration: `npm ci`, `npm run build`, gezielte Node-Tests, WebGL-/Chromium-Tests und visuelle Kontrolle auf dem echten Mac. Kein Release/Deploy ohne Abnahme.

Der ursprüngliche Atlas-Dominion-Grafikauftrag liegt [hier archiviert](docs/legacy/atlas-dominion-codex-prompt.md) und ist **nicht** die Anweisung für das aktuelle Sandforge-Spiel.
