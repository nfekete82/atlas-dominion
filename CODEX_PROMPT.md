# Auftrag an Codex: ATLAS DOMINION — kompletter Grafik-Overhaul

Arbeite im aktuell ausgecheckten lokalen Projekt `~/Projects/atlas-dominion`. Lies **zuerst** `docs/art-direction/ART_BIBLE.md` und nutze `docs/art-direction/reference.png` als visuelle Stilreferenz (nur inspiriert, nicht kopieren).

Du bist Lead Game Artist, Pixel Artist und TypeScript-/Canvas-Performance-Engineer. **Implementiere eine komplette sichtbare Überarbeitung des vorhandenen Spiels, nicht nur eine Analyse oder ein Art-Konzept.** Ziel: eigenständiges, handgestaltet wirkendes, einheitliches Pixel-Art-Strategiespiel statt generischer KI-/Prototype-Optik. Geländestruktur, Städte, eventuell vorhandene Fabriken und Militärgebäude sowie Soldatendarstellung sollen endlich zusammenpassen.

**Vor Beginn:**
1. Lies `git status`, alle projektspezifischen AGENTS.md-Regeln, die tatsächliche lokale Codebasis, Rendering-Pipeline, Assets und vorhandene Build-/Test-Skripte. Bewahre **sämtliche uncommitteten lokalen Änderungen**, keine `reset --hard`, kein `git clean`, kein Überschreiben oder Umsortieren fremder Arbeiten.
2. Identifiziere **wirklich vorhandene** baubare Gebäude und Unit-/Terrain-Systeme. Die GitHub-Version enthält noch nur `city` als Bauklasse mit Level 0–5; lokal könnten `factory` und `military` hinzugekommen sein. Nutze die lokale Wahrheit. **Keine nicht existierenden Panzer, Flugplätze, Straßen oder neuen Spielmechaniken hinzuerfinden.**
3. Verifiziere die Karte: 480×260 ist **Gameplay-Raster** und 1600×900 Weltkoordinaten — die in der Art Bible definierten 32/40/48 px beziehen sich auf **Quellsprites**, niemals auf Sektorgröße.

**Implementiere dann in EINEM fokussierten Durchgang:**

A. **Terrain (höchste visuelle Priorität):** Bestehende Natural-Earth-Topografie/Europa-Küsten und Besitzerfarben beibehalten. Stilisierte, konsistente, ruhige Grasstrukturen, geografisch plausible Bergzüge und Waldcluster, hübschere Wasser-/Küstenübergänge. Nutze Cache-Layer + viewportabhängige Detailstufen. Für keine Deko die echte Land-/Wasser-Geometrie, Wegfindung oder Eroberungsregeln verändern. Keine optischen Fantasiestraßen oder willkürlichen Berge.

B. **Gebäude:** Erzeuge echte eigenständige, harmonisierte Pixel-Art-Sprites und integriere sie in den vorhandenen Renderer. Stadt-Level 0–2 = kleine Siedlungen; 3–4 = ummauerte Stadt; 5 = markante Metropole. Unterscheide Level nachvollziehbar. Falls lokal Fabrik/Militärgebäude existieren: Fabrik mit Shed-/Schornsteinsilhouette; Militärkomplex als erkennbare Kaserne/Bunker/Kommandobau. Teamfarben dezent, aber gut sichtbar. Ein Lichteinfall oben links, gleiche Perspektive, klare Bodenschatten, begrenzte Palette. **Keine identischen Kästen mit bloß geändertem Icon.**

C. **Soldaten / Truppen:** Ersetze die rein abstrakt wirkenden Kampfpartikel an passenden Zoomstufen durch klar lesbare Mini-Soldatengruppen mit sichtbarem Helm/Waffe und kurzen idle/move/fire-Animationen. Die kleinen Figuren sind **rein visuelle, aggregierte Repräsentationen** der realen `BattleEvent`-/Army-/Transitdaten. Keine fiktiven Truppen, keine Animationen ohne Ereignisse, keine Truppen-Erzeugung. Frontwerte, Verlustzahlen, Landungsregeln und Determinismus bewahren. Bleibe bei der tatsächlichen Einheitentypologie des Spiels.

D. **Echte Pixel-Art:** Nutze transparente PNG-Atlasdateien mit nachvollziehbarem Sprite-Manifest und, wenn nötig, einem reproduzierbaren Skript/editiertem Asset-Quellformat. Saubere Pixelcluster, konsistente Perspektive und Palette statt Noise-Filtern, unsauberen SVG-/CSS-Platzhaltern oder wahllos fremden Bildstilen. Originalgrafiken, keine geschützten Referenzsprites kopieren. Quellgrößen/Palette/Funktionssilhouetten stehen verbindlich in der Art Bible.

E. **Zoom & Interaktion:** Strategischer Zoom = ruhige politische Europakarte; mittlerer Zoom = aussagekräftige Gebäude; taktischer Zoom = detaillierte Szenen mit Terrain und Soldaten. Benutze die vorhandenen LOD-Schwellen als Ausgangspunkt. Stadtmarker-Kollision, Country Labels, Frontzähler und Hover erhalten. Wenn ein Sprite größer wird, **müssen sichtbare Bounds, Hover, Auswahl und Rechtsklick dieselben Pixel abdecken**. Der Spieler soll jederzeit Gebäude und Länder sicher bedienen können.

F. **Technische Qualität:** Ändere möglichst nur Rendering, dazugehörige UI/CSS- und Assetteile. Kein großer Engine-Rewrite, keine externen Runtime-KI-Modelle, keine unnötigen Dependencies. Cache statische Layer, lade Atlas nur einmal, culle außerhalb des Viewports, generiere keine per-Frame Texturen. Separater stabiler visueller Zufall, der den Game-RNG nie konsumiert. Alte Saves und 4 KI-Stufen unverändert.

**Arbeitsablauf:** Erfasse lokal kurz Schwachstellen und relevante Dateien, implementiere dann sofort. Prüfe einmal gezielt im Browser (nicht nur Unit-Tests): volle Europakarte, Stadt-/Gebäudezoom, echter Kampf, Auswahl und Rechtsklick. Erzeuge dokumentierte Vorher/Nachher-Screenshots unter gleichen Bedingungen und prüfe grafische Qualität selbst kritisch. Kein Abschluss mit halb implementierten Mockups. Nur nötige gezielte Tests und ein Browser-Regressionstest; keine endlosen Diagnose-/Test-/Commit-Schleifen.

**Abschluss:** `docs/art-direction/VISUAL_QA.md` ergänzen mit: konkret eingebauten Grafikassets, Screenshots, Änderungen an Renderer/LOD/Hitboxes, getesteten Abläufen, relevanten Render- und Simulations-Benchmarks (nur gemessene Werte), offenen Punkten. Lokal sinnvolle eigene Commits nur, wenn alle bestehenden uncommitteten Änderungen eindeutig von dieser Arbeit getrennt bleiben. **Kein Push, kein Merge.**

**Erfolgskriterium:** Deutlich schönere **wirklich im laufenden Spiel eingebundene** Landschaft, Städte, vorhandene Gebäude und grafische Soldaten, eigenständiger konsistenter Stil wie ein professionelles Pixel-Art-Strategiespiel, ohne Nachteile für Performance, Kartenkorrektheit, Steuerung oder Spielsimulation.
