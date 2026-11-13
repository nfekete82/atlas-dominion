# SANDFORGE — vereinheitlichter Entwicklungsstand
Stand: 2026-11-13. Ab jetzt **develop** als gemeinsame Entwicklungsbasis verwenden.

## Integriert
- Vollständige bestehende WebGL/Gameplay-Feature-Kette bis PR #283.
- Interaktives HUD #285, kompaktes Anthrazit-/Sandgold-Design #288.
- Titelmenü/Logo-Fallback und echte Menüaktionen aus #284/#286.
- Animierte Bastion samt GLB, Besetzung/Flagge/Radar aus dem bereits in #286 integrierten PR #287.
- Optionaler Meshy-Import aus #289; standardmäßig DEAKTIVIERT, GLBs separat zu installieren.
- CI für WebGL-Build, Node-Regressionen und Playwright-Tests.

## Fehlende optionale externe Dateien
Die beiden individuell ausgewählten Titelgrafiken
`src/assets/reborn/sandforge-start-background.png` und
`src/assets/reborn/sandforge-bastion-logo.webp`
waren in den bisherigen Git-Branches **nicht** enthalten. Die aktuelle Version
verwendet deshalb das vorhandene `title-hero.svg` und bestehende Logos als
geprüfte Fallbacks. Die Links im Menü bleiben echte klickbare HTML-Buttons.
Die optionalen Meshy-GLBs aus #289 sind ebenfalls nicht im Git-Repository.

## Start
```sh
git fetch origin
git switch develop || git switch --track origin/develop
npm ci
PORT=8107 npm run dev
```
Die 3D-Anwendung liegt unter `http://localhost:8107/`. Mit `?models=meshy`
kann die optionale Modellroute nach separater Asset-Installation getestet werden.

## Integrationssicherheit
`main` bleibt unangetastet. Diese Integration enthält Änderungen aus mehreren
Feature-Branches und benötigt CI- und visuelle Browserabnahme vor einem Release.
