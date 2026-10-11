# ATLAS DOMINION — Architekturentscheidungen (ADR-001)

## Kernprinzipien

1. **Engine unabhängig von DOM:** `Game.step()` ist deterministisch für Seed, Aktionsfolge und Tick-Anzahl. Zustandsänderungen ausschließlich durch die Simulationsschicht.
2. **Festes Simulationsraster:** 240 × 160 Sektoren; reale Natural-Earth-Konturen als Terrain und einfache 4er-Nachbarschaft für Expansion.
3. **Autoritative Zeit:** Fester Spieltakt von 250 ms pro Tick, unabhängig von Rendering-Framerate; Pausen und Geschwindigkeiten überspringen keine Simulationsschritte.
4. **KI als normaler Spieler:** KI-Fraktionen rufen dieselben Angriffsregeln auf. Keine Teleportation oder illegale Wassereroberung; Ausnahmen sind ausdrücklich definierte, visuell markierte Seeübergänge.
5. **Render-Cache:** Gelände und territoriale Overlay-Flächen liegen in separaten Layern, nur HUD, Städte und Zielindikator werden je Frame gezeichnet.
6. **Separation of concerns:** Land-Geometrie in `data/`, Regeln in `engine/`, Darstellungslogik in `render/`, Controller in `main.ts`.

## Spielschleife

```text
UI-Klick ----> Game.order(faction, target)
                  |
Intervall -------> Game.step() (4 Ticks/s × Speed)
                  |          |-- Einkommen
                  |          |-- KI-Ziele
                  |          |-- Nachbarfront und Kampf
                  |          |-- Eroberungen und Sieg/Niederlage
                  |---> State → MapRenderer.updateTerritory() → RAF.draw()
                  |---> State → HUD / Leaderboard / Ereignisse
```

## Iterationsziele

- Renderer API beibehalten, später WebGL/PixiJS-Version ergänzen.
- KI nach Belohnungsfunktion von Vorwärtsbewegung / Feinddruck bewerten, optional A* für Ziele über Landbrücken.
- Netzwerksimulation (später): Client sendet **nur** Befehle, Node.js-Server führt die Engine aus; alle Clients erhalten Ticks und Snapshots. Tick-basierter State-Hash ermöglicht Replay/Desync-Prüfung.
- Persistenz (später): Snapshot + PRNG-Zustand + Aktionenlog; der aktuelle v0.1-RNG wird deshalb noch nicht als Savegame angeboten.

## Grenzen

Landsektoren besitzen vier orthogonale Nachbarn. Kurze, feste Seeübergänge ermöglichen den Zugang zu den britischen Inseln, Sizilien und Anatolien. Vollständige Flottenmechaniken und amphibische Landungen gehören ausdrücklich in v0.3. Die KI passt ihr Ziel periodisch an, verwendet noch keine Mehrfrontstrategie. Auch die Frontauflösung ist bewusst einfach und trennt noch nicht mobile Armeeverbände von Reserve-Truppen.
