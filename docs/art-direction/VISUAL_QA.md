# ATLAS DOMINION – Grafik-Overhaul: Visual QA

22.10.2026 · lokaler, spielbarer Build · Stilreferenz: [reference.png](reference.png).

## Ausgangsstand und Umfang

Ausgangsrevision: `28246455501ac602adbb991c0bb32ebfe48b501e`. Beim Start waren `CODEX_PROMPT.md` und `docs/art-direction/` untracked. Auftrag und Art Bible wurden vollständig gelesen; beide Dokumente und das Referenzbild bleiben unverändert. Es gab keine projektspezifische AGENTS.md. Vorhandene lokale Arbeiten wurden bewahrt; kein Commit, Push oder Merge.

Die lokale Wahrheit enthält **city (0–5), tower, factory, barracks**, echte RTS-Formationen und Seeüberfahrten. Diese vorhandenen Typen sind vollständig illustriert. Start-Hauptstädte bekommen zusätzlich eine Darstellung aus ihren realen City-Daten; ihre separaten Bau-/Ausbauregeln und die Städtezahl bleiben erhalten. Die Hauptstädte werden ausschließlich in die Zeichenliste aufgenommen, ohne sie in den wirtschaftlichen Gebäudedaten doppelt zu zählen.

Geometrie und Simulation bleiben unverändert: **480 × 260 Sektoren, 1600 × 900 Weltkoordinaten**. Keine neuen Einheiten, Bauklassen, Straßen, Inseln, Hindernisse, Wirtschafts- oder Kampfmechaniken. Alle Dateien unter `src/engine` und `src/data` sind unverändert.

## Tatsächlich eingebundene Originalgrafiken

| Runtime-Asset | Inhalt / native Pixelgröße |
|---|---|
| [terrain.png](../../src/assets/pixel-art/terrain.png) | 4 transparente Grasflecken à 32², 3 Waldgruppen à 48², 3 Bergsilhouetten à 48², 2 Wasserakzente à 32² |
| [buildings.png](../../src/assets/pixel-art/buildings.png) | 12 verschiedene Stadtsprites: je 2 für Level 0–5; 32² / 40² / 48². Eigene Fabrik, Kaserne und Abwehrturm à 40² |
| [soldiers.png](../../src/assets/pixel-art/soldiers.png) | 36 Frames à 20 × 24: 4 Beziehungspaletten, idle × 2, move × 4, fire × 3; Links-/Rechtsansicht durch Spiegelung |
| [effects.png](../../src/assets/pixel-art/effects.png) | 4 Treffer-/Staubframes à 16², nur an tatsächlichen Verlustereignissen |

Die vier PNGs benötigen zusammen **12.300 Bytes**. Es sind editierbare Originalzeichnungen mit ganzzahligen Pixelkoordinaten, selektiven Materialkonturen, Licht von links oben und harten Schatten nach rechts unten. Keine kopierten Referenzsprites und keine generierten SVG-/CSS-Ersatzbilder.

Reproduzierbare Quelle: [generate_pixel_art_assets.py](../../scripts/generate_pixel_art_assets.py), Pillow nur zur Entwicklung. Laufzeit ohne neue Abhängigkeiten. Zu jedem PNG liegt ein JSON-Manifest mit Quellrechteck, Fußpunkt `(w/2,h-3)`, Zustand, Frame und Dauer. Zusätzlich enthält es die gemessenen Alpha-Bounds. Das Skript schreibt den identischen TypeScript-Manifestinhalt für den synchronen Renderer.

## Rendering, Geografie und Steuerung

- [sprite-atlas.ts](../../src/render/sprite-atlas.ts): vier gemeinsam und einmal geladene Images, Fehler-Fallbacks, durchgehend `imageSmoothingEnabled=false` für Pixelgrafiken, zustandsgebundene Animation.
- [terrain-decoration.ts](../../src/render/terrain-decoration.ts): zwei einmal gebaute Canvas-Caches für Grundstruktur und Nahdetails; geografische Landmaske mit ausgeschnittenen Natural-Earth-Seen. Wasserakzente zusätzlich gegen Land geclippt. Keine Textur- oder Spriteerzeugung pro Animationsframe.
- [topography.ts](../../src/render/topography.ts): tatsächliches Relief zu ruhigen, gestuften Materialflächen zusammengefasst. Bergmotive ausschließlich an messbarer lokaler Reliefstruktur. Die Reliefdatei ist **Hillshade, kein Höhenmodell**; die Illustrationen bilden daher keine präzise Höhenklassifikation ab.
- Waldgruppen sind ausdrücklich sparsame stilisierte Dekoration im gemäßigten Bereich. Es liegt kein Waldflächen-Datensatz vor; sie werden nicht als kartografisch nachgewiesene Wälder oder Spielhindernisse behandelt.
- [pixel-art-style.ts](../../src/render/pixel-art-style.ts), [building-markers.ts](../../src/render/building-markers.ts), [map.ts](../../src/render/map.ts): gemeinsame Größen, Fußpunkte, minimale Alpha-Rechtecke, Viewportprüfung und Kollisionsbehandlung. Fahnen tragen die unveränderten Fraktionsfarben. Materialien bleiben farblich ruhig und funktional unterscheidbar.
- Unter Zoom 1,25: ruhiges Relief, kompakte Silhouetten und vorhandene aggregierte Frontwerte. Ab 1,25: dezente Geländeobjekte und Mini-Infanterie. Ab 1,8: volle Nahdetails und Gebäude in 1,5-facher Quellgröße (48 / 60 / 72 CSS-Pixel vor Alpha-Zuschnitt). Weltmaßstab und DPR verändern die CSS-Größen dieser Marker nicht.
- Transparenter Atlasrahmen zählt nicht zur Trefferfläche: Hover, Kollision, Linksauswahl und Rechtsklick nutzen dieselben kleinsten umschließenden Rechtecke der bemalten Pixel einschließlich Fahnen/Schatten. Dichte Gebäude erhalten stabile Darstellungsversätze mit Verbindungslinie zum echten Sektor. Hover ändert die Sortierung nicht. Hauptstadtnamen stehen unter dem Fußpunkt.
- Soldaten visualisieren echte bezahlte RTS-Formationen bzw. vorhandene BattleEvents, höchstens sechs Figuren pro Formation und vier je Kontaktseite. Landmarker und ihre Kollisionsversätze bleiben auf tatsächlichen Landsektoren; auch Gruppenmittelpunkte und einzelne Kontaktfiguren werden gegen die Landmaske geprüft. Move-Pose nur nach tatsächlichem Indexwechsel; Feuer nur bei registriertem Kampf. Sehr kleine Bestände erhalten entsprechend weniger Figuren; eingeschiffte Formationen erscheinen ausschließlich als Seetransport.
- Eigener deterministischer visueller Hash; kein Zugriff auf den Spiel-RNG. Rendering verändert keine Eigentümer, Geld-, Truppen-, Verlust-, Save- oder KI-Werte. Bestehende vier KI-Stufen und alte Saves bleiben nutzbar.

## Vorher / Nachher unter gleichen Bedingungen

Chrome, **1440 × 1000 CSS-Pixel, DPR1**, Seed **20261022**, Deutschland, 49 Gegner, RTS, reduced motion. Jeweils derselbe Kamerabefehl und Spielzustand. Die Vorher-Version wurde aus der unveränderten Ausgangsrevision separat nach `/private/tmp` extrahiert, gebaut und auf Port 8107 bereitgestellt; der aktuelle Arbeitsbaum wurde dafür nie zurückgesetzt.

| Szene | Vorher | Nachher |
|---|---|---|
| Gesamteuropa, Zoom 1 | [Bild](screenshots/before-europe.png) | [Bild](screenshots/after-europe.png) |
| Normaler Ausschnitt, Zoom 1,5 | [Bild](screenshots/before-normal.png) | [Bild](screenshots/after-normal.png) |
| Alle Bauklassen und Stadtlevel, Zoom 4 | [Bild](screenshots/before-buildings.png) | [Bild](screenshots/after-buildings.png) |
| Tatsächlicher Kontaktkampf, Zoom 4 | [Bild](screenshots/before-battle.png) | [Bild](screenshots/after-battle.png) |

Die Gebäudeszene ist ein **kontrolliertes QA-Szenario** mit ausdrücklich finanziertem Budget und vergrößertem Startgebiet. Alle neun Gebäude wurden über normale Build-/Upgrade-Funktionen errichtet. Sie ist kein behaupteter natürlicher Partieverlauf. Das restliche Startspiel bleibt unverändert.

Die Kampfszene stammt aus dem vorhandenen [gespeicherten Kampagnenzustand](../qa/deep-game-20261022/render-fixture.json). Die Simulation wurde deterministisch bis zum ersten auflösbaren echten Kontakt mit Verteidigern weitergeführt: **Tick 509, 50 lebende Länder, 93 reale Formationen, 1 BattleEvent**. Dieselben Werte gelten vor und nach der Änderung. Der Renderer legt für die Aufnahme keine Schlacht an.

Zusätzliche Interaktionsbelege: dichte Bebauung [DPR1](screenshots/after-dense-dpr1.png) / [DPR2](screenshots/after-dense-dpr2.png), bezahlter kontrollierter Kontakt [DPR1](screenshots/after-contact-dpr1.png) / [DPR2](screenshots/after-contact-dpr2.png), tatsächlicher Marsch [DPR1](screenshots/after-march-dpr1.png) / [DPR2](screenshots/after-march-dpr2.png).

Alle vier Vergleichsansichten sowie dichte Bebauung und Soldaten im Retina-Bild wurden visuell geöffnet und geprüft. Gegenüber der Ausgangsversion: erkennbare Dach- und Wehrsilhouetten ohne große Levelziffern, Fabrik mit Sheddach/Schornstein/Tank, gedrungene Kaserne, eigener Abwehrturm, lesbare Helm-/Waffencluster und zusammenhängende Materialpalette. Politische Konturen, Länderfarben, Frontzahlen und nationale Flaggen bleiben sichtbar. Die hochfrequente alte Reliefstruktur wurde nach dem ersten Sichtcheck beruhigt.

## Gezielte Tests und Integration

- `npm run build`: TypeScript und vollständiger statischer Build erfolgreich.
- `npm test`: **371 von 372** bestanden; der einzige Fehler war `listen EPERM` des durch die Sandbox blockierten HTTP-Tests. Mit lokaler Netzwerkerlaubnis besteht auch dieser einzelne Test. Damit sind alle **372 Testfälle** erfolgreich abgedeckt. Rohprotokolle: [Gesamtlauf](profiling/unit-tests.txt), [HTTP-Nachprüfung](profiling/http-tests.txt).
- Abschließende Prüfung nach Einbindung der Hauptstädte: **21/21** relevante Asset-, Bounds-, Kollisions- und Militärpaneltests bestanden; [Protokoll](profiling/final-targeted-tests.txt).
- [pixel-art.test.mjs](../../tests/pixel-art.test.mjs) decodiert die ausgelieferten PNGs unabhängig, prüft echte RGBA-Pixel und Transparenz, alle Manifestrechtecke/Alpha-Bounds, verschiedene Silhouetten, Animationsframes und Fußpunkt-/LOD-Konsistenz.
- **Ein Browser-Regressionsszenario**, jeweils bei DPR1 und DPR2: [pixel-art.spec.mjs](../../tests/browser/pixel-art.spec.mjs), **bestanden in 9,3 s** laut [Protokoll](profiling/browser-tests.txt). [Strukturierte Ergebnisse](screenshots/integration-results.json).
- Dabei geprüft: Laden der vier Atlanten genau einmal, kein geglätteter Atlas-Draw, vier Zoomstufen 1 / 1,25 / 1,8 / 4, fünf Trefferpunkte pro sichtbarem Gebäude, keine überlappenden Gebäude-Bounds in der dichten Szene, Hover, Rechtsklick, bezahlter Stadtausbau und Fabrikbau, keine doppelt gezählten Hauptstädte, bezahlte Rekrutierung, echte Verluste, Linksauswahl, echter Rechtsklick-Marsch mit verändertem Sektorindex, nachgewiesene idle-/move-/fire-Draws, Ausschluss eingeschiffter Landinfanterie, zusätzliche Regression der dichten Kampagnenszene am Ärmelkanal gegen Landmarker über Wasser, keine Browserfehler und unveränderter pausierter Spielstand trotz weiterer Renderframes.

## Gemessene Leistung und Simulationsintegrität

Apple M5 Max, macOS arm64, Node v25.9.0, Chrome. Browserwerte in **ms, Median / p95**; 121 Renderaufrufe und 120 RAF-Intervalle je Messfenster. Kartenaufbau pausiert: 15 Aufrufe nach 3 Warmups. Livefenster: 8 echte Ticks, ohne parallele Simulationsbenchmarks. Kleine Unterschiede sind keine belastbaren Beschleunigungsnachweise.

| Messung | Vorher | Nachher |
|---|---:|---:|
| Gebäudeszene: Render-CPU | 0,50 / 0,80 | 0,60 / 0,90 |
| Gebäudeszene: Kartenaufbau | 2,20 / 2,50 | 2,30 / 3,40 |
| Kampagne pausiert: Render-CPU | 1,30 / 2,00 | 1,40 / 2,10 |
| Kampagne pausiert: Kartenaufbau | 4,70 / 8,20 | 4,90 / 8,60 |
| Kampagne live: Render-CPU | 0,70 / 1,70 | 0,70 / 2,20 |
| Kampagne live: Kartenaufbau | 6,70 / 7,20 | 4,80 / 5,20 |
| Kampagne live: RAF-Intervall | 16,70 / 16,70 | 16,70 / 16,80 |

Die Gebäudeszene zeigt nachher zusätzlich die realen Hauptstädte (**26 sichtbare Gebäude statt 9**). Die zusätzliche Zeichen- und Kollisionsarbeit erklärt den kleinen CPU-Aufschlag; die gemessene mittlere Bildrate bleibt unverändert. Die festen Kampagnenmessungen zeigen denselben Simulationszustand. Vollständige Werte: [Vorher](screenshots/before-metrics.json), [Nachher](screenshots/after-metrics.json).

Je 1.000 Simulationsschritte aus identischen Starts, mit dem vorhandenen Benchmarkskript; keine Änderungen an der Engine:

| Länder | Median Tick vorher / nachher | p95 vorher / nachher | identischer finaler Save-Hash |
|---|---:|---:|---|
| 50 | 10,15 / 9,85 | 18,16 / 17,23 | ja |
| 9 | 3,62 / 3,43 | 7,11 / 6,36 | ja |

Null illegale Bewegungen in beiden Läufen; Bevölkerungsbilanzdrift maximal 2,55 × 10⁻¹¹ (Gleitkomma). Die unveränderte 50-Länder-Simulation benötigt im Benchmark nach 1.000 Ticks rund 101,96 MiB JS-Heap. Browser-Grafikspeicher wurde nicht gemessen. [Vorher-Simulation](profiling/before-simulation.json), [Nachher-Simulation](profiling/after-simulation.json), [Hashes, Assetgrößen und Hardware](profiling/manifest.json).

## Grenzen

Walddekoration ist stilisiert; Hillshade-basierte Bergmotive ersetzen keine echte Höhen-/Vegetationskarte. Extreme Bebauungsdichte wird weiterhin durch LOD/Kollisionsunterdrückung begrenzt; verborgene Marker kommen bei passendem Zoom wieder zum Vorschein. Die beiden kurzen Livefenster garantieren keine dauerhaft stabilen 60 FPS in jeder Partie. Während früherer Vergleichsaufnahmen wurden vereinzelt 33-ms-Intervalle gesehen; sie werden durch die finalen kurzen Messfenster nicht ausgeschlossen. Schwächere Hardware, stundenlange Grafikspeichermessungen und weitere Browser sind nicht vermessen. Keine offenen Implementierungsplatzhalter.

## Reproduktion

```sh
python3 scripts/generate_pixel_art_assets.py
npm run build
node --test tests/pixel-art.test.mjs tests/building-markers.test.mjs
PORT=8106 npm run preview
# In einem zweiten Terminal:
ATLAS_BASE_URL=http://127.0.0.1:8106 npm --prefix tests/browser test -- pixel-art.spec.mjs
node tests/browser/pixel-art-audit.mjs after
ATLAS_QA_DIR=docs/art-direction/profiling node --expose-gc scripts/benchmark-deep-game.mjs after dist/src/engine/game.js
```

Die Quelldateien und Screenshots bleiben lokal im Arbeitsbaum. Das Spiel wird aktuell unter [localhost:8106](http://localhost:8106) bereitgestellt.
