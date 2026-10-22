# Finales Balancing und Performance-Polish, 22.10.2026

Auf dem vollständig erhaltenen lokalen RTS-Entwicklungsstand aufgebaut. Die Vorherfassung ist die am Anfang dieser Aufgabe gesicherte `dist`-Ausgabe einschließlich der vorherigen uncommitteten Verbesserungen, inzwischen als Commit `95bec88` vollständig erhalten. Alle 15 archivierten Quellenhashes stimmen mit diesem Commit überein (`preserved-baseline.json`). Sie ist **nicht** die ältere Git-Ausgangsrevision `d588326`. Deren Messungen bleiben im [vorherigen Bericht](../deep-game-20261022/README.md) erhalten. Keine geänderten Kampfwerte, Rekrutierungspreise, Schwierigkeitsparameter oder Abhängigkeiten. Kein Push, Merge oder Deployment.

## Ursache und begrenzte Korrektur

Die identische Vorherpartie (Seed 20261022, DE, balanced, 49 KI-Gegner, 1.000 echte Ticks) reproduziert exakt die bisherigen 51.210 gewonnenen Sektoren und 21.172,99 physischen Verluste. Gegenüber der älteren Git-Baseline waren das −2,1 % Gebiet und +8,3 % Verluste. Es wurden tatsächlich 32.099 Soldaten gekauft; höhere Bestände und Industrie allein belegten also keine effizientere Strategie.

Die gezielte Befehlsinstrumentierung ordnet vor dem Polishing 6.764,30 Kontaktverluste Marschbefehlen und 4.818,21 wartenden Verbänden zu. Neutrale Feldzüge verursachen 410,47 und feindliche Feldzüge 281,85 dieser Kontaktverluste. Rund 94,4 % entstehen damit beim Marschieren/Halten. Das ist die Kontaktphase, kein Ersatz für die vollständige Verlustbilanz einschließlich Besetzung und Versorgung. Die vorherige Planung konnte Verbände wiederholt zwischen Verteidigungsposten unter Turmfeuer verschieben, während ihr Gegenangriff unbewachte Türme ausdrücklich ausschloss.

Die abgeschlossene Korrektur lässt eine aktuell in Turmreichweite stehende Formation mit mindestens 75 realen Soldaten einen nahen unbewachten Turm durch den normalen Angriffsbefehl einnehmen. Die Landannäherung muss höchstens zwei orthogonale Schritte erlauben; echte gegnerische Deckung im Kontaktradius, Wasser, Allianzen und KI-Waffenruhen verhindern diese Gelegenheit. Die reguläre Expositionsprüfung entscheidet weiterhin über die bezahlbare Angriffsstärke. Ein solcher kurzer Angriff wird nicht sofort von der allgemeinen Verteidigungszuweisung abgebrochen. Bewegung, Einnahme und sämtliche Verluste bleiben physisch und unverändert berechnet.

Die erneut instrumentierte finale Referenzpartie bestätigt den Mechanismus: Kontaktverluste durch Türme sinken von 5.732,47 auf 3.383,60 (−41,0 %); Kontaktverluste marschierender Verbände von 6.764,30 auf 3.375,72 (−50,1 %). Ersetzte Marschbefehle sinken von 2.138 auf 1.380, während akzeptierte Angriffsbefehle von 2.579 auf 2.764 steigen. Die unabhängigen vollständigen Verlustsummen stehen separat in der Vergleichsmatrix.

Die unabhängige JSON-Replayprüfung deckte außerdem ein veraltetes Angriffszwischenziel auf: Eine zweite Formation konnte es nach dem Marsch der ersten bereits einnehmen. Die bestehende Bereinigung am Tickende verwirft nun freundlich gewordene Angriffszwischenziele und verlorene Marschziele, während Feldzugsziel und reale Soldaten erhalten bleiben. Ein gezielter Mehrverbands-Test prüft die Einnahmereihenfolge und den anschließenden echten JSON-Roundtrip. Die strenge Ladevalidierung bleibt erhalten.

Breitere Versuche mit veränderter Frontdeckung beziehungsweise engerer Bedrohungserkennung lieferten uneinheitliche Ergebnisse und wurden vollständig aus dem Produktcode zurückgenommen. Die als `discarded-*` markierten Daten sind ausschließlich Vergleichsartefakte.

## Vergleich unter identischen Spielbedingungen

Je Vorher-/Nachherfall: 120 Warmup-Ticks in einer separaten Partie, dann eine neue deterministische Partie mit 1.000 echten Ticks. Gleiche Seeds, Länder, Schwierigkeiten und passiver Mensch; kein zusätzliches Gold oder Truppen. Der Beobachter würde nach einem Spielende nur zum Weiterrechnen den Status zurücksetzen; die Referenz-DE-Partie bleibt regulär offen. Netto-Gebiet ist die Summe der KI-Gebietsänderungen; Gebietstausch zwischen KI-Ländern hebt sich darin auf. Verluste sind die reale Summe aller `attackFallen + defenseSpent`, einschließlich des Menschen, nicht bloß die Kampfanzeige.

| Spieler / Länder / Schwierigkeit / Seed | Gebiet vorher → nachher | Verluste vorher → nachher | Verluständerung |
|---|---:|---:|---:|
| DE / 50 / balanced / 20261022 | 51.210 → 52.196 | 21.172,99 → 17.954,44 | −15,20 % |
| DE / 9 / balanced / 20261022 | 46.923 → 46.798 | 1.272,02 → 1.369,31 | +7,65 % |
| ES / 50 / relaxed / 20261022 | 50.746 → 50.832 | 20.387,20 → 18.590,85 | −8,81 % |
| GB / 50 / intense / 20261022 | 51.058 → 51.303 | 19.326,75 → 18.374,50 | −4,93 % |
| FR / 50 / impossible / 20261022 | 52.178 → 51.268 | 20.760,72 → 19.509,51 | −6,03 % |
| IT / 9 / balanced / 20261013 | 46.964 → 47.006 | 1.933,40 → 1.934,20 | +0,04 % |
| PL / 50 / balanced / 221041 | 51.797 → 52.234 | 19.557,28 → 18.864,27 | −3,54 % |

Über diese sieben festen Fälle zusammen: **−7,48 % Verluste bei +0,22 % Netto-Gebiet**. Das ist eine deskriptive Summe dieser Szenarien, kein universeller Balancing-Nachweis. Die beiden 9-Länder-Fälle verbessern die Verluste nicht; beim unmöglichen FR-Fall fällt der Gebietsgewinn um 1,74 %. Diese Gegenbeispiele sind bewusst enthalten.

In der ursprünglichen DE-Referenz verbessert sich die Effizienz von 2,42 auf 2,91 gewonnene Sektoren je verlorenem Soldaten. Bezahlte Rekruten sinken von 32.099 auf 28.038, mittleres KI-Gold bleibt mit 824,26 → 812,16 stabil; Fabriken steigen von 22 auf 26. Gegenüber der älteren Git-Baseline liegen die Verluste nun 8,20 % niedriger, das Gebiet noch 0,19 % niedriger. Es wurde keine vollständige Beseitigung jedes historischen Gebietsnachteils nachgewiesen.

Die aktuelle Node-Messung zeigt im DE-50-Fall median 10,29 → 10,82 ms und p95 20,76 → 19,60 ms je Tick. Die taktische Korrektur ist kein pauschaler Simulations-Speedup. Alle Rohdaten einschließlich wirtschaftlicher Bestände, Quantile, Heap nach GC und Save-Hashes stehen in `before-simulation.json` und `after-simulation.json`.

## Profiling und Grafik

Chrome-CPU-Sampling erfasst den echten 250-ms-Spielzyklus und seine verschachtelten Methoden. Im Vorherprofil kosten 24 Kartenupdates insgesamt etwa 287 ms; davon entfallen 96 ms auf `contourRings` und 36 ms auf `territoryContours`. Ein gezeichnetes Frame benötigt median nur 0,8 ms. Der Engpass ist die synchrone Kombination aus Simulation, Kartenaufbau und Oberfläche, nicht die Infanterieanimation oder ein belegtes GPU-Problem. Alle beobachteten langen RAF-Intervalle überlappen einen solchen Spielzyklus.

Die einzige neue Rendereroptimierung überspringt vollständig gleichfarbige Marching-Squares-Zellen frühzeitig und verknüpft Konturendpunkte auf ihrem exakten Halbzellenraster mit numerischen statt neu erzeugten String-Schlüsseln. Koordinaten, Ringreihenfolge, Striche, Füllungen und Zeichenqualität bleiben erhalten. Kein Worker, kein Rendererwechsel, keine veränderte Tickfrequenz.

Identischer gespeicherter Zustand bei Tick 500, gleiche Frontkamera und 1440 × 1000 / DPR 1. Je 5 Warmup- und 20 isolierte Kartenupdates; anschließend 360 echte RAF-Intervalle bei laufender Partie. Diese Vorher-/Nachhermessungen laufen **ohne CPU-Sampling**, ohne parallel laufende Tests oder Simulationen.

| Browsermessung | Vorher | Nachher |
|---|---:|---:|
| Isoliertes Kartenupdate, Median | 9,4 ms | 4,4 ms |
| Isoliertes Kartenupdate, p95 | 10,0 ms | 8,3 ms |
| Kartenupdate im laufenden Spiel, Median | 14,4 ms | 6,7 ms |
| Gesamter 250-ms-Spielzyklus, Median | 39,7 ms | 31,4 ms |
| RAF-Intervall, Median | 16,7 ms | 16,7 ms |
| RAF-Intervall, p95 | 33,2 ms | 16,8 ms |
| RAF-Intervall, p99 | 33,4 ms | 33,4 ms |
| RAF-Intervalle >25 ms / 360 | 18 | 14 |

Die abschließenden Läufe umfassen jeweils 26 echte Simulationsticks. Der Live-Verlauf kann durch die verbesserte KI auseinanderlaufen; der isolierte Grafikzustand ist exakt gleich. Der Median des isolierten Kartenupdates sinkt um **53,2 %**. Lange Frames sind seltener, aber nicht vollständig verschwunden. Die kurzen Proben auf einem Apple M5 Max mit 18 Kernen und 48 GB RAM sind keine Garantie für jede Hardware oder Spielsituation; das getrennte Vorher-CPU-Profil enthält ebenfalls eine günstigere Frame-Verteilung als die native Vorherprobe. Eine frühere Nachherprobe vor der Zwischenzielkorrektur zeigt nur zwei lange Intervalle. Die finale Probe wird hier mit allen 14 Ausreißern angegeben; p99 bleibt bei 33,4 ms. Die Daten belegen die Kartenbeschleunigung klarer als eine stabile Verringerung sämtlicher Frameausreißer.

Beide Besitzer-Overlays haben über alle RGBA-Pixel denselben SHA-256-Hash: `8e6155f4ec959b381a5e2c777e3bc994024d932131d1429ec41cec00301ad765`. Zusätzlich stimmen in 160 verschieden breiten Testgittern und dem vollständigen Kartenfixture alle Kontursegmente und Ringe einschließlich ihrer Reihenfolge exakt mit der gesicherten vorherigen Implementierung überein. [Vorher-Overlay](before-native-overlay.png), [Nachher-Overlay](final-native-overlay.png), [Vorher-Front](before-native-front.png), [Nachher-Front](final-native-front.png). Die Live-Frontbilder zeigen auseinanderlaufende Partien, keinen Pixelvergleich.

## Abschlussprüfungen und Reproduktion

**368/368 Unit-, Simulations- und HTTP-Tests bestanden. 24/24 Browser-Integrationsprüfungen bestanden; nach der zusätzlichen Zwischenzielbereinigung bestehen die fünf direkt betroffenen RTS-Browserprüfungen nochmals.** Sieben unabhängige Wiederholungen bestätigen 277.129 rechtmäßige Positionsänderungen, exakte JSON-Fortsetzung ab Tick 500 und einen weiteren vollständigen JSON-Roundtrip bei Tick 1.000. Die abschließenden Testzahlen, Replay-Ergebnisse und Quellenhashes stehen in `manifest.json`. Die vollständigen Logs liegen neben diesem Bericht. Geprüft werden alle vier Schwierigkeiten, drei Seeds, Save/Load-Determinismus, reale Soldatenbilanz, Geldbestände und rechtmäßige Bewegung. Die Browserregression deckt RTS-Pointerbefehle, Pause, reduzierte Bewegung, Kampfdarstellung, vollständige Stärkezahlen, Diplomatie, Seewege, Topografie und kompakte Oberfläche ab. Automatische Screenshots schreiben in ignorierte Testartefakte, damit historische QA-Nachweise erhalten bleiben.

```sh
npm test
PORT=8097 node scripts/serve.mjs
# In einem zweiten Terminal:
ATLAS_BASE_URL=http://127.0.0.1:8097 npm --prefix tests/browser test -- deep-rts.spec.mjs compact-sidebar.spec.mjs naval.spec.mjs diplomacy.spec.mjs military.spec.mjs --reporter=list
ATLAS_QA_DIR=docs/qa/final-polish-20261022 node --expose-gc scripts/benchmark-deep-game.mjs after dist/src/engine/game.js --extended
ATLAS_QA_DIR=docs/qa/final-polish-20261022 node scripts/verify-deep-game.mjs
node scripts/diagnose-rts-polish.mjs after dist/src/engine/game.js
node tests/browser/final-polish-profile.mjs final-native --no-profile
node tests/browser/final-polish-profile.mjs after
```

Die Vorhermessung lässt sich aus Commit `95bec88` mit dem vorhandenen TypeScript-Compiler separat bauen: denselben Benchmark mit deren `game.js` als drittem Parameter ausführen, deren `dist` separat auf Port 8098 bereitstellen und `ATLAS_BASE_URL=http://127.0.0.1:8098 node tests/browser/final-polish-profile.mjs before-native --no-profile` verwenden. `verify-polish-contours.mjs` nimmt deren `territory-contours.js` als Argument. Die alten sieben unabhängigen Ergebnis-Hashes im vorherigen Bericht stimmen mit der frisch gemessenen Vorhermatrix überein. Quellen- und Baseline-Hashes dokumentiert `manifest.json`.

Der gesamte Git-Diff ist einschließlich der bereits vorhandenen uncommitteten Änderungen geprüft und lokal in fachlichen Commits abgeschlossen. `95bec88` erhält den vorherigen Entwicklungsstand als separat reproduzierbare Baseline; `9509733` enthält KI-Balancing und Zwischenzielbereinigung, `424efc6` die Konturoptimierung und ihre Prüfwerkzeuge. Dieser Bericht und die Rohdaten sind in einem separaten Dokumentationscommit gebündelt. Vorhandene Funktionen und historische Nachweise bleiben enthalten. Keine neuen großen Funktionsbereiche.

Die primären Abschlussartefakte sind `comparison.json`, `before-simulation.json`, `after-simulation.json`, `final-native-profile.json`, `replay-verification.json`, `full-tests.txt`, `browser-regression.txt` und `browser-final-rts.txt`. `before.cpuprofile` und `after.cpuprofile` halten die Engpassprofile fest. `after-native-*` und `pre-waypoint-*` dokumentieren den Zwischenstand vor der letzten Save/Load-Korrektur; für den Abschluss gelten die finale Simulation und `final-native-*`. Der echte kontrollierte Kontaktkampf ist in [final-contact.png](final-contact.png) dokumentiert.
