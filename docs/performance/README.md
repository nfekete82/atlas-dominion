# Microstutter: Messung und Korrekturen

Stand: 24.10.2026. Ausgangspunkt ist der lokale Projektstand einschließlich vorhandener Änderungen, nicht Git HEAD. Keine Stashes, Commits oder Pushes verändert.

## Reproduzierbare Messung

Chrome 155.0.8059.85, headless, 1440 × 1000 CSS-Pixel, DPR 1, vierfache CPU-Drosselung, Seed 2026, aktuelle Kampagnenkarte. Je Szenario sechs Sekunden mit tatsächlicher requestAnimationFrame-Schleife, sichtbarer Minikarte, Sidebar, Originalgrafik, Animationen und Audio. Bewegungsspitzen am Anfang sind eingeschlossen. Zusätzlich je 120 synchrone feste Ticks auf einer frischen identischen Ausgangslage. Die CPU-Drosselung ist ein Lasttest, keine Aussage über die Framerate auf jedem Spielergerät. Kurze Läufe und Browser-/GPU-Anlaufkosten begrenzen die Aussage zu einzelnen Maximalwerten.

Die Rohdaten einschließlich FPS, 1%-Low, p50/p95/p99, >33/50/100 ms, Long Tasks, Phasenzeiten, A*-Aufrufen und besuchten Knoten stehen in [before.json](before.json) und [after.json](after.json). Die Werte der festen Ticks stehen getrennt unter `fixedTicks`. Ihre Speicherzustands-Prüfsummen stimmen in **allen acht Szenarien exakt überein**, einschließlich Einheitenpositionen, KI, Befehlen, Produktion und Spielstand.

| Szenario | p50 ms | p95 ms | p99 ms | Maximum ms | Frames >50 ms | 1%-Low FPS |
|---|---:|---:|---:|---:|---:|---:|
| A-start | 16.7 → 16.7 | 16.8 → 16.7 | 16.8 → 16.8 | 16.8 → 16.8 | 0 → 0 | 59.5 → 59.5 |
| B-20-moving | 16.7 → 16.7 | 16.7 → 16.8 | 16.8 → 16.8 | 283.3 → 66.7 | 1 → 1 | 12.0 → 34.2 |
| C-50-moving | 16.7 → 16.7 | 16.8 → 16.7 | 16.8 → 16.8 | 783.4 → 183.3 | 1 → 1 | 4.8 → 17.1 |
| D-turret-battle | 16.7 → 16.7 | 200.0 → 50.0 | 266.7 → 166.7 | 350.0 → 350.0 | 33 → 8 | 3.2 → 3.7 |
| E-combined-ai | 16.7 → 16.7 | 66.7 → 50.0 | 150.0 → 50.1 | 333.3 → 349.9 | 31 → 4 | 4.6 → 7.5 |
| F-radio-events | 16.7 → 16.7 | 16.7 → 16.8 | 16.8 → 16.8 | 16.8 → 16.8 | 0 → 0 | 59.5 → 59.5 |
| G-camera-zoom | 16.7 → 16.7 | 16.7 → 16.7 | 16.8 → 16.8 | 16.8 → 16.8 | 0 → 0 | 59.5 → 59.5 |
| H-sidebar-production | 16.7 → 16.7 | 16.8 → 16.8 | 16.8 → 16.8 | 33.3 → 33.3 | 0 → 0 | 47.8 → 47.8 |

Die Gesamtzahl der Frames >50 ms sank von **66 auf 14**, die Zahl >100 ms von **32 auf 6**. Die schweren Gefechte liefen nachher schneller durch die Simulation; die festen 120 Ticks dienen deshalb zusätzlich dem direkten Arbeitsvergleich. Die stabile p99 bei 20/50 Einheiten verdeckt jeweils einen einzelnen langen Frame: Hier sind Maximum und 1%-Low aussagekräftiger.

## Nachgewiesene Engpässe

- **Gleichzeitige A*-Suchen:** Im 50-Einheiten-Szenario wurden im ersten langen Tick 772 ms Wegfindung gemessen. Fahrzeugfreiraum prüfte pro Nachbar wiederholt acht neu erzeugte Punkte und Arrays; dieselbe Rasterzelle wurde innerhalb einer Suche mehrfach geprüft. Die A*-Gesamtzeit über feste 120 Ticks sank von 769,8 auf 177,4 ms, der längste Tick von 777,5 auf 185,6 ms. Bei 20 Einheiten sank der längste Tick von 282,5 auf 83,0 ms. Exakte Referenzwege bleiben erhalten, auch mit Gefahrgewichtung und Luftfahrzeugen.
- **Sprite-Zustandswechsel:** Die Detailprobe ordnete im Turmgefecht rund 2254 ms kumulierte Zeichenzeit `CanvasRenderingContext2D.restore()` zu; ein Aufruf dauerte bis 85,3 ms. Nach Entfernen vollständiger save/restore-Paare um einfache Sprite-Layer wurden in der Detailprobe maximal 0,9 ms pro restore gemessen. Die mittlere Renderzeit des Hauptbenchmarks sank im Turmgefecht von 23,52 auf 4,05 ms. Einzelne teure Bildausgaben bleiben nachweisbar. Die Detailprobe hat eigene Messkosten und liefert zusätzliche Zuordnung, keine mit dem Hauptbenchmark identische FPS-Stichprobe: [vorher](render-before.json), [nachher](render-after.json).
- **Sichtberechnung:** Überlappende Sichtquellen berechneten Punkte und Distanzen auch für bereits sichtbare Zellen. Diese Arbeit entfällt; Strahlenprüfungen erzeugen keine temporären Punktobjekte mehr. Bei 50 Einheiten sank die mittlere Sichtaktualisierung von 12,53 auf 9,06 ms. Bei verstreuter Luftunterstützung bleibt sie mit durchschnittlich 51,09 ms unter Drosselung ein Engpass.
- **HUD:** Unveränderte Textinhalte und Kapazitäts-HTML wurden regelmäßig ersetzt. Die Sidebar schreibt diese Inhalte jetzt nur bei Änderung; Auswahl-Details werden erst nach allen Spezialfällen gesetzt. Die mittlere HUD-Zeit im Sidebar-Szenario sank von 1,72 auf 1,47 ms. Ein Browsertest bestätigt null Text-/Kindknoten-Mutationen bei unverändertem HUD und identische Queue-Knoten.

Minikarte und Fog-Upload lagen im Ausgangslauf meist deutlich unter einer Millisekunde und begründeten keine Verringerung ihrer Aktualisierungsfrequenz. Terrain und Offscreen-Flächen werden bereits wiederverwendet. Das Partikelsystem besitzt bereits einen begrenzten Pool. Für eine Garbage-Collection-Pause als eigenständige Ursache gibt es keinen Nachweis; vermiedene Wegsuch-Allokationen senken dennoch unnötigen Speicherumsatz. Das wiederverwendete A*-Workspace wird erst bei Bedarf angelegt und belegt etwa 0,77 MiB pro Welt; seine Begehbarkeitswerte werden bei jeder Suche zurückgesetzt.

## Audio

Die 47 deutschen WAVs werden bereits einmal geladen, nach Freischaltung desselben AudioContext dekodiert und als AudioBuffer wiederverwendet. Playback startet keinen neuen Decode. Ein Funkkanal, die Obergrenze von 20 Effektstimmen und das Freigeben beendeter Audioknoten bleiben erhalten. Im Szenario mit gleichzeitigen Funkereignissen wurden alle 47 Clips ohne Fehler dekodiert; priorisierte Unterbrechungen und verworfene Meldungen funktionierten. Es gab vorher und nachher keinen Frame >50 ms. Dieser Sechs-Sekunden-Vergleich misst Playback nach erfolgter Dekodierung; eine Verbesserung der erstmaligen Dekodierung wird ausdrücklich nicht behauptet. Der Browser-Integrationstest prüft den echten Kaltstart und die Wiederverwendung nach Kampagnenwechsel funktional.

## Geänderte Laufzeitdateien

- `src/reborn/world.ts`: Freiraumprüfung ohne temporäre Arrays, A*-Workspace und Begehbarkeits-Memoisierung innerhalb einer Suche, skalare Sichtlinien-Indizes, Wegsuchmessung.
- `src/reborn/simulation.ts`: überlappende Sichtquellen früh ausschließen; Tick-/Sichtmessung.
- `src/reborn/tactical-ai.ts`: abschaltbare Planungsmessung; Strategie und Planungstakt bleiben gleich.
- `src/reborn/unit-presentation.ts`: nur die tatsächlich geänderten Canvas-Eigenschaften für Sprite-Layer wiederherstellen.
- `src/reborn/renderer.ts`: Render-, Sprite-, Leichen-, Partikel-, Fog- und Minikartenmessung.
- `src/reborn/main.ts`: bedingte HUD-Schreibzugriffe, Elementwiederverwendung, Messpunkte in der Spielschleife, Startzeit nach Laden der Assets setzen.
- `src/reborn/performance.ts`: ausschließlich aktivierter Debug-Recorder, begrenzter Ringpuffer, Anzeige und JSON-Export.

Keine zeitabhängigen Wegsuchbudgets oder verzögerten Spielerbefehle eingeführt. Pfadform, Trefferregeln, KI-Strategie, Fähigkeiten, Speicherformat, Modelle und Sidebar-Struktur bleiben erhalten. Der Browservergleich prüft **60 Sprite-Konfigurationen pixelgenau** gegen die ursprüngliche Zeichenroutine, einschließlich Zoom, Fahrzeug-Layern, Luftschatten und gefilterten Leichen.

## Debugging und Wiederholung

- Spiel mit `/?debug&perf` öffnen. Ohne beide Parameter gibt es keinen Recorder, Observer, Statistikpuffer oder Debug-Timer.
- Die aufklappbare Anzeige zeigt FPS, 1%-Low, Perzentile, Schwellwertzähler sowie durchschnittliche/maximale Phasenzeiten. Messung zurücksetzen und JSON exportieren sind direkt verfügbar.
- `window.__reborn.profiler.snapshot()` liefert vollständige Werte und die zwölf längsten Frames samt vorigem und aktuellem Arbeitsprofil. Ein langer RAF-Abstand kann durch Arbeit im **vorigen** Frame entstehen. Verschachtelte Messungen sind inklusive: Simulation enthält KI/Sicht/Wegsuche; Rendering enthält seine Unterphasen. Diese Werte nicht aufsummieren. RAF-Abstände werden vor der Begrenzung des Simulations-dt erfasst.
- Der Ring enthält maximal 3600 Frames. Perzentile beziehen sich auf dieses Fenster, Phasenaggregate auf die Zeit seit Reset. Die Anzeige berechnet Statistiken einmal pro Sekunde, ohne Frame-Logs. Die Browser-Long-Task-Zahl beweist keine GC- oder GPU-Ursache.
- `npm run test:performance` baut und misst alle acht Szenarien erneut. `PERF_CPU=1 PERF_SECONDS=20 npm run test:performance` misst ohne Drosselung länger. Das überschreibt `after.json`; Ausgangsdaten vorher kopieren, wenn weitere Vergleiche erhalten bleiben sollen.
- `node scripts/probe-reborn-render.mjs probe` erstellt die detaillierte Canvas-Zuordnung. `ATLAS_BASE_URL` kann einen bereits laufenden lokalen Server vorgeben. Playwright/Chrome aus der vorhandenen Browser-Testumgebung werden benötigt.
- `perfTest` ist ein internes Debug-Flag: Es startet die Kampagne pausiert und blendet das Messpanel für reproduzierbare Fixtures aus.

## Validierung und Grenzen

Bestanden: `npm run build`, acht Vorher-/Nachher-Lastszenarien mit identischen Zustandsprüfsummen, 80 fokussierte Node-Regressionstests, 17 Browser-Integrationstests und `git diff --check`. Die Tests umfassen Navigation, Kampagnenkarten, taktische KI, Heilung/Reparatur, Transport, Raketen, Funk, Animationen, Sidebar-Trennung, Retina-Eingabe, sofortige Auswahl sowie pixelgleiche Sprite-Ausgabe.

**Offen:** Der Lasttest ist nicht vollständig frei von Spitzen. Es bleibt insbesondere eine etwa 183-ms-Frame-Spitze beim gemeinsamen Start von 50 Einheiten; unter vierfacher Drosselung erreicht der entsprechende feste Tick 185,6 ms. In den Gefechtsszenarien bleiben einzelne RAF-Abstände bis ungefähr 350 ms, darunter Sprite-Ausgaben über 100 ms und Lücken, die durch die erfasste Spielarbeit allein nicht erklärt werden. Browser-/GPU-Anlauf und Fixture-Arbeit sind hier mögliche Einflüsse, keine gesicherte zusätzliche Ursache. Ausgedehnte Sichtberechnung bleibt teuer. Die Messanzeige und Rohprofile machen diese Restfälle untersuchbar; eine vollständig ruckelfreie Darstellung auf jeder Hardware wird nicht behauptet.
