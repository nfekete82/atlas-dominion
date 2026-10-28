# PBR-Raketenwerfer — 28. Oktober 2026

Nachfolgender optischer Nachschliff: [Tarnlackierung wie beim Panzer mit 2K-Details](../rocket-camouflage-20261028/README.md). Die Bilder und Texturangaben dieses Berichts dokumentieren die ursprüngliche Sandlackierung.

Eigenes, vollständig modelliertes 6×6-Fahrzeug im Stil der vom Nutzer beigefügten HIMARS-Referenz: gepanzerte Kabine, drei Achsen mit sechs Geländerädern, Leiterrahmen, Differenziale, Blattfedern, Kardanwelle, Tanks, Abluft, Kühlergrilles, Türbeschläge, Spiegel, Schleppösen, Rückleuchten, zwei Peitschenantennen und eine Schleifenantenne. Der sechsfache Wechselbehälter besitzt einzelne räumliche Rohre, vertiefte Abschlüsse, Metallränder, Hebebügel, Wartungsklappen, Drehkranz und echte teleskopierende Hydraulik.

- Zwei selbstständige GLBs: `artillery-0.glb` und `artillery-1.glb`.
- Je 46.770 Dreiecke, 33 gebündelte Meshes, 999 modellierte Bauteile/Segmente. Zum Vergleich: das ersetzte Modell hatte 111.484 Dreiecke.
- Drei eingebettete 1024²-PBR-Texturen: Sandlack mit Abrieb/Kratzern, Normal Map und gepackte Ambient Occlusion/Roughness/Metallic Map. Eigene Materialeigenschaften für Reifen, Stahl, Glas, Teamlack und Leuchten. Vorberechnete Tangenten.
- Zwei echte glTF-Clips: `Wheels_Roll` animiert alle sechs Radpivots um X; `Launcher_Operation` bewegt Drehkranz, Werferneigung, beide Hubzylinder und ihre Kolbenstangen in einem geschlossenen 6-Sekunden-Zyklus.
- Pro Team ein 3072 × 2880 Spriteatlas: 192² Pixel, 16 Blickrichtungen, je eine Standansicht, vier Radphasen für Fahrt und beide Drehrichtungen sowie getrennte Drehkranz-/Werferlayer. Insgesamt 240 Frames, Pivot `[96,156]`.
- Jede der sechs Mündungen ist direkt aus ihrer GLB-Position in die 16 Werferansichten projiziert. Geschosse und Startblitze wählen dieselbe Mündung anhand der stabilen Geschoss-ID. So bleibt die visuelle Zuordnung auch nach Save/Load korrekt, ohne das Saveformat zu erweitern.

## Integration

Der sichtbare Name lautet in Spiel, HUD, Katalog und Galerie **Raketenwerfer**. Der interne Schlüssel bleibt `artillery`. Reichweite 680, Sicht 830, Schaden 120, Feuerintervall 3,8 s, Kosten 600, Bauzeit 18 s, LP 340 und Bewegungstempo 65 sind unverändert. Alte Einheiten, bezahlte Warteschlangen und fliegende Geschosse bleiben ohne Schemawechsel ladbar. Der Werfer schießt weiterhin einzelne Geschosse mit der bestehenden Simulation und dem bisherigen Schaden; die sechs Rohre verändern die Balance nicht.

Die Galerie passt nur ihre geladene Instanz an, begrenzt die Kamera vor der Nebelzone und spielt Rad- und Werferanimationen ab. Spielgröße und Galerieskalierung sind unabhängig. Im Spiel bleiben Fahrgestell und Werfer getrennt ausgerichtet. Der Spriteexport trennt den im Drehkranz verschachtelten Werfer ausdrücklich ab, damit er nicht doppelt gezeichnet wird.

## Reproduzieren

```sh
npm run assets:rocket-launcher
npm test
ATLAS_BASE_URL=http://127.0.0.1:8095 npm --prefix tests/browser test
```

`build-rocket-launcher.mjs` und `build-transport-helicopter.mjs` verwenden denselben deterministischen Exporter (`export-authored-vehicle.mjs`) und dieselbe PBR-Texturfabrik. Keine zusätzlichen Projektabhängigkeiten. Der PNG-/JSON-Renderer lädt die fertigen GLBs und exportiert sie auch mit `--export-glb` nicht neu.

Der Helikopter-GLB-Export wurde nach der gemeinsamen Abstraktion erneut ausgeführt: seine Ausgabedateien sind byteidentisch. Alle 18 GLB-/PNG-/JSON-Dateien von Transporthelikopter, Bomber und Panzer sind gegenüber dem Ausgangscommit unverändert. Der alte Zwölfrohr-Raketenwerfer ist aus dem Fallback-Generator entfernt.

## Nachweise

Die beiden Khronos-Validatorberichte, Hashvergleiche, Screenshots und Testergebnisse liegen in diesem Ordner. `sprite-directions.png` zeigt die 16 zusammengesetzten Spielansichten mit Chassis, Drehkranz und Werfer. `gallery-blue.png`, `gallery-detail.png`, `gallery-red.png` und `game-firing.png` zeigen die echte Browserdarstellung. Der Validator ist nur temporär unter `/tmp` installiert und keine Projektabhängigkeit.

## Testergebnisse

- Vollständiger Node-Lauf: 703 Prüfungen, 702 bestanden, keine Fehler; ein bereits vorhandener optionaler Premium-Infanterie-Test übersprungen. Danach 37 relevante Modell-, Gameplay- und Regressionstests der finalen Mechanik erneut bestanden.
- 17 abschließende Chrome-Browserprüfungen bestanden: beide Teammodelle, Rad-/Werfer-/Hydraulikbewegung, freier Hubweg über dem Chassis, Kamera und Zoom, keine abgeschnittenen Spriteframes, separate Waffenlayer, sechs Mündungen, Fabrikproduktion, gespeicherte Raketen und tatsächlicher Einschlag, Helikopter und Bomber sowie Canvas-Performance.
- Gesamter Browserlauf: 62/73 bestanden. Von den elf Fehlern war einer eine alte Erwartung von zwölf statt sechs Rohren; sie ist korrigiert und im abschließenden Lauf erfolgreich nachgeprüft. Die zehn übrigen Fehler sind die schon beim Helikopter dokumentierten Bestandsfehler einschließlich des zufallsabhängigen Karten-Erreichbarkeitstests. Namen und Vergleichsnachweise stehen in `test-results.json` bzw. dem verlinkten Helikopter-Prüfbericht. Kein Test wurde deaktiviert.
- Beide GLBs bestehen den offiziellen Khronos-Validator ohne Fehler und Warnungen. Alle sechs finalen GLB-/PNG-/JSON-Dateien sind über vollständige Builds byteidentisch. Zusätzlich getestet: `--export-glb` überschreibt die Original-GLBs nicht.

Es gibt keine bekannte offene Einschränkung der angeforderten Raketenwerfer-Funktionen. Die zehn genannten bestehenden Browser-Testfehler bleiben außerhalb dieser Modelländerung offen.

Performance-Kurzprüfung: acht vorhandene Szenarien, je drei Sekunden mit Chrome bei 1440×1000 und ohne CPU-Drosselung. Frame-p95 in allen Szenarien 16,7–16,8 ms. Die gespeicherten Simulationszustände nach jeweils 120 festen Ticks sind in allen acht Szenarien bytegleich zum Helikopter-Vergleichslauf. Diese kurze Messung ist kein Langzeit-Stresstest. Docker läuft auf Port 8095; Spiel, Galerie und alle sechs ausgelieferten Assets antworten mit HTTP 200 und stimmen mit den Workspace-Dateien überein.
