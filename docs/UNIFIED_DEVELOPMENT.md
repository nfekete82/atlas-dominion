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

## Verbindliches Logo und Startbild
Die beiden Originalbilder wurden am 13.11.2026 bereitgestellt; die folgenden
Dateinamen sind absichtlich stabil und werden bereits vom WebGL-Hauptmenü,
HUD und der taktischen Pause geladen:

- `src/assets/reborn/sandforge-bastion-logo.webp`
  (1440 × 810, transparent, SHA-256: `1ca72dc86a5498dbe84e6e7bc48feb921f25e25fd681c0fa32c59b30a3573fed`)
- `src/assets/reborn/sandforge-start-background.png`
  (1672 × 941, SHA-256: `3b5e44516773816fb8a8f983ea707863cd4d2e607051726d36a1cc4852b40dd8`)

Die Original-Binärdateien kommen im bereitgestellten
`sandforge-develop-branding-assets-20261113.zip` und müssen im lokalen
Repository entpackt, committed und gepusht werden. Dieser Schritt ist noch
notwendig: GitHub-Codeänderungen allein übertragen keine Chat-Bild-Uploads.

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git switch develop
git pull --ff-only
unzip -o ~/Downloads/sandforge-develop-branding-assets-20261113.zip -d .
node scripts/verify-branding.mjs --require
npm run build
git add src/assets/reborn/sandforge-bastion-logo.webp src/assets/reborn/sandforge-start-background.png
git commit -m "assets(title): install final Bastion branding artwork"
git push origin develop
```

## Feldkommando
Standardmäßig verwendet das Spiel wieder das bereits vorhandene,
texturierte `sandforge_funkzentrale_hq3_game_ready.glb`, inklusive
Material-/Tür-/Satelliten-Verhalten. Das Baumenu rendert exakt dieses Modell.
Zum Vergleichen kann optional `?hq=stylized` verwendet werden.
Der optionale Meshy-HQ-Pfad `?models=meshy` hat weiterhin Vorrang
und funktioniert nur, wenn das separate Meshy-Bündel installiert wurde.

## Neues Feldkommando: Meshy LowPoly Military HQ (13.11.2026)
**Verbindliches Standardmodell:** `sandforge_feldkommando_meshy.glb`, exakt
aus dem vom Nutzer bereitgestellten Original
`Meshy_AI_LowPoly_Military_HQ_1113224548_texture(1).glb`.
- Größe: 7.258.044 Bytes, SHA-256
  `3cd32f7845dcf64707d71c682a0a3985e929ab18a42d76684ba5937153f63bf3`
- Ein zusammenhängendes Mesh, 20.899 Vertices, 13.766 Dreiecke,
  drei eingebettete JPEG-Texturen, **keine** Animationen/door pivots.
- Ingame, Bauvorschau und Gebäude-Kachel verwenden dasselbe Mesh.
- Geometrie und PBR-Texturen bleiben erhalten; Bau-/Einheiten-/Save-Logik
  unverändert. Die Produktions-Schiebetür ist ein **separates visuelles Overlay**,
  keine nachträglich behauptete native GLB-Animation.
- Das Modell selbst ist nicht in der Git-Quellcodeintegration enthalten,
  sondern im herunterladbaren Original-Asset-Paket. Installation erfolgt
  lokal über das mitgelieferte Installationsskript und anschließend über
  einen normalen Git-Push des GLB.
- Ohne GLB bleibt die bisherige HQ3 Funkzentrale ein funktionierender
  Rückfall. Vergleich: `?hq=hq3`, `?hq=stylized`; Tür bei
  falscher Frontseite testweise `?hqEntrance=rear`.
