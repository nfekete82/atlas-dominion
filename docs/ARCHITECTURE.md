# ATLAS DOMINION — Architekturentscheidungen (ADR-001)

## Kernprinzipien

1. **Engine unabhängig von DOM:** `Game.step()` ist deterministisch für Seed, Aktionsfolge und Tick-Anzahl. Zustandsänderungen ausschließlich durch die Simulationsschicht.
2. **Festes Simulationsraster:** 480 × 260 Sektoren; reale Natural-Earth-Konturen als Terrain und einfache 4er-Nachbarschaft für Expansion.
3. **Autoritative Zeit:** Fester Spieltakt von 250 ms pro Tick, unabhängig von Rendering-Framerate; Pausen und Geschwindigkeiten überspringen keine Simulationsschritte.
4. **KI als normaler Spieler:** KI-Fraktionen rufen dieselben Angriffsregeln auf. Keine Teleportation oder illegale Wassereroberung; Seeangriffe verwenden echte Wasserpfade zwischen eigenen Abfahrtsküsten und verbundenen Zielküsten.
5. **Render-Cache:** Gelände und territoriale Overlay-Flächen liegen in separaten Layern, auch die reale Natural-Earth-Topografie wird einmal bei Bildladung auf DPR 2 gerendert. HUD, Städte und Flottenmarker bleiben separate Ebenen.
6. **Separation of concerns:** Land-Geometrie in `data/`, Regeln in `engine/`, Darstellungslogik in `render/`, Controller in `main.ts`.

## Spielschleife

```text
UI-Klick ----> Game.launchAttack(faction, sector, percent)
                  |-- Prüft Fraktions-Nachbarschaft
                  |-- Reserviert % der verfügbaren Truppen
                  |-- Fügt AttackOrder zum Aktionszustand hinzu
Intervall -------> Game.step() (4 Ticks/s × Speed)
                  |          |-- Einkommen
                  |          |-- KI-Ziele
                  |          |-- AttackOrders der Spielerfraktion aus Kontingent abarbeiten
                  |          |-- KI-Kampf entlang ihrer automatisch gewählten Grenzen
                  |          |-- Eroberungen und Sieg/Niederlage
                  |---> State → MapRenderer.updateTerritory() → RAF.draw()
                  |---> State → HUD / Leaderboard / Ereignisse
```

## Maritime Navigation und Speicherung

`engine/navigation.ts` berechnet die statische, vom Kartenrand erreichbare Ozeanmaske und echte Küsten einmal. Binnengewässer und Landinneres sind ausgeschlossen. Eine separat generierte globale Natural-Earth-Maske sperrt auch nicht spielbare reale Landflächen (z. B. Tunesien und Iran), ohne die Besitzkarte zu verändern. Eine Multi-Source-BFS beginnt an allen aktuell eigenen Küsten. Ihr deterministischer Vorgängerbaum beantwortet viele Zielanfragen; bis zu vier Felder pro Spiel werden anhand der exakten eigenen Küstenmenge gecacht. Veränderte Abfahrtsküsten invalidieren diesen Schlüssel. Zielklicks suchen nur innerhalb derselben zusammenhängenden Besitzregion; neutrale Inlandsklicks bleiben auf 14 Landzellen Tiefe begrenzt.

Ein normaler Linksklick bevorzugt Landfront und Gegenangriff, sonst die erreichbare Seeinvasion. Eine `AttackOrder` speichert `seaRoute`, `seaDistanceKm`, `departure`, `anchor`, `startedTick` und `arrivalTick`. Soldaten werden genau einmal aus der mobilen Reserve transferiert. Sie bleiben während Hin- und Rückfahrt in der Bevölkerung enthalten. Die Reisedauer beträgt `clamp(ceil(geodätische Kilometer / 25), 8, 96)` Simulationsticks; erst danach darf Küstenkampf beginnen. Die kurze Höchstdauer ist ein Spieltempo-Parameter, keine historische Geschwindigkeitsangabe.

`cancelAttack(id)` lässt eine unlandete Flotte über ihre bisherige Route zurückfahren; erst danach werden Überlebende wieder frei. Verlorene Küsten oder veränderte Zielbesitzer lösen dieselbe Rückfahrt aus. Falls der alte Hafen inzwischen verloren ist, demobilisiert das noch lebende Land seine Überlebenden bei Ende der Rückfahrt in die nationale Reserve. Eine vollständig eliminierte Nation verliert ihre gestrandeten Armeen mit verbuchten Verlusten. Erschöpfte, noch nicht gelandete Armeen fahren ebenfalls zurück. Nach einer erfolgreichen Landung gelten unverändert die bestehenden Landkampf- und Rückzugsregeln.

Die KI prüft Seeoptionen auf nach Nation versetzten 32-Tick-Terminen auch bei vorhandenen Landangriffen. Höchstens eine Flotte und zwei Gesamtangriffe sind erlaubt. Geprüft werden entsendbare Truppen, echte Heimatreserve, Verteidigung, relative Macht, Entfernung, Städte/Ausbau, Einkommen und laufende fremde Angriffe. Die vorhandene friedliche Anfangsphase, versetzte Kriegsfenster, neutrale Zielpräferenz und Dogpile-Strafwertung bleiben erhalten; eine dritte neu angreifende KI-Nation wird zusätzlich ausgeschlossen.

Das additive Savegame-Schema bleibt Version 1. Neue Routen werden geometrisch und zeitlich validiert und exakt gespeichert. Alte laufende Seeübergänge ohne Route werden auf gültige Wasserwege migriert; der vergangene Reiseanteil und sämtliche bezahlten Soldaten bleiben erhalten. Ohne gültige Abfahrt werden die Soldaten einmal zurückgegeben. Frontier- und Navigationscaches werden neu aufgebaut und sind kein Spielzustand. Pause stoppt Simulation und Flottenposition; Reduced Motion zeigt dieselbe autoritative Position ohne zusätzliche Bewegung.

`render/sea-voyages.ts` interpoliert entlang der tatsächlichen geodätisch gewichteten Routensegmente. Der Renderer cached Route und `Path2D`, zeichnet 12 CSS-Pixel breite Schiffe und dezente gestrichelte Pfade; DPR und Zoom verändern die Weltlage nicht. Topografiequellen, Verarbeitung und Lizenz stehen in [GEODATA.md](GEODATA.md).

## Iterationsziele

- Renderer API beibehalten, später WebGL/PixiJS-Version ergänzen.
- KI nach Belohnungsfunktion von Vorwärtsbewegung / Feinddruck bewerten, optional A* für Ziele über Landbrücken.
- Netzwerksimulation (später): Client sendet **nur** Befehle, Node.js-Server führt die Engine aus; alle Clients erhalten Ticks und Snapshots. Tick-basierter State-Hash ermöglicht Replay/Desync-Prüfung.
- Persistenz: vollständige Version-1-Snapshots einschließlich RNG-Aufrufzahl; deterministisches Replay und Migration älterer Seefahrten sind implementiert.

## Grenzen

Landsektoren besitzen vier orthogonale Nachbarn. Wasserpfade benutzen dasselbe Raster; dessen Auflösung begrenzt kleine Inseln und enge Meerengen. `SEA_CROSSINGS` bleibt nur als Legacy-Topologieexport für bestehende Aufrufer erhalten und steuert keine Angriffe oder Darstellung. Die KI passt ihre Ziele periodisch an und begrenzt parallele Kampagnen; mobile Reserve, stationierte Verteidiger und lebende offensive Armeen werden getrennt bilanziert.

## ADR-002: direkter Angriffsmodus (v0.2)

- Der Mausklick auf **irgendeinen Sektor einer angrenzenden Fraktion** löst eine Offensive aus; nicht nur exakt ein Grenzsektor. Das Ziel wird über die Besitzer-ID identifiziert. Neutral gilt als eigenständiger Zieltyp. Für Seelandungen gilt stattdessen die oben dokumentierte Wasserpfadsuche.
- Der Truppenanteil wird beim Klick in ganze Einheiten umgerechnet und **sofort von `faction.troops` abgezogen**. AttackOrders verwalten `committed`, `remaining` und `conquered`; aus diesen Reserven erfolgen die Folgeschläge. Kein zweiter Abzug derselben Truppen.
- Die Spielerfraktion führt **keine automatischen Angriffe mehr** aus. KI nutzt weiterhin das bestehende deterministische Nachbarfrontsystem. Angriffsziele werden nach dem Klick dynamisch entlang der Front der ausgewählten Fraktion aufgelöst.
- Bei Verlust einer Landkontaktfront werden überlebende Soldaten in die Reserve zurückgeführt. Unlandete Seearmeen fahren zuerst zurück. Die gemeinsame Frontkampflogik entscheidet über reale Schäden, Sektoren und Städte.
- Das Rendering aggregiert Truppen **pro kontrollierender Fraktion** auf dem Screen, nicht pro geografisch benanntem Nationalstaat. Separates Staatensystem und regionale Truppenpools wären eine spätere Simulationserweiterung.
- Client sendet künftig nur `launchAttack`-Befehle; der spätere Multiplayer-Server muss Grenzkontakt, Ressourcen und Ratio selbst validieren.
