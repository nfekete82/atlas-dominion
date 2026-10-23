# Übernommene Modellfamilie / 23. Oktober 2026

Der vom Nutzer freigegebene Legionär ist jetzt die aktive Grundfigur aller drei Infanterierollen. Dazu sind sieben zusammengehörige Gebäudetypen als echte 3D-Modelle und als daraus gerenderte Spielgrafiken eingebaut.

- [Spiel](http://127.0.0.1:8095/)
- [Feldkommando als drehbares 3D-Modell](http://127.0.0.1:8095/model-3d.html?model=headquarters)
- [Bastion als drehbares 3D-Modell](http://127.0.0.1:8095/model-3d.html?model=bastion)
- [Soldat und archivierte Ausgangsfigur bei Spielgröße](http://127.0.0.1:8095/model-preview.html)
- Browseraufnahmen: [im Spiel](in-game.png), [Feldkommando](headquarters.png), [neutrale Bastion](bastion.png)

## Umfang

Feldkommando, Bastion, Kaserne, Fahrzeugfabrik, Flugfeld, Energiekern und Geschützturm verwenden dieselbe sandfarbene Keramik-/Bronze-Palette, dunkle technische Einsätze und Fraktionsfarben wie der Legionär. Alle Gebäudemodelle sind eigene Projektgeometrie in `scripts/animation/atlas-buildings.js`. Es gibt 15 GLB-Dateien: jeden Typ in Blau und Rot sowie die Bastion zusätzlich neutral weiß. Die Modellgalerie bietet Auswahl, Drehung, Zoom, Teamwechsel, tatsächliche Betriebsanimationen und GLB-Downloads.

Infanterie, Pionier und schwerer Schütze teilen die vom Nutzer freigegebene 151-teilige Grundrüstung und die dazugehörigen 296 Frames je Team. Der schwere Schütze bleibt größer; Rollenbezeichnungen, Katalogkennzeichnungen, Kosten und Kampfwerte bleiben erhalten. Das sind keine drei neu erfundenen unterschiedlichen Figurenmodelle. Fahrzeuge behalten ihre bisherige Darstellung.

## Registrierung und Animation

Das Hauptspiel bleibt Canvas 2D. Neue Einheiten- und Gebäudegrafiken werden reproduzierbar aus den 3D-Modellen gerendert. Schüsse und Mündungsfeuer verwenden bei Soldaten die tatsächliche projizierte Waffenmündung jedes Frames, einschließlich des Größenfaktors schwerer Infanterie.

Der Gebäudegrundkörper enthält den gerenderten Bodenschatten. Die Kartenposition bezeichnet seinen festen projizierten Weltursprung; weder Schatten noch Fußpunkt werden aus wechselnden sichtbaren Bildgrenzen geschätzt. Feldkommando und Bastion besitzen 64 echte Schüsselansichten mit 48 Sekunden Umlaufdauer. Die kleinen Layer sind eng zugeschnitten und tragen ihren ursprünglichen Pivot relativ zum Grundkörper. Leuchtpunkte besitzen ebenfalls feste Registrierung und 3,8 Sekunden Periode. Während sich die Schüssel dreht, bleibt der Grundkörper einschließlich Bodenschatten pixelgleich. Pausierte Simulationszeit friert die Aktivität ein; reduzierte Bewegung hält die Darstellung statisch.

Die GLB-Dateien enthalten `RadarSpin` und `BeaconPulse` als echte Transformationsclips. Das Hauptquartier hat 104 geometrische Teile, die Bastion 31. Die neutrale Bastion nutzt eine tatsächlich weiße Emission; Teamwechsel tauschen die vollständige passende gerenderte Fassung. Warmes Gehäusematerial bleibt erhalten.

## Erhaltenes Spielprinzip

Navigation, Gebäudefußabdrücke, Sichtquellen, automatische Angriffe, Wirtschaft und Save-Version 2 sind unverändert. Der Gebäudebau bleibt wie zuletzt gewünscht aus der Oberfläche entfernt. Hauptquartiere und Bastionen sind weiterhin Spielobjekte. Die übrigen fünf Gebäudetypen erscheinen in der Modellgalerie und für vorhandene Gebäude älterer Spielstände im gleichen Stil.

## Reproduzieren und prüfen

```sh
npm run assets:detailed-infantry
npm run assets:buildings
npm run assets:animation-audit
node --test tests/reborn-animation.test.mjs tests/reborn-buildings.test.mjs tests/reborn.test.mjs
npm --prefix tests/browser test
docker compose up --build -d
```

Gezielt geprüft: **39 Node-Fälle und 19 Chrome-Fälle bestanden**, einschließlich der kompletten Reborn-Browserprüfung gegen die abschließend neu gebaute Docker-Auslieferung auf `127.0.0.1:8095`. Die Node-Fälle umfassen 29 Reborn-Simulationen, acht Animation/Bewegung und zwei Gebäudemodell-/Registrierungsfälle. Der Browser prüft auch die wirklichen GLB-Dateien aller sieben Gebäudetypen, Schüsselbewegung bei festem Fundament, echte Modellfarben, feste Bodenschatten, gemeinsam geladene Infanterieatlanten, Waffenmündungen, vollständige Kampagne, Produktion, Speicherstände, Nebel, Audio, kompakte Oberfläche und die beiden Animationsansichten. Die umfangreiche Testsuite des Europa-Archivs gehört nicht zu dieser Änderung.

Quellen und Hashes: [ANIMATION_ASSETS.json](../reborn/ANIMATION_ASSETS.json). Gebäudemodelle: [ORIGIN.md](../../src/assets/reborn/buildings-3d/ORIGIN.md). Soldatenrig und Körperbewegungen: Quaternius, CC0, mit eigener Rüstung und offline gebackener beidhändiger Waffenhaltung; [Herkunft](../../src/assets/reborn/prototype/ORIGIN.md). Die fertigen Dateien liegen im Projekt und benötigen zur Spielzeit keine externen Dienste.
