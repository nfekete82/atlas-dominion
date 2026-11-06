# Transporthelikopter — 28. Oktober 2026

Originales, prozedural modelliertes Mi-8/17-inspiriertes Transportfluggerät. Die Benutzerreferenz dient als Formvorlage; es wurden keine fremden Modell- oder Bildtexturen übernommen.

- Zwei eigenständige GLBs, blau/rot, interner Schlüssel `scout`.
- 37.130 Dreiecke, 13 zusammengefasste Meshes, 770 modellierte Bauteile/Flächensegmente.
- Drei eingebettete 1024 × 1024 PNG-Texturen: Wüstentarnung mit Abrieb/Kratzern, Normal Map und gepackte Occlusion/Roughness/Metallic Map. Gemeinsame Materialien und vorberechnete Tangenten; Glas mit Clearcoat und separater Materialcharakteristik.
- Fünf Hauptrotorblätter, drei Heckrotorblätter. Ein gemeinsamer zeitbasierter Sprite-Animationszähler bewahrt Rotor- und Propellerphasen auch beim Wechsel zwischen Stillstand und Bewegung. Der loopfähige Clip `Rotors_Continuous` animiert `MainRotor_Spin` um Y und `TailRotor_Spin` unabhängig um X. 65 Quaternion-Schlüssel je Kanal, 0,64 Sekunden pro Loop.
- Pro Team ein transparenter 3072 × 1536 Spriteatlas: 192 × 192 pro Frame, 16 Richtungen, je acht Phasen für Idle und Walk, insgesamt 128 gemeinsam genutzte Frames. Idle und Walk teilen die Bilddaten und vermeiden so 72 MiB dauerhaften Body-/Schatten-Canvas-Speicher und weitere 36 MiB Quellbild-Decodierung über beide Teams. Pivot `[96,156]`, Spielbreite weiterhin 106.
- Spielgröße und Galerieskalierung sind unabhängig. Die Galerie normalisiert nur ihre geladene Instanz, begrenzt den Zoom vor der Nebelzone und startet beide Rotorkanäle.
- Der bisherige Kampfhelikopter ist aus Katalog, Produktion, KI, Auswahl, Galerie und Asset-Build entfernt. Seine sechs alten Assets wurden nach Entfernen der Laufzeitreferenzen gelöscht.

## Reproduzieren

```sh
npm run assets:transport
npm test
ATLAS_BASE_URL=http://127.0.0.1:8095 npm --prefix tests/browser test
```

`assets:transport` verwendet die vorhandene Playwright/Three.js-Pipeline. Der erste Schritt exportiert die autorisierten GLBs. Der zweite lädt diese GLBs und schreibt ausschließlich PNG/JSON; auch `--export-glb` kann die originalen Transport- oder Bomber-GLBs nicht ersetzen. Es wurden keine Projektabhängigkeiten ergänzt.

## Savegames und Transport

Alte `gunship`-Einheiten werden mit gleicher ID, Besitzer und proportionalen Lebenspunkten nach `scout` migriert. Andere Einheiten, Befehle und Passagiere bleiben erhalten. Alte Produktionsaufträge werden unter Erhalt des relativen Fortschritts und ihres ursprünglichen Erstattungsbetrags umgewandelt. KI-Sparziele, Sichtungen und Produktionszähler werden mitmigriert; Zählerkollisionen addiert. Die Migration arbeitet auf einer Kopie und wird weiterhin streng validiert.

Zusätzlich behoben: Der Landeanflug akzeptiert nun den 18-Meter-Ankunftsbereich der Bewegungslogik. Zuvor konnte ein bei etwa 14 Metern abbremsender Helikopter dauerhaft vor der 13-Meter-Landeschwelle stehenbleiben.

## Nachweise

Die JSON-Dateien `gltf-validation-0/1.json` enthalten die offiziellen Khronos-Validatorberichte. `gallery-blue.png`, `gallery-red.png` und `game-transport.png` dokumentieren die Browseransicht. Die Bomber-GLBs und beide Bomber-Atlanten wurden per SHA-256 mit dem Ausgangszustand verglichen und sind bytegleich.

Der Validator wurde nur temporär unter `/tmp` installiert; er ist keine neue Projektabhängigkeit. Das Modell ist für die RTS-Darstellung gestaltet; es enthält keinen begehbaren Kabineninnenraum.

## Abschließende Testergebnisse

- `npm test`: 697 Prüfungen, 696 bestanden, keine Fehler. Ein bereits vorhandener Premium-Infanterie-Test wird wegen nicht installierter Binärassets übersprungen. Kein Test wurde neu deaktiviert.
- 13 relevante Playwright-Prüfungen auf Port 8095 bestanden: Galerie mit Teamwechsel, Orbit/Zoom und beiden Rotoren, alle Sprite-Ränder, zehn Passagiere, echter Flug und Ausladen, Produktion und Save/Load, Bomber-Animation und Canvas-Performance.
- Gesamter Reborn-Browserlauf: 59 von 69 bestanden. Die neun dauerhaft fehlgeschlagenen Altprüfungen wurden im unveränderten Ausgangscommit separat nachgestellt. Dazu kam ein zufallsabhängiger Erreichbarkeitstest neuer Karten; auch dieser schlug beim Ausgangscommit in einer von fünf Wiederholungen fehl. Alle zehn offenen Prüfungen sind mit Namen in `test-results.json` aufgeführt. Sie betreffen bestehende Infanteriegrafik, alte HUD-/Farbannahmen, Kampfreaktionsannahmen, einen Audio-Dialogablauf und zufällig unerreichbare Kartenpositionen.
- Beide GLBs: offizieller Khronos-Validator ohne Fehler oder Warnungen. Alle sechs GLB-/PNG-/JSON-Dateien sind über zwei vollständige Builds byteidentisch.
- Die komplette Bomber-Assetfamilie ist gegenüber dem Ausgangscommit per SHA-256 unverändert. Der gemeinsame Spritezeitgeber wurde gezielt auf phasengleiche Übergänge für beide Fluggeräte geprüft.
- Docker wurde neu gebaut und gestartet. Spiel und Galerie antworten mit HTTP 200; ausgelieferte GLBs und PNGs stimmen bytegenau mit den Quelldateien überein. Der alte Kampfheli-Download antwortet mit HTTP 404.

Es gibt keine bekannte offene Einschränkung der angeforderten Transporthelikopter-Funktionen. Die oben genannten bestehenden Browser-Testfehler und die fehlenden optionalen Premium-Infanterieassets bleiben offen.
