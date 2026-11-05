# Sandforge – Qualitätsprüfung vom 05.11.2026

Ausgangspunkt: Commit `6ab2722`, sauberer Branch `feat/sandforge-vehicle-frontlines-base-spacing-20261102`, bestehender [PR #184](https://github.com/nfekete82/atlas-dominion/pull/184). Kein Merge und kein Deployment. Die Änderungen bilden einen überprüften Verbesserungsschritt, keine vollständige Abnahme des gesamten Spiels.

## Bestandsaufnahme und Prioritäten

Das Hauptspiel verwendet Canvas 2D mit 20 festen Simulationstakten pro Sekunde. Three.js erzeugt Sprites aus 3D-Quelldaten und betreibt die separate Galerie; ein WebGL-Umbau des Spiels ist für die gefundenen Fehler nicht erforderlich. Die Simulation enthält getrennte Systeme für Navigation, Sicht, Produktion, Transport, taktische KI und Kampagnenspeicher. Der Branch enthält bereits viele Änderungen an Formationen und Gebäudefreiraum; diese wurden beibehalten.

| Priorität | Befund | Ergebnis dieser Sitzung |
| --- | --- | --- |
| P1 | Abgebrochene Befehlsmodi hinterlassen Zielmodus/Cursor; Stoppen kann einen ausstehenden Angriff stehenlassen. Fokusverlust lässt eine unfertige Rechteckauswahl bestehen. | Eingabestatus konsistent zurückgesetzt, fünf neue Browserfälle. Esc beendet zuerst den Modus und behält die Auswahl. |
| P1 | Waffenanker folgen weder Chassisneigung noch Rohr-/Hydraulikrückstoß. Fahrzeuge ohne unabhängigen Turm verwenden teilweise eine andere Schussrichtung als der gezeichnete Rumpf. | Anker mit tatsächlichen Zeichentransformationen synchronisiert. 80 Kombinationen aus fünf Rollen und 16 Richtungen im Browser gegen die Canvas-Matrix geprüft. |
| P1 | Jeder Zielsuche-Aufruf kopiert die ganze Armee und sucht selbst nach leeren Kampf-IDs linear. | Vorhandenen, pro Tick aktualisierten ID-Index wiederverwendet. Deterministischer Vergleich gegen lineare Referenz und gezielter CPU-Benchmark. |
| P1 | Die vollständige Ausgangssuite ist bereits rot. | 18 Fehler reproduziert; unveränderte Fehlerstellen nach den Änderungen dokumentiert. Nicht durch pauschale Anpassung von Balancewerten oder Abschwächen der Tests überdeckt. |
| P2 | KI-Testarena lehnt die aktuellen Karten 11–14 ab. | CLI akzeptiert jetzt alle vorhandenen generierten Karten 3–14 und verwirft ungültige Versionen. Acht budgetgebundene Vergleichspartien durchgeführt. |
| P2 | HUD-/Pixelreferenztests und HQ-Hinweis entsprechen älterem Start-/Grafikstand. README nennt falsche Steuerung, Startwerte und Panzerkosten. | Fixtures und die unabhängige Save/Restore-Pixelreferenz auf den aktuellen visuellen Vertrag aktualisiert; Anleitung berichtigt. |
| Offen | Missionsabbrüche und unvollständige HQ-Offensiven in der KI-Arena. | Messbar gemacht; noch keine Strategieänderung oder allgemeine Verbesserung der KI-Spielstärke behauptet. |

## Tatsächlich implementiert

- `input.ts`: gemeinsame Bereinigung von Platzierungs-, Bewegungs- und Angriffszielmodi bei Abbruch/Stoppen; Fokusverlust löscht Tastenzustand, Auswahlrechteck, Minimap-Drag und Weltzeiger.
- `unit-presentation.ts`: identische Federungs-/Rückstoßparameter für gezeichnete Sprites und Mündungsanker. Hydraulikrotation, Chassis-Rollwinkel, Pitch, Höhenversatz und vorhandene individuelle Rohranker werden berücksichtigt. Fahrzeuge ohne separates Turmlayer verwenden den tatsächlich sichtbaren Animationsframe. Historische Projektilpositionen bleiben Simulationsdaten; Interpolation zwischen Ticks wurde nicht neu entworfen. Das separate Panzer-Dach-MG verwendet weiterhin seinen bisherigen Hilfsanker und wurde nicht auf einen neu verfassten Modellanker umgestellt.
- `simulation.ts`: gezielter Entity-Lookup ohne temporäre Kopie der gesamten Armee. Zielprioritäten, Sichtprüfungen, Kampfwerte und Speicherformat bleiben erhalten.
- Benchmark-CLI, Regressionstests, reproduzierbarer Zielsuche-Benchmark und Dokumentation ergänzt.

Keine Modelle oder Texturen neu erzeugt. Keine wirtschaftlichen KI-Boni eingeführt, keine Spielstände gelöscht, keine Produktionsveröffentlichung vorgenommen.

## Modell- und Sichtprüfung

Die tatsächlich verwendeten GLBs wurden gelesen: Panzer mit 412 Nodes einschließlich `Hull` und `Tank_Turret` (keine eingebetteten Animationsclips), Raketenwerfer mit 52 Nodes, sechs Radgruppen, `Tank_Turret`, `Wheels_Roll` und `Launcher_Operation`; Transporthelikopter mit 16 Nodes, `MainRotor_Spin`, `TailRotor_Spin` und `Rotors_Continuous`. Fehlende Panzer-GLB-Clips werden nicht als vorhandene Skelettanimation ausgegeben; das Spiel verwendet die vorhandenen gebackenen Layer.

Der bestehende Gebäudeverifizierer bestätigt **15 GLBs** einschließlich eingebetteter PBR-Daten, UVs, Geometrie, Clips, Fraktionen und Spriteframes. Browserprüfungen erfassen zusätzlich sichtbare Fahrzeugbewegung/Rückstoß, Gebäudebau, Formationen, Gebäudefreiraum und pixelgleiche Layerausgabe.

Die aufgenommenen Spielbilder wurden visuell betrachtet: [gemischte Kolonne](armored-vanguard.png), [Sanitäter und Basis](support-medic.png), [Wüsten-/Gebäudeansicht](desert-visual-polish.png), [aktueller HQ-Start](radar-online-hq.png). Einheitliche warme Wüstenfarben und gut lesbare Fahrzeuge sind vorhanden; aus diesen begrenzten Ansichten wird keine vollständige Freigabe aller Assets und Zoomstufen abgeleitet.

## Messungen

[Zielsuche-Rohdaten](combat-performance.json): Node auf macOS/ARM64, 96 Einheiten, 1.000 Durchläufe, sieben Stichproben mit alternierender Reihenfolge und Aufwärmphase. Verglichen wurde das vor der Optimierung kopierte vollständige Modulverzeichnis gegen den aktuellen Build. Die Datei enthält Quellhashes und Umgebung. Das ist ein isolierter CPU-Test, keine FPS- oder Langzeit-Speichermessung.

| Situation | Vorher, Median ms | Nachher, Median ms | Weniger CPU-Zeit |
| --- | ---: | ---: | ---: |
| Untätige Einheiten | 113,55 | 102,84 | 9,4 % |
| Gehaltenes Kampfziel | 44,49 | 26,71 | 40,0 % |
| Direkter Angriffsbefehl | 15,76 | 3,57 | 77,3 % |

Ein erster Lauf ergab für untätige Einheiten 16,7 % statt 9,4 % Einsparung; die Unterschiede zeigen die Messstreuung. Maßgeblich sind die beigefügten finalen Rohdaten.

[KI-Rohdaten](ai-arena.json) und [Auswertung](ai-arena.md): vier aktuelle Karten, Seed 2026, Baseline und Director, je 300 Simulationssekunden, normales Budget gegen das unveränderte BLUE-Verteidigungsskript. **Alle acht Partien enden am Zeitlimit**, ohne daraus Siege/Niederlagen abzuleiten. Director: durchschnittlich 416,917 HQ-Schaden gegenüber 154,417 der Baseline; vier vergleichbare Startwelten, keine Abweichung. Zwei Director-Partien zeigen häufige Missionsabbrüche, eine ein erkanntes HQ ohne Schaden. Ein Seed und ein Gegner reichen nicht für eine allgemeine Balanceaussage.

Die Arena startet ausdrücklich mit bereits vorhandenen HQs (`new Simulation`), auch auf den aktuellen Kartengeometrien. Der aktuelle Start ohne HQ wird separat in echten Browserfällen geprüft; er ist kein Teil dieses Arenavergleichs.

## Teststand und verbleibende Fehler

- Build und TypeScript: bestanden.
- Vollständige Node-Suite vorher: **1.102 Tests, 1.083 bestanden, 18 fehlgeschlagen, 1 übersprungen**.
- Vollständige Node-Suite nachher: **1.105 Tests, 1.086 bestanden, dieselben 18 fehlgeschlagen, 1 übersprungen**. [Maschinenlesbarer Vergleich mit sämtlichen Fehlernamen](node-comparison.json).
- Zwei fokussierte Node-Läufe: 39/39 für Animation, Gebäude-Rigs, Navigation/Profiler, KI-Berichtswerkzeuge und Steuerung sowie 41/41 für Zielindex, Kampf, Halten/Rückzug, Wetter und Türme. Diese Läufe überschneiden sich; die Zahlen werden nicht addiert.
- Neue Zielindex-Regression: vollständige Spielstände über 240 Ticks auf vier aktuellen Karten identisch zu einer linearen Referenz, einschließlich bezahlter KI-Aktionen. Entfernte Ziele und ersetzte Einheitenarrays verlieren ihre alten Locks.
- Browser: **29/29 bestanden**, vollständiges Protokoll in `browser-acceptance.txt`; Chrome, echte Assets, Canvas-Pixel und IndexedDB. Nicht die gesamte Browser-Suite wurde ausgeführt.
- `git diff --check`: bestanden.

Die verbleibenden Node-Fehler betreffen unter anderem exakten Floatvergleich, geänderte Waffen-/Produktions-/Einnahmeannahmen, Palmen-Zeichenpfade und taktische Gruppen/Bewegung. Ihre individuellen Ursachen sind noch nicht alle geklärt. Nächste Schritte: erst diese 18 Fälle jeweils gegen den beabsichtigten Spielvertrag auflösen, dann Missionswechsel auf mehreren Seeds prüfen und längere Browserprofile mit großen Gefechten sowie Speicherverlauf aufnehmen. Vollständige Browserabnahme, Langzeitstabilität und eine umfassende optische Überarbeitung stehen weiterhin aus.

Ein zwischenzeitlicher paralleler Browserlauf kollidierte mit denselben Trace-Verzeichnissen und dem Testserver. Er ist kein Abnahmenachweis; die betroffenen Fälle wurden anschließend gemeinsam mit einem Worker wiederholt.

## Lokal wiederholen

```sh
npm ci
npm ci --prefix tests/browser
npm run dev
# http://127.0.0.1:8095
```

```sh
npm test # enthält die oben dokumentierten 18 offenen Ausgangsfehler
node scripts/validate-building-assets.mjs
node --test tests/reborn-combat-index.test.mjs tests/benchmark-ai-metrics.test.mjs tests/ai-test-arena.test.mjs
npm --prefix tests/browser test -- --grep 'command cancellation:|weapon sockets|performance:|combined-arms column|infantry.*building|six-wheel launcher|holding WASD|support HUD:|HQ opening:|visual polish:'
node scripts/benchmark-combat-acquisition.mjs
node scripts/ai-test-arena.mjs --maps 11,12,13,14 --seeds 2026 --seconds 300 --modes baseline,director --output /tmp/sandforge-ai.json
```

Für den Vorher-/Nachher-CPU-Vergleich vor einer Änderung das vollständige `dist/src`-Verzeichnis sichern und danach `node scripts/benchmark-combat-acquisition.mjs /pfad/zur/kopie/reborn/simulation.js` aufrufen. Ohne Referenzpfad wird ausschließlich der aktuelle Stand gemessen. Browserläufe nacheinander ausführen, da die bestehende Konfiguration gemeinsame Artefaktpfade und Port 8097 verwendet.
