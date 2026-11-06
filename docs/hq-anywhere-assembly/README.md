# Freie HQ-Platzierung und stufenweiser 3D-Aufbau · 30.10.2026

## Spielverhalten
- Das erste Hauptquartier darf **an jeder tatsächlich bebaubaren Stelle der gesamten Karte** errichtet werden. Die bisherige 600-Welteinheiten-Startzone ist **keine Baugrenze** mehr und ihr Umriss erscheint nicht mehr.
- Auch der bisherige Erkundungszwang für den ersten HQ-Grundriss entfällt. Normale Bauverbote bleiben: Kartenrand, unpassierbares Terrain/Felsen, Bastionen, belegte Flächen und Gebäudeabstände. Die beauftragten Pioniere müssen die Baustelle mit der regulären Wegfindung erreichen können.
- Die bisherigen Startanker existieren nur noch für Startaufstellung, Kamera, KI-Kandidaten und Abstand der Atmosphärendetails. Die KI baut ihr HQ weiterhin bevorzugt in einer sicheren, nahegelegenen Position, hat aber keine geometrische Zonenbegrenzung.
- Radar und Minimap bleiben wie zuvor gestört, bis der Pionier das erste HQ tatsächlich fertiggebaut hat. Alte Spielstände bleiben kompatibel.
- Der Hinweis im Spiel lautet nun **„Errichte ein Hauptquartier an einem beliebigen freien Standort auf der Karte.“**

## Tatsächlicher 3D-Aufbau
Das verfeinerte Hauptquartier wird jetzt genauso wie Kaserne und Fahrzeugfabrik **sichtbar in sechs Baustufen zusammengesetzt**. Für das blaue und das rote HQ gibt es eigene PBR-gerenderte Baustufen. Die modellierten Dreiecke der HQ-Struktur werden für den Offline-Bauatlas in sechs Höhenabschnitte sortiert, damit große zusammengefasste Materialflächen nicht sofort als fertiges Gebäude erscheinen. Radar/Leuchtanimationen bleiben bis zur Fertigstellung deaktiviert.

- Die fertigen HQ-Master-GLBs, ihre UVs, PBR-Texturen und fertigen Sprite-Atlanten bleiben unangetastet.
- Beide sechsphasigen HQ-Bauatlanten sind ins Repository gebacken: [Blau](../../src/assets/reborn/buildings-3d/headquarters-0-construction.png) und [Rot](../../src/assets/reborn/buildings-3d/headquarters-1-construction.png).
- Die bestehenden Mechaniken **BAU / PAUSIERT**, Pioneer-Arbeit, Bauzeit, Radarfreigabe und gespiegelte Gebäudeausrichtung bleiben erhalten.
- Die Binärgrafiken sind im GitHub-Workflow [HQ assembly bake](../../.github/workflows/sandforge-hq-assembly-bake.yml) aus den echten 3D-Mastermodellen erzeugt und committed worden. Reproduktion: `npm run assets:hq-construction`.

## Prüfung
```bash
npm run build
node --test tests/reborn-hq-bootstrap.test.mjs tests/reborn-construction-assembly.test.mjs tests/reborn-building-orientation.test.mjs tests/savegame.test.mjs
npm --prefix tests/browser test -- --grep 'HQ opening'
```

Die sechs Bauphasen werden sowohl über die tatsächlich gepackten Sprite-Atlanten als auch im Playwright-Browser über den Renderpfad geprüft. Weitere systemweite Node-/Chromium-Tests laufen in GitHub Actions.

## Lokale Installation
```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git switch feat/sandforge-anywhere-hq-progressive-assembly-20261030
git pull --ff-only
npm run build
docker compose -p sandforge-bastion-wars up -d --build --force-recreate
```
