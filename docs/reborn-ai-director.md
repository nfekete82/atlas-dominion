# Reborn AI Director – erste Petra-inspirierte Ausbaustufe

## Problem statt KI-Mythos

Qwen3-0.6B liefert nur gelegentlich eine Sektor-ID. Es baut keine Armee,
hält keine Front und gewinnt keine Kämpfe selbstständig. Deshalb wird die
reguläre RTS-KI als modularer, deterministischer Commander ausgebaut.
Sie läuft auf einem normalen statischen Webserver; WebGPU ist nicht nötig.

Dies ist **Ausbaustufe 1**, nicht eine bereits nachgewiesene neue
StarCraft-KI. Die neuen Fähigkeiten sind an die 4/8/12-Sektor-Karten
(`mapVersion >= 3`) gebunden. Alte Kampagnen verwenden weiterhin
die unveränderte Legacy-Taktik.

## Module

1. **`ai-director.ts`**: Reine, separat testbare Entscheidungen für
   Angriffsstärke, Abbruchbedingungen und Truppenzusammensetzung.
2. **`army-economy.ts`**: Baut nach wie vor mit echten Bauarbeitern,
   Standortprüfung, Credits und Baustellen. Ein Director aktiviert pro
   AI-Planungslauf **jede verfügbare** Produktionsstätte separat:
   Kaserne, Fabrik und Flugfeld produzieren parallel, sofern bezahlt.
   Fabrik hat Vorrang, damit sie nicht dauerhaft von billiger
   Infanterie verdrängt wird.
3. **`tactical-ai.ts`**: Die Hauptgruppe formiert sich auf einem
   erreichbaren roten Grenzsektor; auf freien Sektoren greifen bereits
   kleinere Trupps an. Bei befestigten Zielen muss genug sichtbare
   Kampfstärke bereitstehen. Angriffsmarsch erfolgt als
   **Angriffsbewegung**, nicht als stiller `move`-Befehl.
   Schwere Kolonnen dürfen nach dem Start frei aufbrechen und werden
   nicht durch einen starren gemeinsamen Marschpuffer eingefroren.
   Ein laufender Angriff endet nicht automatisch nach zwei Verlusten,
   sondern bei wirklichem Zusammenbruch der Kampfgruppe,
   Verlust des Ziels, zu langem Stillstand oder unbekämpfbarem Turm.
4. **`tactical-ai.ts`-Nachschub**: Bisherige reale Luftlandung und
   Marschnachschub bleiben aktiv. Zweite Fahrzeugflanke und bekannte
   Industrieziele bleiben aktiv.
5. **`scripts/benchmark-reborn-ai.mjs`**: Wiederholbare echte Partien
   gegen den exakt gleichen Anfangszustand; rote KI mit
   `baseline` und `director`, identische Zufallsseeds und
   Simulationsschritte.

## Messung

```sh
npm run test:ai-director
npm run benchmark:ai -- --map 4 --seeds 2026,2027,2028 --seconds 240
```

Der Bericht vergleicht mindestens:

- bis zum ersten Angriffsstart und ersten Frontkontakt benötigte Zeit
- tatsächliche erreichte Bastionseroberungen
- verfügbare Fahrzeuge, Zeitpunkt der ersten Fabrik und des ersten Fahrzeugs
- aktive Angriffssekunden und Produktionszeit je Gebäudetyp
- Verluste des Spielers, Credits und aktive KI-Einheiten
- Rechenzeit für die gesamte Simulation

Es wird **kein automatischer Sieg** behauptet, wenn lediglich mehr
Einheiten produziert wurden. Bei weniger Eroberungen muss die Doktrin
nachgebessert werden. Wir vergleichen nicht mit einer echten
StarCraft- oder Petra-KI, sondern nur mit dem vorherigen Verhalten
von Atlas Dominion.

Die Benchmark-KI erhält keinerlei Sonderrechte, Ressourcenboni oder
Fog-of-War-Ausnahmen; außer dem Director-Modus ist der Anfangszustand
identisch. Der menschliche Gegner wird im automatischen Benchmark nicht
aktiv gesteuert. Siege gegen geschickte Spieler müssen deshalb
zusätzlich in echten Partien geprüft werden.

## Schutz der bestehenden Version

- Der neue Code liegt in einem eigenen GitHub-Branch und PR.
- Keine Änderung des öffentlichen `main`, des Sicherungsbranches
  oder deiner Mac-Dateien.
- Der Benchmark-Modus ist keine spielersichtbare Option und wird
  nicht im Savegame serialisiert.
- Qwen ist unverändert optional und kann ausgeschaltet bleiben.

**Stand:** Implementierung direkt über GitHub; TypeScript-Build,
Node-Tests, Langzeitbenchmark und Browsertest wurden hier noch
nicht ausgeführt. Ein messbarer Qualitätsgewinn muss zuerst
durch die Messung nachgewiesen werden.
