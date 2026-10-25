# Campaign Commander — 25.10.2026

Ausgangspunkt: `17614f4` auf `feat/reborn-ai-director-20261025`. Umsetzung auf
`feat/reborn-campaign-commander-20261025`. UI, Grafik, Einheitenwerte, Preise,
Startressourcen, Siegbedingungen und der bezahlte Benchmark-Verteidiger bleiben unverändert.

## Befund und Umsetzung

Die bisher dokumentierten 300 Sekunden waren zu kurz: Der alte Director gewinnt
in den anschließenden vollständigen 900-Sekunden-Vergleichen bereits 8/8 Partien.
Ein fehlender Sieg im kurzen Lauf war kein Beleg dafür, dass er niemals gewinnt.

Die tatsächlichen Probleme waren ungerichtete Aufklärung ohne Fog-Ziele,
Gebäudeziele ausschließlich in noch nicht eroberten Nachbarsektoren, übersehene
neue Gebäude während laufender Angriffe, Entfernung statt Gebäudeschaden als
Belagerungsfortschritt und Produktionsbudgets, die Luftwaffe beziehungsweise
schwere Unterstützung durch billige Ersatzkäufe verdrängten.

- `campaign-commander.ts`: deterministischer strategischer Planer mit Opening,
  Expansion, Buildup, Offensive, Siege, Endgame und Emergency Defense. Gespeicherte
  Missionen bleiben bestehen, bis Aufklärung, Zielerfüllung, konkrete neue
  Bedrohungen oder fehlender Fortschritt eine Änderung begründen. Ein HQ in einem
  bereits eigenen Sektor bleibt ein Ziel. Bekannte deckende Türme unterbrechen
  blockierte Eroberungs-/Gebäudeaufträge.
- Intelligence: unabhängige, gespeicherte Scout-Aufträge anhand echter Sicht und
  Erkundungszellen; Priorität für unbekanntes gegnerisches Gebiet und erneute
  Erkundung veralteter Informationen. Rover übernehmen frühe Aufklärung,
  Transporthelikopter später größere Bereiche. Ziele stammen aus Gebäudememories;
  lebende Gegner werden nur mit tatsächlicher Sicht ausgewertet.
- `director-production.ts`: bezahlte Produktionsplanung mit Sparzielen,
  Rollenquoten, Ersatz für Bauarbeiter, schwere Infanterie und Sanitäter sowie
  Budgets für Gunship und Aufklärungsheli. Mehrere fertige Produzenten können im
  selben Puls kaufen; bezahlte Warteschlangen zählen bereits zum Sollbestand.
  Alle Bauten und Käufe benutzen unverändert `Simulation.build/recruit`.
- Taktik/Logistik: beständige Befehle trotz versetzter Formations-/Gebäudeziele,
  Verstärkung während des Gefechts, gedeckte Artilleriebelagerung, geschützte
  Reparaturbefehle und Rückkehr reparierter Fahrzeuge. Sanitäter werden nicht
  von einem zur Reparatur zurückfahrenden Fahrzeug aus der Front gezogen.
  Ingenieure verfolgen vollständig reparierte Fahrzeuge nicht weiter ins Gefecht.
- Mechanische Korrekturen gelten für den modernen Director: Attack-Move setzt nach
  ausgeschöpfter kurzer Verfolgung die Mission fort; ein Gebäudebefehl behält im
  Nebel ausschließlich seine eigene Erinnerung. Feuern erfordert weiterhin Sicht.
- Lufttransport reserviert seine Passagiere vor der Verteilung der Kampfgruppen
  und wird nur bei einem berechneten Reisezeitvorteil gestartet. Bei gescheiterter
  Landung oder abgelaufener Abholung/Lieferung werden vorhandene Passagiere über
  reguläre Transportbefehle zu eigenem Boden zurückgeführt.

Die Erweiterungen sind optionale, validierte Save-Felder. Alte Saves ohne Commander
bleiben lesbar. Karten 0–2 und der interne `baseline`-Modus behalten ihren bisherigen
Planer. Der moderne Commander benötigt weder Qwen noch Netzwerkzugriff.

## Vollständige, bezahlte Partien

Verglichen wird **alter Director aus Commit 17614f4 gegen neuen Director**,
beide mit `mode=director`. Der interne Schalter `baseline` ist eine ältere Doktrin
und wäre hierfür kein Commit-A/B-Vergleich.

Je Match: 950 Startcredits für beide Seiten, 20 Hz, maximal 900 Spielsekunden,
identischer aktiver Verteidiger aus `benchmark-ai-opponent.mjs`. Keine freien
Einheiten, Ressourcenboni, gesenkten Verteidigungswerte oder vorab offen gelegten
Gegnerpositionen. Sieg bedeutet den tatsächlichen terminalen Zustand `defeat`
(Spielerperspektive: Rot hat Blau vollständig besiegt), nicht lediglich HQ-Schaden.

`fairness.json` bestätigt identische Anfangswelten, Kataloge und Defender-Hashes
für alle acht Paare. Die ältere Original-Primärdatei benutzt noch einen Save-Hash;
die unabhängig nachgerechneten Welt-Hashes in `fairness.json` sind maßgeblich.
Seeds 731/9109 sind zusätzliche Validierungsseeds; sie wurden während der Prüfung
mehrfach benutzt und werden deshalb nicht als strikt blinde Holdouts bezeichnet.

| Karte | Seed | Siegzeit alt → neu | HQ erstmals gesehen alt → neu | Verluste alt → neu |
|---|---:|---:|---:|---:|
| Mittel | 2026 | 568,80 → 471,10 s | 434,40 → 123,60 s | 25 → 10 |
| Mittel | 2027 | 434,15 → 704,30 s | 305,25 → 327,00 s | 8 → 18 |
| Mittel | 731 | 599,55 → 602,80 s | 399,20 → 303,25 s | 30 → 14 |
| Mittel | 9109 | 590,50 → 634,50 s | 331,75 → 123,00 s | 29 → 14 |
| Groß | 2026 | 512,85 → 767,90 s | 346,75 → 155,15 s | 19 → 31 |
| Groß | 2027 | 507,25 → 486,40 s | 456,05 → 273,50 s | 23 → 7 |
| Groß | 731 | 697,15 → 539,00 s | 501,35 → 385,30 s | 44 → 13 |
| Groß | 9109 | 696,35 → 498,80 s | 643,95 → 309,35 s | 38 → 5 |

Beide Versionen gewinnen 8/8. Alle acht gegnerischen HQs werden jeweils durch echte
Aufklärung entdeckt, mit 1.200 Schaden zerstört und die Partie abgeschlossen.
Neue Mittelwerte: HQ-Sichtung **250,0 statt 427,3 s**, Verluste **14 statt 27**,
Siegzeit **588,1 statt 575,8 s**. Die Verbesserung besteht in Aufklärung,
Überlebensfähigkeit und kombiniertem Armeeeinsatz, nicht in einer höheren
nachgewiesenen Siegquote oder überall schnelleren Siegen.

Tatsächliche neue Fertigstellungen über acht Matches: 14 Tanks, 12 Artillerien,
28 schwere Infanteristen, 19 Sanitäter, 13 Gunships und 7 Transporthelikopter.
Alt: 10 Tanks, 9 Artillerien und keine Fluggeräte. Reparierte Fahrzeuge kehren
nachweislich zurück und feuern wieder (15 verschiedene Fahrzeuge über acht neue
Matches). Die echten Überlappungen mehrerer Produktionsqueues betragen im Mittel
10,9 s pro Match. Dreifachproduktion ist im regulären Spiel nicht nachgewiesen;
der bezahlte Drei-Produzenten-Mechaniktest besteht.

Kleine Karte, unabhängiger Seed 31415: beide gewinnen; alt 417,0 s/19 Verluste,
neu 526,65 s/3 Verluste, HQ-Sichtung neu 153,4 s und 1.200 HQ-Schaden.
Damit sind vollständige Siege auf allen drei aktuellen Kartengrößen belegt.

## Grenzen, Iterationen und Performance

Der erste Umbau war schlechter und wurde anhand kompletter Spiele korrigiert.
Eine spätere Änderung der Rückzugsberechnung brachte nur 6/8 Siege bis 900 s und
wurde verworfen. Die Tabellen zeigen den ausgewählten 8/8-Stand, keine Mischung
aus jeweils besten Einzelergebnissen. Danach wurden ausschließlich tote IDs aus
der gespeicherten Verbandsliste entfernt und der isolierte Transport-Fehlerpfad
abgesichert. Die komplette Matrix wurde nach diesen Abschlusskorrekturen nicht
noch einmal wiederholt; deren Mechanik prüfen die gezielten Abschlusstests.
`measured-source-hashes.json` bezeichnet ausdrücklich die gemessene Quellkopie.

Offen bleiben langsamere einzelne Siege, zeitweise Belagerungsstalls, weniger
Expansion im großen Seed 2026, hoher Produktionsleerlauf und fehlender Nachweis
von Bombern in diesen Partien. Die Fabrik ist im neuen Vergleich 86,7 %, das
Flugfeld 87,5 % seiner verfügbaren Zeit leer. Geschützter Budgetaufbau und endliche
Rollenziele erklären einen Teil davon; kontinuierliche Produktion ist nicht erreicht.
Der Verteidiger ist ein reproduzierbares bezahltes Skript, kein adaptiver Mensch
oder symmetrischer KI-Gegner.

Node-Profiler: mittlerer KI-Puls 5,04 → 1,91 ms, höchste KI-Spitze
55,9 → 66,9 ms; mittlerer Simulationstick 7,33 → 7,85 ms. Sichtberechnung bleibt
der dominante Aufwand. Die Matches liefen teilweise parallel; Walltime-Spitzen
sind deshalb kein kontrollierter FPS-Vergleich. Eine pauschale Verbesserung der
Framebelastung oder vollständige Performance-Regressionsfreiheit ist nicht belegt.
Rendering/FPS wurden durch diese Node-Läufe nicht gemessen.

## Prüfungen und Reproduktion

- Gesamtsuite: 601/602 bestanden. Ein unveränderter Vorfehler:
  `reborn-ai-pressure.test.mjs`, Legacy-Karte 2/Seed 2026 schießt innerhalb von
  300 s nicht. Derselbe Fehler wurde auf unverändertem Commit 17614f4 isoliert
  reproduziert; der Test bleibt aktiv und unverändert.
- Abschluss: **53/53 gezielte Commander-, Economy-, Kampf-, Transport- und
  Benchmarktests bestanden**, einschließlich echter Rückführung nach gescheiterter
  Landung, Save-Roundtrip, unbekannter Gegnerdaten, bezahlter Luftproduktion,
  Raketen nach echter Neuaufklärung und Reparaturrückkehr.
- Browser: **13/13 bestanden**, darunter Produktion, Transport, Raketen,
  Sanitäter, Bau/Reparatur, Legacy-Loads und dauerhaft gespeicherte KI-Erinnerungen.
- Build und `git diff --check` bestanden.

Einige historische Tests widersprachen aktuellen Regeln. Sie wurden präzisiert:
Attack-Move statt kampflosen Move prüfen; neue mittlere Karte nach Neustart hat
8 Sektoren; kleine Legacy-Angriffe dürfen nach begrenzter Wartezeit drei Kämpfer
haben; ein Turm darf regulär durch kombinierte Kräfte sterben, bevor die Artillerie
feuert; Luftabwehrkäufe werden gegen die zum Kaufzeitpunkt sichtbare Bedrohung
geprüft. Die korrigierten Boden-/Luft-/Raketenprüfungen bestehen auch auf der
unveränderten Referenz. Kein Test wurde übersprungen und keine Siegbedingung geändert.

```sh
npm run build
node scripts/benchmark-reborn-ai.mjs --maps 4,5 --seeds 2026,2027 --seconds 900 --modes director --output /tmp/commander-primary.json
node scripts/benchmark-reborn-ai.mjs --maps 4,5 --seeds 731,9109 --seconds 900 --modes director --output /tmp/commander-validation.json
node scripts/benchmark-reborn-ai.mjs --maps 3 --seeds 31415 --seconds 900 --modes director --output /tmp/commander-small.json
```

Für Commit-A/B eine getrennte Quellkopie von 17614f4 mit TypeScript kompilieren und
`ATLAS_SIM_MODULE=/absolute/reference/dist/src/reborn/simulation.js` vor denselben
Benchmarkaufruf setzen. Das Benchmarkskript lädt auch den passenden Profiler/Katalog;
der Verteidiger bleibt derselbe. Rohdaten und Zusammenfassung stehen in
[`benchmarks/campaign-commander-20261025`](benchmarks/campaign-commander-20261025).
