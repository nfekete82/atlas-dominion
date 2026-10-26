# Tiger-127-Panzer: 3D-Referenz ins Spiel übernehmen

Der Panzer nutzt einen **separaten, lokalen GLB-Quell-Asset** (aus Nutzerreferenz
rekonstruiert). Das Spiel selbst bleibt Canvas 2D: Der bestehende Atlas-Builder
rendert daraus 16 Richtungen mit getrenntem Turm und Kanonenrohr.

## Import

1. `atlas-dominion-tiger-127.glb` in
   `src/assets/reborn/animation/tank-reference.glb` kopieren.
2. Im Projekt `npm run assets:animations -- tank` ausführen.
   Das erzeugt neu:
   - `tank-0.glb`, `tank-1.glb`
   - `tank-0.png`, `tank-1.png`
   - `tank-0.json`, `tank-1.json`
3. `npm run typecheck && npm run test:animation` ausführen.
4. `docker compose up -d --build` und `http://127.0.0.1:8095` prüfen.

**Wichtig:** Nur das GLB zu ersetzen hat im Spiel keine Auswirkung,
weil der Canvas-Renderer die vorgerenderten PNG-Atlanten lädt.
Ohne `tank-reference.glb` fällt der Builder auf die originale Panzergeometrie
zurück. Andere Fahrzeuge bleiben unberührt.

## GLB-Vertrag

- glTF 2.0 Binary, Y-up; Fahrtrichtung +Z; Boden bei Y=0.
- `Tank_Turret`: eigenständiger Node mit drehbarem Turm.
- `Tank_Gun`: eigenständiger Node mit Kanone.
- `Hull_track2`: dunkle Track-Pads; kleiner Versatz erzeugt vier Bewegungsphasen.
- Die Fraktionsstreifen werden beim Bake durch den Builder ergänzt.
- Keine Änderungen an Simulation, Trefferbox, Reichweite oder Savegame-Format.

Der GLB ist eine prozedurale Nachbildung, keine 1:1-Photogrammetrie.
