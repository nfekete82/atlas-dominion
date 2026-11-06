> Folgestand: [PROJECT TITAN – adaptive Gegnerstrategien und echte Commit-A/B-Validierung](project-titan-20261026.md).

# Threat Response — Petra-Konzepte für Atlas Dominion

Stand: 26.10.2026. Basis: `240f665`, Branch
`feat/reborn-campaign-commander-20261025`. Umsetzung:
`feat/reborn-threat-response-20261025`.

## Untersuchung und systematischer Vergleich

Untersucht wurden die vier vom Auftrag genannten Dateien im öffentlichen
[0-A.D.-Repository](https://github.com/0ad/0ad/tree/master/binaries/data/mods/public/simulation/ai/petra).
Es wurden ausschließlich Konzepte ausgewertet. Die TypeScript-Implementierung
ist eigenständig; keine fremden Dateien oder Quellcodeabschnitte wurden kopiert
oder übersetzt.

| Petra-Komponente | Beobachtetes Konzept | Bisheriger Atlas Commander | Eigenständige Umsetzung |
|---|---|---|---|
| [defenseManager.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/defenseManager.js) | Beschussereignisse werden zugeordnet; laufende Angriffspläne behalten Zuständigkeit für ihre Einheiten. Verteidigung wird nach Bedarf zugewiesen. | Nur Fahrzeuge unter 67 % HP reagierten direkt auf Schaden; der Makroplaner konnte andere Einheiten bis zum nächsten 3-s-Puls weiterschicken. | Ereignispfad vom echten Turmtreffer zu `underTowerFire`, kurze geschützte Rückzugsaufträge und begrenzte lokale Verteidigungsverbände. |
| [defenseArmy.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/defenseArmy.js) | Eigene und gegnerische Stärke werden getrennt geführt; ein kontextabhängiger Vergleich liefert den Verstärkungsbedarf. | Grobe Mindestzahlen und ein normalisierter eigener Stärkewert, ohne belastbaren Vergleich mit der ganzen bekannten Turmstellung. | `assessBattle`: eigener HP-/Schadenszustand, sichtbare mobile Gegner, erinnerte Türme, Verstärkungsdefizit und vier Entscheidungen: Angriff, Belagerung, Verstärken oder Rückzug. |
| [attackManager.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/attackManager.js) | Vorbereitung und laufende Angriffe sind getrennte Planbestände mit eigenen Verbänden und Lebenszyklen. | Ein Hauptverband; Verteidigung konnte die gesamte Armee umlenken, Reserven hatten keine dauerhafte Nebenmission. | Getrennte Roster für Hauptangriff, lokale Verteidigung und kleine Expansion. Ein Zweierverband kann sichere Kontrollpunkte nach bekanntem Lagebild sichern, während der Hauptangriff Belagerungsmittel sammelt. |
| [attackPlan.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/attackPlan.js) | Ein Plan verwaltet Ziel, Vorbereitung, Wege, Sammeln, Ereignisse und Abbruch; beim Abbruch wird ein erreichbarer eigener Sammelpunkt gesucht. | Missionspersistenz und einfache Belagerung vorhanden, aber kein geschützter taktischer Rückzug und nur Abstand zum einzelnen Zielturm. | Sichere Rückzugspunkte relativ zu allen bekannten Geschützen; unveränderte Marsch-/Feuerqueues bleiben bestehen. Bei überlappenden Türmen werden erreichbare Feuerpositionen mit echter Schusslinie gesucht und gegebenenfalls ein exponierter Randturm zuerst gewählt. |

### Unterschiede zur Spielmechanik

Atlas hat höchstens 48 Einheiten pro Seite, spezialisierte Bauarbeiter, feste
bezahlte Produktionsketten und keine entsprechende Garnisons-, Helden-, Elefanten-
oder Schiffswirtschaft. Solche Petra-Systeme wurden nicht übernommen. Mehrere
Massengroßangriffe wären hier häufig eine schädliche Zersplitterung; stattdessen
arbeiten ein Hauptangriff und kleine klar abgegrenzte Nebenverbände.

Die entscheidende Atlas-Eigenschaft ist der reale Reichweitenunterschied:
Geschützturm 600 m, Artillerie 680 m. Der neue Planer prüft deshalb außerhalb aller
bekannten Geschützreichweiten Bodenbegehbarkeit, Schusslinie und Anmarschweg.
Ein einzelnes Geschütz behält den kürzeren bisherigen Belagerungsablauf. Bei
mehreren Geschützen berücksichtigt die Stellungswahl deren Überschneidungen.

## Implementierung

- `battle-response.ts` enthält ausschließlich deterministische Atlas-Doktrin und
  validierte Zustandsdaten. Die Bewertung benutzt aktuelle eigene HP, reale
  Waffenwerte, Schaden gegen Gebäude, sichtbare mobile Gegner und gemerkte
  Geschütze. Ein echter Reichweitenkonter kann Belagerung erlauben, obwohl die
  Summe der Turmstärke einen Nahkampfangriff aussichtslos macht.
- `simulation.ts` meldet einen tatsächlich angewendeten Turmtreffer direkt an den
  Controller. Der Reaktionsbefehl entsteht im Treffer-Tick; Bewegung beginnt
  spätestens im nächsten regulären 50-ms-Tick. Ein verdeckter Schütze liefert
  dabei keine ID, Position oder HP an die neue Logik. Die Einheit kann sich anhand
  ihres eigenen Beschusses zu bekanntem eigenem Boden zurückziehen.
- Rückzugsaufträge werden gegen Makro-Neuverteilung geschützt. Salven werden
  zusammengefasst: Ein Treffer löst nicht für jede einzelne Kugel eine neue
  Wegsuche aus. Bereits reparaturbedürftige Fahrzeuge behalten ihre bestehenden
  Reparaturaufträge.
- Fehlgeschlagene Fronten speichern eigene beobachtete Gefechtsorte, die damalige
  Stärke und eine begrenzte Wiederholsperre. Ein deutlich stärkerer Verband,
  verfügbare Artillerie, eine schwächere bekannte Stellung oder eine erneute
  Lageprüfung nach Ablauf erlauben einen neuen Versuch. Unveränderte schwache
  Wellen werden zusätzlich durch die aktuelle Stärkebewertung zurückgehalten.
- `localDefense` entnimmt nur die erforderliche nahe Stärke. `expansionRaid`
  besitzt seine eigene stabile Mission und eigene Einheiten, die der Hauptplaner
  währenddessen nicht umkommandiert. Die Roster werden bei Bedrohungsänderung,
  Zielerfüllung oder Verlusten freigegeben.
- `director-production.ts` schützt das bezahlte Artilleriebudget entsprechend dem
  festgestellten Belagerungsbedarf. Preise, Startressourcen, Produktionslimits,
  Einheitenwerte und Siegbedingungen bleiben unverändert.
- Der neue Zustand liegt im optionalen `battle`-Feld der bestehenden Save-Struktur.
  Alte Saves ohne dieses Feld bleiben gültig; fehlerhafte neue Felder werden
  verworfen. Spielerbefehle, der interne Baseline-Modus und Legacy-Planer werden
  durch die Reaktionslogik nicht umgestellt.

## Sichtberechnung und Performance

Die ersten großen Versuche zeigten, dass die wiederholten Sichtstrahlen den
Simulationsaufwand dominierten. `vision-cache.ts` speichert deshalb ausschließlich
exakte Sichtmasken von Quellen, die tatsächlich unverändert stehen bleiben.
Bewegte Quellen benutzen weiterhin die bisherige Berechnung. Position, Sichtweite,
Nahsicht und Flugstatus werden exakt verglichen. Entfernte Quellen verschwinden
sofort aus der Sicht; Änderungen der Geländedeckung invalidieren beide Seiten.
Der Cache ist abgeleitet, begrenzt und wird nicht gespeichert.

Vier Tests vergleichen jedes Sichtbit mit dem ursprünglichen Raycasting auf
Kartenversionen 0–5, einschließlich Klippen, Bewegung, Flug, Quellenentfernung und
Geländeänderung. Eine bezahlte autonome Simulation liefert mit aktivem Cache und
bewusst ständig invalidiertem Cache dieselben Sichtarrays und Saves. Unveränderte
Quellen benötigen nach dem Aufwärmen keine erneuten Sichtstrahlen.

Über die sechs Turm-Rush-Paare sinkt der gemessene mittlere Node-Simulationstick
von **12,48 auf 1,13 ms**, der mittlere Makro-KI-Puls von **1,96 auf 1,23 ms**.
Die Matches liefen teilweise parallel; das sind keine kontrollierten FPS- oder
Browser-Framelatenzwerte. Die bitgenaue Parität und das Entfallen unveränderter
Raycasts belegen die zugrunde liegende Optimierung unabhängig von der Hostlast.

## Reale, bezahlte Turm-Rush-Matrix

Verglichen wird der Campaign Commander aus `240f665` mit dem eingefrorenen
Abschlussstand. Karte 4, Seeds 2026 und 2027, 20 Hz, maximal 900 Spielsekunden.
Beide Seiten starten unverändert mit 950 Credits und ihren regulären Starteinheiten.

Der identische blaue Gegner baut früh vorgezogene Geschützstellungen im tatsächlich
erforschten Frontbereich, danach Kaserne und regulär bezahlte Verteidiger. Er nutzt
öffentliche Sektorkontrolle zur Orientierung, keine versteckten roten HQ-Positionen.
Es werden keine Einheiten, Gebäude, Credits, Sicht oder Besitzrechte injiziert.
Alle geforderten Türme werden tatsächlich fertiggestellt: ein Turm nach 15 s,
drei nach 42 s, sechs nach 78 s — in beiden Versionen und beiden Seeds.
Die sechs Türme kosten regulär 1.050 Credits und werden aus Anfangsgeld plus
gewöhnlichem Einkommen finanziert. Ein eigener Test prüft jeden Kaufabzug und die
sechs tatsächlich fertiggestellten Baustellen.

| Türme | Seed | Ergebnis alt → neu | Zeit alt → neu | Eigene Verluste alt → neu | Turmschaden alt → neu |
|---:|---:|---|---:|---:|---:|
| 1 | 2026 | Sieg → Sieg | 630,45 → 735,80 s | 10 → 17 | 1.010 → 486 |
| 1 | 2027 | Sieg → Sieg | 359,90 → 347,15 s | 8 → 3 | 200 → 220 |
| 3 | 2026 | Sieg → Sieg | 822,20 → 485,90 s | 19 → 3 | 1.844 → 1.250 |
| 3 | 2027 | Sieg → Sieg | 477,65 → 385,30 s | 6 → 5 | 190 → 136 |
| 6 | 2026 | Timeout → Sieg | ≥900 → 469,70 s | 15 → 6 | 3.890 → 700 |
| 6 | 2027 | Sieg → Sieg | 728,35 → 476,60 s | 14 → 10 | 2.534 → 336 |

Ergebnis: **5/6 → 6/6 tatsächliche terminale Siege**, Gesamtverluste **72 → 44**
und tatsächlich zugefügter Turmschaden **9.668 → 3.128**. Der neue Stand entdeckt,
beschädigt und zerstört in allen sechs Partien das gegnerische HQ und beendet die
Partie. Ein Timeout wird weder als Sieg noch als Niederlage ausgegeben.

`immediateResponses` in den Rohdaten zählt beobachtete neue Rückzugsbefehle nach
einem Treffer, höchstens eine erste Reaktion pro Einheit; reine bereits bestehende
Marschbefehle werden nicht als neue Reaktion gezählt. Das ist keine vollständige
Statistik aller durch Gruppenbefehle bereits geschützten Einheiten. Die feste
Reaktionsfrist wird daher zusätzlich direkt durch echte Treffer im Mechaniktest
geprüft, einschließlich Salvenzusammenfassung und Makro-Übersteuerungsschutz.

Alle sechs Anfangswelt-Hashes stimmen paarweise überein. Der Benchmark prüft
außerdem identische Katalog-/Preiswerte. Gegnerquelle und gemessene TypeScript-
Dateien sind in den Rohdaten mit SHA256 dokumentiert.

## Bisherige Siegfähigkeit und Grenzen

Auch der unveränderte bisherige Verteidiger aus `benchmark-ai-opponent.mjs` wurde
unter identischen Anfangsbedingungen auf allen drei aktuellen Kartengrößen mit
beiden Seeds geprüft:

| Karte | Seed | Siegzeit alt → neu | Eigene Verluste alt → neu |
|---|---:|---:|---:|
| Klein | 2026 | 399,70 → 440,10 s | 9 → 8 |
| Klein | 2027 | 352,75 → 397,70 s | 7 → 10 |
| Mittel | 2026 | 471,10 → 311,85 s | 10 → 3 |
| Mittel | 2027 | 704,30 → 592,75 s | 18 → 7 |
| Groß | 2026 | 767,90 → 799,15 s | 31 → 8 |
| Groß | 2027 | 486,40 → 381,70 s | 7 → 3 |

Beide Versionen gewinnen **6/6**. Die mittlere Dauer sinkt von 530,36 auf 487,21 s,
die Gesamtverluste von 82 auf 39. Auch hier stimmen die sechs Anfangswelt-Hashes
und der bisherige Defender-Hash überein.

Die neue KI ist nicht in jedem Match besser: Besonders der einzelne Turm im
Seed 2026 führt weiterhin zu einer längeren Partie mit höheren Gesamtverlusten,
obwohl weniger Schaden vom Turm selbst stammt. Auch kleine Karten enden etwas
später. Die Stärkeschätzung bleibt eine Heuristik, kein vollständiger
Gefechtssimulator. Zwei Seeds pro Szenario belegen reproduzierbares Verhalten,
keine allgemeine Überlegenheit gegen Menschen oder beliebige Karten.

In der Entwicklung wurden vorsichtige Varianten verworfen, die auf kleinen
Karten zu lange sammelten. Die Tabellen mischen keine Bestwerte verschiedener
Implementierungen: sämtliche neuen Abschlusswerte stammen aus derselben
Quellkopie, deren Hashes mit dem Workspace abgeglichen wurden.

## Prüfungen, Dateien und Reproduktion

- **617/618 Gesamttests bestanden.** Der einzige Fehler ist der unveränderte,
  bereits auf dem Ausgangsbranch bestätigte Legacy-Test
  `reborn-ai-pressure.test.mjs`, Karte 2/Seed 2026, kein Schuss innerhalb 300 s.
  Dieser Test bleibt aktiv; kein Test wurde übersprungen.
- **16 neue Tests** prüfen Beschussreaktion im selben Tick, versteckte Gegnerdaten,
  Rückzugsschutz, Salven, Stärkeentscheidungen, Wiederholsperren, Save-Migration,
  überlappende Geschütze, exklusive/stabile Verbände, Sichtparität und echte bezahlte
  Sechs-Turm-Konstruktion.
- **13/13 Browserprüfungen bestanden**, darunter Kampf, Transport, Produktion,
  Bau/Reparatur, Legacy-Loads und dauerhafte KI-Erinnerungen.
- Build und `git diff --check` bestanden. Keine neuen Grafikassets oder UI-Änderungen.

Die Rohdaten stehen unter
[`benchmarks/petra-threat-response-20261026`](benchmarks/petra-threat-response-20261026).

```sh
npm run build
node scripts/benchmark-tower-rush.mjs --before /absolute/reference/dist/src/reborn/simulation.js --towers 1,3,6 --seeds 2026,2027 --seconds 900 --output /tmp/tower-rush.json
node scripts/benchmark-reborn-ai.mjs --maps 3,4,5 --seeds 2026,2027 --seconds 900 --modes director --output /tmp/campaigns.json
```

Die Referenz wird aus einer getrennten Quellkopie von `240f665` mit TypeScript
kompiliert. Für die Kampagnenreferenz denselben zweiten Aufruf mit
`ATLAS_SIM_MODULE=/absolute/reference/dist/src/reborn/simulation.js` ausführen.
`--only before` beziehungsweise `--only after` ermöglicht getrennte Durchläufe;
beim Zusammenführen müssen die paarweisen Anfangswelt-Hashes übereinstimmen.
