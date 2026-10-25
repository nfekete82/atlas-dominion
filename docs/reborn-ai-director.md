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
npm run benchmark:ai -- --map 4 --seeds 2026,2027,2028 --seconds 240 --opponent guarded
```

Der Bericht vergleicht mindestens:

- bis zum ersten Angriffsstart und ersten Frontkontakt benötigte Zeit
- tatsächliche erreichte Bastionseroberungen
- verfügbare Fahrzeuge, Zeitpunkt der ersten Fabrik und des ersten Fahrzeugs
- aktive Angriffssekunden und Produktionszeit je Gebäudetyp
- Verluste des Spielers, Credits und aktive KI-Einheiten
- Rechenzeit für die gesamte Simulation

Das Benchmark-Szenario nutzt standardmäßig einen **geskripteten blauen
Verteidiger** (`--opponent guarded`). Dieser baut über `Simulation.build`
seine Kaserne und später einen Turm, bildet eigene Verteidiger über
`Simulation.recruit` aus und bezahlt alles aus seinen **unveränderten
950 Startcredits plus normalem Gebietseinkommen**. Es werden keine
Gratis-Einheiten erschaffen. Dieser Gegner ist bewusst kein menschlicher
Profi, verhindert aber hoffentlich ein allzu triviales schnelles Spielende.
Mit `--opponent idle` lässt sich der vorherige untätige Spieler
nachstellen.

Außerdem werden jetzt `elapsedSeconds` und `terminalStatus` ausgegeben.
Eine 180-Sekunden-Anforderung bedeutet **nicht**, dass ein Spiel 180
Sekunden gespielt hat: Es kann durch Sieg/Niederlage früher enden.
`peakVehicles` zählt gleichzeitig existente Fahrzeuge;
`vehiclesOrdered` zählt real bezahlte Produktionsaufträge und ist
nicht mit tatsächlich fertig produzierten Fahrzeugen zu verwechseln.

Die erste Messung (Seeds 2026/2027, Karte Mittel, untätiger Gegner,
je maximal 180 Spielsekunden) ergab 3 Eroberungen und 0 Fahrzeuge
für beide Varianten. Sie zeigt **keinen** Director-Vorteil. Die
zerstörten blauen Hauptquartiere machen diesen alten Test ungeeignet,
um zuverlässige Schlüsse über die spätere Fabrikproduktion zu ziehen.

Behobener Budget-Konflikt: Ein geplanter 450-Credit-Flugfeldbau
reservierte Geld, während die erste fertiggestellte Fabrik noch
keine Fahrzeuge produziert hatte. Das neue Makro-Ziel verlangt zuerst
mindestens **zwei in Bau befindliche oder existierende Bodenfahrzeuge**,
bevor ein Flugfeldprojekt Reserven beansprucht.

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


## Zweiter A/B-Lauf: erste belegbare Verbesserung (25.10.2026)

Lokale Resultate des Projektinhabers, mittlere Karte (`mapVersion=4`),
Seeds 2026/2027, jeweils 240 tatsächliche Simulationssekunden,
`--opponent guarded`:

| Kennzahl | Baseline | Director |
|---|---:|---:|
| Eroberte Bastionen im Mittel | 4 | **6** |
| Mittlere Angriffsdauer | 92,5 s | **139,5 s** |
| Bezahlte Fahrzeugaufträge | 1 | **2** |
| Gleichzeitig existierende Fahrzeuge (Peak) | 1 | 1 |
| Erste fertiggestellte Fabrik | 68 s | 68 s |
| Erste Fahrzeugerscheinung | 139–191 s | 121 s |

`npm run build` und **15 von 15 gezielte Tests** bestanden.
Diese Messung belegt einen Fortschritt bei Expansion, **noch keinen
belastbaren Kampfvorteil gegen aktive Einheiten**. Insbesondere blieb
die blaue HQ-Lebensenergie bei 1200. Der alte `blueUnitsLost`-Wert
war außerdem falsch: Er verglich nur Anfangs- und Endbestand, obwohl
Blau im Verlauf neue Einheiten nachproduziert. Diese Zahl darf **nicht**
als Nachweis für null getötete blaue Soldaten interpretiert werden.

### Korrekturen nach diesem Ergebnis (erneute Prüfung ausstehend)

- Die Airfield-Reserve beginnt beim Director erst nach
  **drei** echten oder bereits bezahlten Bodenfahrzeugen und ab
  mindestens 55 Credits Einkommen je Einnahmeintervall.
  Das verhindert, dass Flugfeld-Ersparnisse bereits nach zwei
  Bestellungen die weitere Fabrikproduktion blockieren.
- Angriffsverstärkung bekommt auch ohne explizites Gebäudeziel
  `attackMove` statt `move`. Versetzungen und Rückzüge der
  Director-KI bleiben dagegen ausdrücklich `move` und unterdrücken
  automatische Kampfabläufe, selbst wenn zeitgleich ein Angriff läuft.
- Der Benchmark zählt blaue Verluste anhand **verschwundener,
  zuvor lebender Einheiten-IDs**, misst HP-Schäden und zählt echte
  abgefeuerte Fahrzeugschüsse.
- Der geskriptete, regulär bezahlende blaue Verteidiger schickt
  Infanterie und schwere Infanterie zu **seinem eigenen Bastionpunkt**,
  damit rote Eroberungsversuche auf echte Abwehr treffen.

Der Benchmark enthält ausschließlich erlaubte Spielerbefehle für den
Verteidiger; kein Qwen, keine extra Ressourcen und keine verdeckten
Gegnerdaten. **Die Resultate vor und nach dieser Änderung der
Verteidiger-Strategie sind nicht direkt miteinander vergleichbar.**
Zum Nachweis einer tatsächlichen Verbesserung `baseline` und
`director` erneut unter *demselben neuen Szenario* testen.

Empfohlener gezielter Lauf:

```sh
npm run build
node --test tests/reborn-ai-director.test.mjs tests/reborn-map-ai.test.mjs
node scripts/benchmark-reborn-ai.mjs --map 4 --seeds 2026,2027 --seconds 300 --opponent guarded
```


## Dritter A/B-Lauf: echter Gegnerkontakt (25.10.2026)

Der Projektinhaber bestätigte lokalen Build und **25/25 Tests**
sowie 300 vollständige Simulationssekunden für beide Seeds
(2026/2027, `mapVersion=4`, `--opponent guarded`).

| Kennzahl (Ø über zwei Seeds) | Baseline | Director |
|---|---:|---:|
| Eroberte Bastionen | 4 | **6** |
| Tatsächlich gefallene blaue Einheiten (ID-Messung) | 2 | **7** |
| Von Fahrzeugen abgegebene Schüsse | 1 | **4** |
| Angriffssekunden | 130,5 | **156,5** |
| Bezahlte Fahrzeugbestellungen | 2 | 2,5 |
| Maximal gleichzeitig vorhandene Fahrzeuge | **2** | 1 |
| Blaue HQ-Lebenspunkte am Ende | 1200 | 1200 |

**Ergebnis:** Der Director zeigt nun sowohl einen besseren
Expansionswert als auch mehr tatsächliche Gegnerverluste. Die
Fahrzeugerhaltung bleibt aber schlechter als bei Baseline und das
HQ wurde in diesen Spielen nicht beschädigt. Die zwei Seeds beweisen
keine allgemeine KI-Überlegenheit.

### Nachgeschaltete Fahrzeug-Instandsetzung (neu, noch ungetestet)

- Ein Bauarbeiter kann beschädigte eigene Bodenfahrzeuge
  (Panzer, Spähwagen, Raketenwerfer) mit **18 LP/s** reparieren.
  Voraussetzung: echter Arbeiter, reale Reichweite, freie Sichtlinie,
  gültiger Reparaturbefehl. Keine kostenlosen HP aus dem Nichts ohne
  Supporteinheit.
- Der Director zieht solche Fahrzeuge bei **unter 38 % HP** aus der
  Kampfgruppe zu einer Position **hinter dem eigenen HQ** zurück.
  Bereits abkommandierte Fahrzeuge werden in der laufenden
  Offensivgruppe und beim Nachschub ausgeschlossen. Die
  vorhandenen aktiven Bauaufträge der Ingenieure werden nicht
  überschrieben. Wiederfreigabe ab **80 % HP**.
- Infanterie bleibt bei ihren Sanitätern: keine falschen
  Heilbefehle für beschädigte Panzer.
- Der Benchmark zählt jetzt `vehicleDeaths` und
  `vehicleRepairHp`, um nicht nur Eroberungen, sondern auch
  die tatsächlich erreichte Reparaturwirkung zu messen.

**Noch ausstehend:** erneuter TypeScript-Build, gezielte
Regressionstests und A/B-Läufe. Kein bestätigter Qualitätsgewinn
durch die neue Reparaturfunktion.

```sh
npm run build
node --test tests/reborn-ai-director.test.mjs tests/reborn-map-ai.test.mjs tests/reborn-control-retreat.test.mjs
node scripts/benchmark-reborn-ai.mjs --map 4 --seeds 2026,2027 --seconds 300 --opponent guarded
```
