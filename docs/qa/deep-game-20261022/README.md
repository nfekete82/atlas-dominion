# ATLAS DOMINION: RTS-Weiterentwicklung, 22.10.2026

Archivierter Zwischenstand vor dem abschließenden Polishing. Die folgenden Ergebnisse und der damalige uncommittete Status beschreiben diesen Zwischenstand. Den weiterentwickelten und lokal committeten Abschluss dokumentiert der [Folgebericht](../final-polish-20261022/README.md).

Lokale Änderungen auf `feat/rts-final-integration`, Ausgangsrevision `d58832638fd8cbf056887c904a58bf62531f23a5`. Kein Commit, Push, Merge oder Deployment. Der Ausgangs-Workspace war sauber. Keine neuen Abhängigkeiten und keine Änderung der Grafik-Engine.

## Fünf priorisierte Probleme und umgesetzte Verbesserungen

| Priorität | Tatsächliches Problem | Umsetzung |
|---|---|---|
| 1. Verlässliche Truppeninformationen | HUD, Rangliste und Kartenstärken ließen RTS-Feldtruppen aus. Eingeschiffte Gruppen wirkten teilweise weiter als Landbedrohung und konnten über Befehle/Rückruf sofort wieder an Land verfügbar werden. Mehrere Treffer konnten mehr Tote anzeigen als tatsächlich gebucht. | Vollständige Summen aus realen Beständen; Schiffe aus Landbedrohung, Besatzungsschutz und Landmarkern entfernt; Landbefehle/Rückruf während der Überfahrt abgewiesen. Kontaktverluste werden proportional auf die tatsächlich vorhandenen Soldaten begrenzt. Turmfeuer meldet den echten Gegner und keine erfundene Infanterie. Defensive Tickverluste werden vor dem Kampf zurückgesetzt. |
| 2. Strategische und taktische Entscheidungen | Unterstützung wurde auch aus entfernten Landkomponenten abgeleitet; lokale Reserveverbände halfen bei der Angriffsbewertung nicht. Die gewählte Verteidigungshaltung wurde beim Erteilen neuer Angriffe übergangen. Kleine unverteidigte Restgebiete konnten hinter der Front liegen bleiben. | Nur über eigenes Land verbundene nahe Formationen zählen als unmittelbare Unterstützung. Theaterziele verwenden die tatsächliche Stärke ihrer Landkomponente. Verteidigung/Erholung begrenzen neue Offensiven. Expansive, aggressive, defensive und opportunistische Stile gewichten Ziele unterschiedlich. Ab Tick 600 sichern freie nahe Verbände sichere kleine Restgebiete durch echte Marsch-/Angriffsbefehle; Allianzen und Waffenruhen bleiben geschützt. |
| 3. Nachhaltige Armeen und Wirtschaft | Die RTS-KI nutzte ihre Wirtschaftsplanung nicht; zurückgekehrte Truppen wurden nicht regulär aufgefüllt. Unabhängig vom Gegner blieben neue Gruppen bei 100 Soldaten. | Bezahlte Auffüllung an tatsächlich erreichten Kasernen. Angemessene Formationsgröße nach beobachteten Grenzgegnern, maximal 300 und immer zum normalen Preis. Echter Goldpuffer für Rekruten und Türme. Versetzte Investitionen in sichere verbundene Fabriken, begrenzte Ausbauten und Stadthubs. Keine neuen Start-, Wachstums- oder Kampfboni; alle vier Schwierigkeitsgrade bleiben bestehen. |
| 4. Lesbare lebendige Kämpfe | Kämpfende Verbände verschwanden in Sammelmarkern oder ihre Zahlen überdeckten sich. Diagonale Bewegungen und Gruppen sprangen; Schiffe erschienen zusätzlich am Hafen. Neutrale Angriffsbefehle konnten Kampfeffekte vortäuschen. | Räumliche Gruppensuche; echte Kontakte bleiben sichtbar. Dichte Kampfverbände erhalten getrennte Marker mit Verbindung zur tatsächlichen Position und passenden Klickflächen. Stärkeanzeige, ausgewählter Marsch-/Kampfstatus, glatte diagonale und gruppierte Bewegung sowie Überfahrten. Reduzierte Bewegung und Pause werden berücksichtigt. Routenlinien folgen vorhandenen Marschrouten; Effekte benötigen tatsächliche Kampfereignisse. |
| 5. Rechenzeit und Allokationen | Eine Flächenzeichnung pro Sektor, wiederholte Vollsuchen zur Auftragserteilung, wiederholt erzeugte Kontaktringe und Sortierung von Gebäuden pro Frame. | Zeilenweise zusammenhängende Füllungen mit exakt denselben Pixelkanten. Vorhandene gerichtete Pfadsuche statt flächiger Erreichbarkeitssuche; begrenzte KI-Suchbudgets bleiben bestehen. Zwei feste, auf je 2.048 Einträge begrenzte Geometriecaches für Kontaktradien. Gebäudesortierung und Kampfzuordnung beim Kartenupdate; räumliche Marker-Buckets und wiederverwendete Bedrohungszahlen im HUD. |

Die Architekturprüfung umfasste `Game.step`, Rekrutierung, Reserven/Garnisonen/Formationen, Wirtschaft, Diplomatie, Seewege, Landpfade, Frontier-Index, Capture-/Kontaktkampf, Canvas-Layer, Steuerung und bestehende QA-Berichte. Die GitHub-Issue-Abfrage (`repo:nfekete82/atlas-dominion is:issue`) lieferte über den verbundenen Connector keine Treffer; das wird nicht als unabhängiger Nachweis interpretiert, dass keine Issues existieren.

## Gemessene Ergebnisse

| Messung | Vorher | Nachher |
|---|---:|---:|
| Kartenupdate, identischer pausierter Zustand, Median ms | 13,20 | 10,00 |
| Kartenupdate, laufende Partie, Median ms | 18,40 | 14,70 |
| RAF-Bildintervall, laufende Partie, p95 ms | 33,30 | 33,30 |
| Simulation, 50 Länder, median ms | 9,76 | 9,22 |
| Simulation, 50 Länder, p95 ms | 16,92 | 16,17 |
| Simulation, 50 Länder, p99 ms | 20,08 | 20,05 |
| Simulation, 9 Länder, median ms | 3,48 | 3,14 |
| Simulation, 9 Länder, p95 ms | 6,39 | 6,26 |
| Simulation, 9 Länder, p99 ms | 7,80 | 7,68 |

Im identischen Grafikzustand sinkt der Median des Kartenaufbaus um rund **24 %**, in der laufenden Probe um rund **20 %**. Die p95-Bildintervalle bleiben bei 33,3 ms. Die Simulation verbessert ihren gemessenen Median im 50-Länder-Fall um rund 5,6 %, im 9-Länder-Fall um rund 9,7 %; p99 bei 50 Ländern bleibt praktisch unverändert. Das sind Einzelmessungen, keine statistisch abgesicherte Hardware-übergreifende Zusage.

Der balancierte DE-Vergleich bei Tick 1.000 zeigt auch den Preis der aktiveren Armeen:

| Gameplay / reale Bestände | Vorher | Nachher |
|---|---:|---:|
| Netto-Gebietsgewinn aller KI-Länder | 52296,00 | 51210,00 |
| Physische Verluste aller Länder | 19558,06 | 21172,99 |
| Lebende Soldaten in allen Beständen | 13141,94 | 15426,01 |
| Tatsächlich bezahlte Rekruten einschließlich Auffüllung | 28200,00 | 32099,00 |
| Mittleres Gold je KI-Land | 996,22 | 824,26 |
| Fabriken auf der Karte | 0 | 22 |

Damit liegt der KI-Gebietsgewinn hier rund **2,1 % niedriger**, die physische Verlustzahl rund **8,3 % höher**. Es gibt mehr lebende bezahlte Soldaten und produktive Infrastruktur, aber keine belegte globale Verbesserung der Verlusteffizienz. Beim 9-Länder-Fall steigt der Gebietsgewinn geringfügig von 46.907 auf 46.923, die Verluste steigen von 1.038,10 auf 1.272,02. Diese Nachteile werden nicht ausgeblendet.

Hardware: Apple M5 Max, 18 Kerne, 48 GB RAM; Node v25.9.0; lokales Chrome. Zeitwerte sind rechner- und lastabhängig. Keine Tests oder anderen Simulationen liefen während der finalen Vergleichsmessungen. Die Simulationsmessung enthält einen ungemessenen 120-Tick-Warmup, dann einen neu gestarteten Spielstand mit 1.000 echten Ticks. Nach einem Spielende wird nur im Performance-/Replay-Beobachtermodus weitergerechnet; leere `step()`-Aufrufe zählen niemals als Ticks. Quantile verwenden den sortierten Index `floor(n*p)`.

Der isolierte Grafikvergleich verwendet denselben gespeicherten 50-Länder-Zustand bei Tick 500, 1440 × 1000, DPR 1 und denselben Kamerablick. Je 20 Kartenupdates und 120 RAF-Intervalle werden erfasst. Die zusätzliche laufende Browserprobe umfasst 300 RAF-Intervalle und 22 echte Simulationsticks ab demselben Ausgangszustand. Dort entwickeln sich die Kämpfe je nach KI-Version unterschiedlich. Die Simulationstabelle beschreibt ebenfalls die Gesamtänderung mit verändertem KI-Verlauf und keinen isolierten Algorithmus-Mikrobenchmark.

## Tests und Langzeitverhalten

**363/363 Unit-, Simulations- und HTTP-Tests bestanden; 24/24 Browser-Integrationsprüfungen bestanden.** Die elf betroffenen Grafik-/Steuerungsprüfungen wurden nach der Korrektur der Kartensummen zusätzlich erfolgreich ausgeführt. Die fünf neuen RTS-Smoke-Tests bestehen auch nach den abschließenden Beschreibungstexten. Der finale Build und `git diff --check` bestehen.

Sieben unabhängige Wiederholungen über je 1.000 echte Ticks decken alle vier Schwierigkeitsgrade, drei Seeds, sechs Spielerfraktionen sowie 9 und 50 Länder ab. Bei Tick 500 wird tatsächlich nach JSON serialisiert und neu geladen; die Fortsetzung stimmt exakt mit der ununterbrochenen Referenz überein. Die Referenzhashes stimmen außerdem mit der getrennten Messmatrix überein.
Insgesamt wurden **288.709 Positionsänderungen** direkt beim Schreiben geprüft: höchstens eine Bewegung je Tick, gültige Landnachbarschaft, keine gesperrten diagonalen Ecken und bei Landungen eine gültige tatsächliche Seeroute. Keine unzulässigen Bewegungen; größter absoluter Bilanzfehler in diesen Wiederholungen: 5.82e-11 Soldaten (Prüftoleranz 1e-6).

Drei weitere aktive Testspieler-Läufe (DE/ausgeglichen, GB/entspannt, FR/unmöglich) erreichen je **5.000 Ticks**, entsprechend 20:50 Minuten simulierter Spielzeit. Sie nutzen ausschließlich normale bezahlte öffentliche Befehle; es gibt keine zusätzlichen Einheiten oder Geldgeschenke. Alle drei Partien sind am Limit noch offen. Die reale Truppenbilanz und nichtnegative Geldbestände werden jeden Tick geprüft; maximaler absoluter Bilanzfehler: 6.73e-09. Der nach GC gemessene Heap bleibt innerhalb dieser Läufe nahezu konstant:

| Aktiver Testspieler | Heap bei Tick 1.000 / 5.000, MiB | Lebende Länder bei Tick 5.000 |
|---|---:|---:|
| DE / balanced | 93.88 / 94.09 | 48 |
| GB / relaxed | 93.90 / 93.93 | 9 |
| FR / impossible | 94.22 / 94.21 | 47 |

Zwei zusätzliche **vollständige Kontrollpartien mit passivem Menschen und 49 aktiven KI-Gegnern** enden ohne Statusmanipulation tatsächlich in einer Niederlage. Die Gegenprobe vor der letzten Aufräumkorrektur verwendet dieselben Seeds und Einstellungen, bereits einschließlich der anderen Verbesserungen; sie ist ausdrücklich nicht die ursprüngliche Projektbaseline.

| Kontrollpartie | Vor letzter KI-Korrektur | Final |
|---|---|---|
| VA / impossible | bei Tick 3000 weiter offen (4 Restsektoren) | Niederlage bei Tick 982 |
| SM / intense | Niederlage bei Tick 2487 | Niederlage bei Tick 1705 |

Die gezielten Tests sichern zusätzlich echte bezahlte Auffüllung, sichere Fabrikverbindungen und normale Baupreise, keine Landwirkung eingeschiffter Soldaten, tatsächliche statt überschießender Kontaktverluste, echte Turmgegner, vollständige RTS-Truppenzahlen, unveränderte Steuerung und pixelidentische Besitzerflächen ab.

Die ersten Unit-Tests bestanden bis auf den durch die Sandbox blockierten HTTP-Server. Mit der erforderlichen lokalen Netzwerkerlaubnis besteht auch dieser Test. Drei repräsentative Alt-Browserfehler wurden auf der unveränderten Ausgangsversion reproduziert: Die Prüfungen erwarteten Angriffe per Linksklick beziehungsweise ein im RTS-Modus ausgeblendetes Panel. Die Tests verwenden nun die tatsächliche RTS-Berichtsoberfläche und für die weiterhin geprüften Legacy-Seeaufträge den expliziten Debug-Befehl. Echte RTS-Pointerbefehle und physische Transporte werden separat geprüft. Alte historische QA-Bilder bleiben unverändert; neue Naval-Testbilder liegen im ignorierten Browser-Artefaktverzeichnis.

## Visueller Vergleich

- Gesamtkarte: [vorher](before-map.png) · [nachher](after-map.png).
- Gleicher Ausschnitt einer fortgeschrittenen Partie: [vorher](before-front.png) · [nachher](after-front.png).
- Gleicher kontrollierter realer Kontaktkampf: [vorher](before-battle.png) · [nachher](after-battle.png).

Die Besitzer-Overlay-Fläche wird zusätzlich vollständig pixelweise gegen die frühere Einzelzellzeichnung einschließlich Konturen und neutraler Löcher verglichen: null abweichende Kanäle. Die Kampfszene ist ein kontrolliertes QA-Szenario mit realer Kontaktauflösung, kein Beleg eines natürlichen Spielverlaufs.

## Grenzen und offene Punkte

Die Änderungen verbessern konkrete Entscheidungen, Darstellung und Wirtschaft, belegen aber keine universelle Balancing-Überlegenheit. Insbesondere können höhere bezahlte Truppenbestände mit höheren absoluten Verlusten einhergehen. Lange vollständige Siege gegen aktiv spielende Menschen, optimale See-/Mehrfrontstrategie und Spielgefühl auf schwächerer Hardware sind nicht abschließend validiert. Die Testspieler-Politik der drei langen Aktivläufe nutzt normale bezahlte Befehle, hat aber keine eigene maritime Fallback-Planung; Stillstand ihres Inselreichs ist deshalb kein eindeutiger KI-Defekt. Die kumulierte Gegnerverlustanzeige bei reinen RTS-Kontakten bleibt außerdem weniger vollständig als die geprüfte reale Bevölkerungs-/Verlustbilanz und das korrigierte Kontaktprotokoll.

Die laufende Browserprobe enthält weiterhin vereinzelte 33-ms-Bildintervalle bei Tick-/Kartenupdates. Stabile 60 FPS in jeder Kriegssituation werden deshalb nicht behauptet. Web Workers oder ein Rendererwechsel wurden ohne belegten zusätzlichen Nutzen nicht eingeführt.

## Reproduktion und Artefakte

```sh
npm test
# Separates Terminal für Browserprüfungen:
PORT=8097 npm run preview
# Bei laufendem Server:
ATLAS_BASE_URL=http://127.0.0.1:8097 npm --prefix tests/browser test -- deep-rts.spec.mjs compact-sidebar.spec.mjs naval.spec.mjs diplomacy.spec.mjs military.spec.mjs
node --expose-gc scripts/benchmark-deep-game.mjs after dist/src/engine/game.js --extended
node scripts/verify-deep-game.mjs
node --expose-gc scripts/simulate-rts-campaigns.mjs
node --expose-gc scripts/simulate-rts-campaigns.mjs --passive
node tests/browser/deep-game-audit.mjs after --live
```

Für den ursprünglichen Simulationsvergleich die Ausgangsrevision separat mit `git archive` entpacken, mit dem vorhandenen TypeScript-Compiler kompilieren und deren `dist/src/engine/game.js` als dritten Parameter an `benchmark-deep-game.mjs` übergeben. Für den ursprünglichen Browservergleich die alte vollständige `dist`-Ausgabe separat auf Port 8098 bereitstellen und `ATLAS_BASE_URL=http://127.0.0.1:8098 node tests/browser/deep-game-audit.mjs before-live --live` verwenden. Der gespeicherte `render-fixture.json` hält den Grafik-Ausgangszustand fest.

- `manifest.json`: Ausgangsrevision, Hardware und Hashes der finalen Quellen.
- `before-final-simulation.json`, `after-simulation.json`: vergleichbare Simulationsdaten und erweiterte Konfigurationen.
- `before-live-render.json`, `after-render.json`: vollständige Grafik-/Live-Browsermessungen.
- `replay-verification.json`: unabhängige Bewegungs-, Bilanz- und Save/Load-Prüfungen.
- `campaigns.json`, `terminal-campaigns.json`: lange aktive beziehungsweise vollständige passive Kontrollpartien.
- `full-tests.txt`, `browser-integration.txt`, `browser-final-visual.txt`, `browser-final-smoke.txt`: erfolgreiche Testausgaben.
- `preexisting-browser-failures.txt`: Gegenprobe der veralteten Browserprüfungen.
- `pre-cleanup-*.json`, `candidate-2-simulation.json`, `before-simulation.json`: aufbewahrte Zwischenstände; diese ersetzen nicht die finalen Vergleichsdaten.
