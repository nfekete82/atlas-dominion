# ATLAS DOMINION — Art Bible v1.0

Stand: 22.10.2026 · Ziel: vollständiger visueller Qualitätsdurchgang für das bestehende Echtzeit-Strategiespiel.

## 0. Tatsächlichen Projektstand respektieren

Der öffentliche GitHub-Stand (`nfekete82/atlas-dominion`, `main`, bei Erstellung geprüft) zeigt:

- TypeScript, Canvas 2D; Kartendarstellung `src/render/map.ts`, Gebäude `src/render/building-markers.ts`, Topografie `src/render/topography.ts`, Gefechte `src/render/front-battles.ts`.
- 480 × 260 **Simulationssektoren**, 1600 × 900 **Weltkoordinaten** (`src/data/europe.ts`). Ein Sektor misst somit nur rund 3,33 × 3,46 Weltpixel. Ein klassisches 32×32-Tile **pro Sektor** wäre falsch.
- Geografisches Relief (`src/assets/europe-relief.png`), echte Küsten/Landgrenzen, Länderfarben, vorhandene Seewege.
- Auf GitHub bisher **Stadt** als Bauklasse (`src/engine/economy.ts`), Städte-Level 0–5, 30-CSS-Pixel-Stadtmarker mit Zoom-/Kollisionslogik.
- Frontarmeen und Truppenzahlen werden simuliert; die sichtbaren Kampfsoldaten sind grafische Repräsentationen realer Ereignisse, keine separaten frei laufenden Einzelagenten.

**WICHTIG:** Lokale, uncommittete Änderungen des Nutzers sind neuer und maßgeblich. Dort können **Fabrik, Militärgebäude, Soldaten** bereits existieren. Codex muss lokale Klassen/Renderer zuerst inspizieren. Es darf keine Fabrik oder Kaserne lediglich aufgrund dieser Spec als *neue Gameplay-Mechanik* erfinden. Wenn vorhanden: vollständig neu illustrieren. Wenn nicht vorhanden: entsprechende Designregeln vorbereiten, aber keine künstlichen Game-Entities hinzufügen.

## 1. Visuelle Identität

**Leitbild:** charmantes, handgestaltet wirkendes, strategisch klares militärisches Pixel-Art-Spiel, inspiriert von der beigelegten Referenz (`reference.png`), aber **eigenständige Originalgrafiken** statt Kopie der Referenz. Ein stilistisch zusammenhängendes Spiel, keine Icons-/Dashboard-Sammlung.

- Perspektive: **Top-down 3/4** (leicht sichtbare Gebäudefront), keine echte Isometrie.
- Stil: kontrollierte, saubere Pixelcluster, geringe Detailfrequenz, kräftige Silhouetten. Kein fotorealistisches Material, keine Airbrush-Filter, keine zufällige Noise-Überlagerung.
- Licht: einheitlich **oben links**, Schatten **unten rechts**; harte oder zweistufige Pixel-Schatten, keine weichen großen Glows.
- Kontur: selektive 1-Pixel-Kontur in einer dunkleren *lokalen* Farbe, nicht pauschal Schwarz.
- Teamzugehörigkeit: kontrollierter Akzent (Dachband, Fahne, Helm oder Ärmel), nicht 100 % der Spritefläche. Besitzer/Allianzen müssen auch in Zoom 1 gut zu unterscheiden sein.
- Drei visuelle Ebenen: **Terrain ruhig**, **Gebäude und Armeen deutlich**, **Kampfhinweise dominant bei aktivem Ereignis**. Kein flächendeckendes Kleinteilrauschen.
- Audio, Spielregeln und Interface-Theming sind nicht Gegenstand des primären Grafikauftrags; kleine passende UI-Anpassungen sind erlaubt.

## 2. Leitpalette (Richtwerte, für vorhandene Länderfarben anpassbar)

| Material | Hell | Mittel | Dunkel |
|---|---|---|---|
| Gras / Wiesen | `#A9C990` | `#86B476` | `#658E62` |
| Wald | `#739D70` | `#467857` | `#2D5546` |
| Berg / Stein | `#D1BE9F` | `#9C8B74` | `#62594F` |
| Erde / Straße | `#C6AD86` | `#977F69` | `#615E58` |
| Wasser | `#92B7B9` | `#577F96` | `#315A74` |
| Stadt / Steinwände | `#E1CFAD` | `#AA927E` | `#625A55` |
| Industrie / Metall | `#B8A28C` | `#7B7775` | `#464E56` |
| Militär / Beton | `#A4A697` | `#777C71` | `#454F4A` |
| Spielerakzent Blau | `#81A6E0` | `#4474BB` | `#294F83` |
| Gegnerakzent Rot | `#E58C7F` | `#C85258` | `#8F333D` |

Andere politische Fraktionsfarben sind möglich. Bestehende Länderfarben müssen semantisch erhalten bleiben. Farben niemals als einzigen Statusindikator verwenden: Umriss, Form oder Symbol ergänzen.

## 3. Technische Größen / Raster und Asset-Layout

Es gibt zwei getrennte Raster:

1. **Gameplay:** existierendes 480×260-Sektorraster und Weltauflösung 1600×900. Unverändert lassen.
2. **Pixel-Art-Assets:** native Pixelbilder, unabhängig von Simulationstiles. Quellgrößen sind Designvorgaben, die im Atlas ggf. gerahmt oder dynamisch skaliert werden:

| Asset | Ziel-Quellgröße | Varianten |
|---|---:|---|
| Grastextur / sanfte Bodenflecken | 32×32 px | 4 ohne harte sichtbare Kachelnähte |
| Waldgruppe / Baumcluster | 48×48 px | 3 (klein, mittel, dicht) |
| Berg-/Hügelmotiv | 48×48 px | 3 Silhouetten |
| Küsten-/Wasser-Akzente | 32×32 px | wenige, küstenbewusst |
| Stadt, klein (Level 0–2) | 32×32 px | mindestens 2 Silhouetten pro Stufegruppe |
| Stadt, mittel (Level 3–4) | 40×40 px | mindestens 2 Silhouetten |
| Stadt, groß (Level 5) | 48×48 px | markante Metropole |
| Fabrik (wenn vorhanden) | 40×40 px | Grundkörper + optionale Aktivvariante |
| Militärgebäude (wenn vorhanden) | 40×40 px | Grundkörper + optionale Aktivvariante |
| Soldat (nur wenn es eine echte Darstellung verlangt) | 16×20 oder 20×24 px | idle / move / fire, 4 Blickrichtungen wenn nötig |
| Kampfeffekte | 16×16 oder 24×24 px | 3–5 Frames, begrenzt |

**Nicht** alle 480×260 Gameplay-Sektoren mit 32×32 Bildern belegen. Einzelobjekte werden an vorhandenen Gebäude-, Schlacht- und geografischen Positionen geankert. Eine Terraintextur kann flächig gekachelt werden, aber sehr dezent und nur **innerhalb** der vorhandenen Landmaske; Relief bleibt nachvollziehbar.

**Zoom-LOD**, an bestehende Schwellwerte orientiert (in `building-markers.ts` aktuell u. a. 0,8 / 1,25 / 1,8):

| Zoom | Terrain | Gebäude | Soldaten / Ereignisse |
|---|---|---|---|
| Strategisch <1,25 | ruhiges, kontrastarmes Relief; Küsten, große Wald-/Gebirgsgürtel | reduzierte 22–30-CSS-px-Silhouette, wichtige Städte zuerst | aggregierte Front-/Truppenzahlen, wenige echte Kontakt-Effekte |
| Mittel 1,25–<1,8 | zusätzliche Wald-/Hügel-Details, keine Überfüllung | detaillierte Marker mit Teamakzent | lesbare kleine Gruppen nahe echten Fronten |
| Taktisch ≥1,8 | einzelne Objektcluster, Boden-Highlights | große, bildliche Pixel-Art-Sprites, Level und Funktion erkennbar | sichtbar marschierende/feuernde kleine Squads **nur als Visualisierung tatsächlich aktiver** Angriffe/Bewegungen |

Konkrete CSS-Pixelabmessungen an Kartendichte und 30px-Marker anpassen. Wenn sichtbare Spritegröße vergrößert wird, **Hitbox, Auswahlfläche, Hover, Collision Avoidance und Rechtsklick-Trefferfläche auf exakt dieselben tatsächlich gerenderten Bounds aktualisieren**. Keine unsichtbaren Klickflächen, keine Kollisionsverschlechterung. Lege den Fußpunkt bei `(w/2, h-3)` statt in die Spritemitte.

## 4. Terrain — Priorität 1

**Bestehende geografische Formen bleiben absolut korrekt.** Nutze die vorhandene Relieftextur, Land-/Wassermaske und Geodaten. Keine erfundenen Straßen, Gebirgszüge, Brücken oder Inseln. Deko nicht als neue unpassierbare Hindernisse oder Rohstoffquellen behandeln.

- **Wiesen/Flachland:** 3–4 extrem subtile Variationen und sparsame erdige Flecken, keine sichtbare Pixelrauschen-Tapete, gleichmäßig integrierte Landesfarben.
- **Wald:** zusammenhängende Cluster aus 2–3 eigenen Baumsilhouetten, dunkler Kern / aufgehellter Saum; weder gleichmäßige Streuung noch Überdeckung von Stadt-/Frontlabels. Nur bei geografisch begründeter Lage oder vorhandener Datenbasis; sonst stilisierte Dekoration sparsam.
- **Gebirge:** lesbare Bergketten, 1 heller Grat, dunkle rechte Flanke; nur in Höhenregionen der vorhandenen Reliefdaten. Keine graphisch absurden Alpen-Türme bei einer vollständigen Europakarte.
- **Seen/Meer/Küsten:** ruhige Blautöne, Kanten/Schaum sparsam am realen Verlauf, kein Sprite auf Binnenland, keine verfälschten Seewege.
- **Straßen:** nur visualisieren, wenn bereits Straßen-/Verbindungsdaten vorhanden sind. Sonst keine erfundenen Straßennetze und keine neue Bewegungsmechanik.
- **Territorien:** transparente politische Tönung und scharfe, organische Ländergrenzen weiterhin klar lesbar; Terrain darf Fraktionserkennung niemals verdrängen.

Die Welt soll aus der Distanz eine *gut lesbare politische Europakarte* bleiben; den Nahansichts-Charme der Referenz erst bei höheren Zoomstufen zeigen.

## 5. Gebäude — Priorität 2

Die grafischen Assets müssen **funktional unterscheidbar** sein; nicht dieselbe Kiste mit anderer Farbe.

**Stadt Level 0–2:** ein bis drei warme Häuser, differenzierte Dächer, leichter Bodenschatten, Teamakzent als Fahne/Wimpel. Level 0–2 unterscheidbar durch Anzahl/Gruppierung (keine riesige Ziffer auf dem Haus).

**Stadt Level 3–4:** mittelgroßes Stadtensemble mit Uhr-/Wehrturm, zusammenhängender Dachlinie und dezentem Mauersockel. Teamakzent an Wimpeln/Dachkanten. Erkennbarer Sprung gegenüber Level 0–2.

**Stadt Level 5:** kompakte Metropole/Burgstadt mit markantem zentralem Gebäude, hoher Silhouette, asymmetrisch handgestalteten Dachformen, aber kein 3D-Render. Städtelevel 0–5 semantisch und in Tooltips weiterhin korrekt.

**Fabrik – nur falls lokal echte Gebäudeklasse:** breiter industrieller Baukörper, Sheddach, 1 Schornstein, 1 Tank/Maschinendetail. Rauere Stein-/Metallpalette, farbiger Fahnen-/Dachakzent. Keine Rauchwolken als permanente FPS-Kosten; Animation sparsam und deaktivierbar.

**Militärgebäude – nur falls lokal echte Gebäudeklasse:** befestigte, gedrungene Struktur mit Radar/Kommandoturm oder Kaserneneingang, sauberer Schutzmauer und Teamwimpel. Nicht wie Fabrik oder Stadt. Visuelle Bauzustände exakt aus bestehendem Game-State ableiten.

Gebäude werden an ihre existierenden Indizes geankert. Bestehende Eigentümer-/Städtelevel-/Selektions-/UI-Logik erhalten. Keine neue Gebäudeart oder Wirtschaftssimulation aus Designgründen hinzufügen.

## 6. Soldaten / Frontkämpfe — Priorität 3

Referenzvorbild: kleine, erkennbare Soldatensilhouetten statt abstrakter blinkender Punkte.

- Eigene original gezeichnete 16×20/20×24-Sprites: Helm, Oberkörper, Arme, deutlich abgesetzte Waffe, kurze Beine; kein anatomisches Detailrauschen.
- 3 klare Zustände: **idle** (1–2 Frames), **move** (3–4 Frames), **fire** (2–3 Frames). 4 Richtungen **nur falls existierende Visualisierung diese nutzt**; sonst per Spiegeln/rotationsarme Assetsets.
- Animationen **rein visuell**. Event-Koordinaten, Besitzer, Truppenzahlen und Bewegungsrichtung aus realen `BattleEvent`-/Army-/Transitdaten. Nie Soldaten im Spiel-State erzeugen, nicht 1 Sprite pro realem Soldaten zeichnen.
- Maximal wenige sichtbare Gruppen pro Front, je Zoom und tatsächlicher Armeegröße gedeckelt, um GPU-/CPU-Last und UI-Überdeckung zu begrenzen. Keine Feuerschüsse ohne Kampfkontakt.
- Teamidentität: Helm-/Ärmelstreifen oder Fahne; keine rein farbcodierte Truppenunterscheidung.
- Hübschere Treffer-/Staub-/Mündungsfeuer-Sprites, sparsam, ohne Flash-Ketten oder unlesbare Fronten.
- Geladene Boote/Verbände erscheinen **nur auf dem Meer**, nie als kämpfende Landinfanterie vor Anlandung.
- Militärwerte/Berichte müssen unverändert den realen Simulationswerten entsprechen.

## 7. Dateistruktur (Richtlinie, vorhandene Architektur priorisieren)

```text
src/
  assets/
    pixel-art/
      terrain.png
      terrain.json
      buildings.png
      buildings.json
      soldiers.png
      soldiers.json
      effects.png
      effects.json
  render/
    pixel-art-style.ts       # gemeinsame Palette, Schatten, Zoom/LOD
    sprite-atlas.ts          # Sprite-Rechtecke, Lade-/Fallback-Regeln
    terrain-decoration.ts    # cached, deterministische Details
    building-markers.ts      # vorhandenes Gebäude-Rendering integrieren
    front-battles.ts         # bestehende Eventvisualisierung integrieren
    map.ts                   # Layering und LOD, Engine unverändert
scripts/
  generate_pixel_art_assets.py    # optional, editierbare Sprite-Quellen

docs/
  art-direction/
    ART_BIBLE.md
    reference.png
    VISUAL_QA.md               # Vorher/Nachher, Messwerte
```

Dateien nur anlegen, wenn sie tatsächlich gebraucht werden. Existierende Lade-/Build-Pipeline bevorzugen; keine neuen großen Libraries. Quellassets editierbar und versioniert speichern; nicht bloß unnachvollziehbare generierte Ausgabe. Sprite-Manifest enthält `x,y,width,height,pivotX,pivotY`, Zustandsname und Animationsframe-Dauer. PNG mit Transparenz, 1:1 Pixel, `imageSmoothingEnabled=false` bei Sprite-Rendering. Politische Textlabels und dünne Kartenkonturen dürfen weiterhin geglättet werden.

## 8. Performance und Integrität

- Vorhandene Simulationslogik, KI, Wirtschaft, Diplomatie, Spielstände, Eigentum, Seewege und Fronten unangetastet lassen, sofern es ausschließlich um Darstellung geht.
- Keine PRNG-/`Math.random()`-Aufrufe im Rendering, die die Spielsimulation beeinflussen. Für Deko einen **eigenen stabilen visuellen Hash** aus Sektor/Region/Seed verwenden. Bei Reload/Zoom dieselbe Deko an derselben Position.
- Basisrelief + Geländedekoration in **Offscreen-/Cache-Layer**, nicht alle 480×260 Sektoren bei jedem RAF neu zeichnen.
- Spriteatlas einmal laden/preloaden, Fallback bei Assetfehlern; kein pro-Frame-Erzeugen von Sprites/Objekten.
- Viewport-Culling, Zoom-LOD, dichteabhängige Unterdrückung von Deko und überlappenden Labels.
- Kein FPS-/RAM-Einbruch bei 50 Ländern, großem Krieg, Mac Retina / DPR2.
- Letzte berichtete lokale Benchmarks: Kartenaufbau ca. **10,00 ms** Median (identischer Zustand), Simulation **9,22 ms** Median (50 Länder). Als Vergleich verwenden, **wenn diese lokalen Messungen/Reports nachvollziehbar vorhanden sind**; keine Zahlen erfinden. Einzelne 33-ms-Bildintervalle waren offen.

## 9. Definition of Done (DoD)

Die Arbeit ist erst beendet, wenn:

1. Visuell **eigene Pixel-Art-Assets** für mindestens Terrain, existierende Stadtlevel, vorhandene weitere Gebäude und die sichtbaren echten Truppen-Ereignisse existieren und **im laufenden Spiel wirklich angezeigt werden**.
2. Stadtausbaustufen sind auf einen Blick verschieden; vorhandene Fabrik/Militärgebäude sind voneinander und von Städten verschieden.
3. Die Europakarte bleibt bei Standardzoom ruhig, orientierbar, politisch korrekt; bei Taktikzoom bekommt sie Charakter und Tiefe.
4. Besitzfarben, korrekte Zahlen, Auswahl, Hover, Rechtsklick, Allianz- und Frontmarker sind nicht schlechter lesbar; Trefferflächen passen exakt zur sichtbaren Grafik.
5. Visueller Zustand ist deterministisch, Rendering mutiert **nie** Game-State; alte Saves bleiben kompatibel.
6. Vorher/Nachher-Screenshots: **Gesamteuropa, normaler Zoom, taktische Stadt-/Gebäudeansicht, aktive Schlacht** jeweils gleicher Seed/Blickpunkt, möglichst Browser-Viewport und DPR dokumentieren. Sichtkontrolle auch bei dichter Bebauung.
7. Gezielter Regressionstest für LOD/Bounds/Sprite-Manifeste und **ein** Browser-Smoke-Test für Laden, Auswahl, Bauen, Truppenanzeige/Kampf. Wenn möglich ein Profilingvergleich unter identischen Bedingungen.
8. Keine überflüssigen neuen Game-Entities, keine Platzhalter als angeblich fertige Assets, keine unerklärte Verschlechterung von Renderperformance.
9. Bericht enthält benannte Dateien, tatsächlich erreichte Verbesserungen, Tests und belastbare Messwerte; keine beschönigten Behauptungen.

## 10. Priorität innerhalb EINER fertigen Codex-Iteration

1. Den echten lokalen Stand lesen und vorhandene Grafik/Assets/Elemente erfassen.
2. Eine visuell schlüssige **vertikale Scheibe** (Gras/Küste/Berge/Wald + vorhandener kleiner Stadtmarker + Soldatengruppe) bauen, kurz im Browser ansehen, störende Stilbrüche einmal beheben.
3. Dieselbe Stilregel auf alle **bereits existierenden** Gebäude und Stadtlevel anwenden.
4. Zoom-LOD, Hitboxes, Kampfanimationen und UI-Überdeckungen fertig integrieren.
5. Kleine gezielte Tests, Screenshots, vorher/nachher Profile, Ergebnis dokumentieren.

Fertig heißt **sichtbar fertig integriert**, nicht nur Design-Dokumente und Mockups. Keine endlosen Diagnose-/Commit-Runden, keine unnötige Engine-Neuimplementierung.
