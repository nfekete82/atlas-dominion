# RTS-KI: Langzeitstabilität — 13.10.2026

## Ergebnis und Abnahme

**18/18 Vergleichsfälle bestanden; 337/337 Tests bestanden; 6/6 unabhängige Wiederholungen einschließlich JSON-Save/Load bei Tick 500 bestanden.**
Die Abnahme bezieht sich auf die Folgeänderung gegenüber dem Stand der ersten Optimierung zu Beginn dieser Ausführung. Der historische Originalstand wird zusätzlich vollständig gemessen und unten getrennt ausgewiesen. Eine Überlegenheit gegenüber dem historischen Original in jeder einzelnen Kennzahl wird ausdrücklich nicht behauptet.

Alle Änderungen bleiben auf `feat/rts-ai-pressure-breakout-20261013` uncommittet. Kein Push, Merge oder Deployment. Die bereits vorhandene unversionierte `package-lock.json` bleibt unangetastet.

## Vergleichsstände und Verfahren

- `original`: ursprüngliche Revision `cc55f94fed1b3d3ca2f2569e50b0287b98f36bfe`.
- `baseline`: erste Optimierung, wie sie zu Beginn dieser Folgeausführung im Workspace vorlag. Reproduzierbar durch `first-optimization.patch` auf der Originalrevision.
- `candidate`: abschließend getesteter Workspace; Hashes der kompilierten Engine-Dateien stehen in `manifest.json`.

Seeds: **20261013, 20261024, 221041**, jeweils 8 und 49 Gegner, RTS, balanced, DE, ohne menschliche Befehle. Alle drei Stände wurden in **18 separaten, nacheinander ausgeführten 1.000-Tick-Prozessen** gemessen; jeder Prozess erfasst die tatsächlichen Zustände bei 360, 500 und 1.000 Ticks. Keine Tests oder weiteren Benchmarks liefen gleichzeitig.
Jeder Prozess wärmt vorab eine separate Spielinstanz 360 Ticks auf und gibt sie anschließend zur Garbage Collection frei. Der gemessene Spielzustand beginnt danach neu. So werden JIT-Anlaufkosten nicht mit der strategischen Langzeitentwicklung verwechselt. Quantile: sortierte Tickzeiten mit Index `floor(n * p)` für Median, p95 und p99. Alle Zeitwerte unten sind Millisekunden.
Observer-Modus setzt einen beendeten Status vor dem nächsten Schritt wieder auf playing, um auch nach dem Ausscheiden des passiven Menschen echte KI-Ticks zu messen. Jeder Schritt prüft `game.tick === erwarteterTick`; leere Aufrufe nach Spielende werden niemals als schnelle Simulation gewertet. Ein früher Spielausgang steht als `firstTerminal` in den Rohdaten.

**Verluste** in den Tabellen sind physisch bestimmt: anfängliche KI-Soldaten plus tatsächlich bezahlte Rekruten minus verbliebene KI-Soldaten in allen Beständen. Zusätzlich werden die bisherigen Verlustzähler gespeichert. Im Kandidaten stimmen beide überein; die vollständige Bilanz aller Fraktionen hat in sämtlichen geprüften Ticks keine Verletzung der Toleranz `1e-6`.
Die historischen Zähler hatten Buchungsfehler: Besetzung konnte reale stationierte Grenzwachen löschen, ohne sie als Gefallene zu buchen; auch unter einem Soldaten liegende Restbestände konnten beim Entfernen verschwinden. Deshalb weichen die neuen physischen Baseline-Zahlen von den alten Berichtszählern ab. Die Rohdaten behalten beide Werte.

Die Europakarte und die Länderaufstellung sind fest. Drei Seeds sind reproduzierbare Konfigurationen, keine drei unabhängigen Kartenstichproben; identische aggregierte Kandidatenwerte über Seeds sind entsprechend zu lesen.

## Vorab festgelegte Kriterien

Gegenüber `baseline`: mindestens 95 % des Gebietsgewinns bei 360/500 Ticks, mindestens 100 % bei 1.000 Ticks, keine höheren physischen Verluste, Median/p95/p99 jeweils höchstens 115 % des Vergleichswerts sowie null illegale Bewegungen und null Bilanzverletzungen. Die 15-%-Zeitbandbreite wurde vor der Messmatrix festgelegt und nach dem ersten Fehlschlag nicht geändert. Jeder Messwert und jede Abweichung bleiben sichtbar.

## Vergleich pro Seed

Notation: **erste Optimierung → Kandidat**. Gebietsgewinn ist die Nettoänderung der gesamten KI-Fläche.

### 9 Länder

| Seed | Ticks | Gebietsgewinn | Physische Verluste | Median ms | p95 ms | p99 ms | Ergebnis |
|---:|---:|---:|---:|---:|---:|---:|---|
| 20261013 | 360 | 19626 → 19623 | 73.45 → 0.55 | 3.75 → 2.88 | 7.81 → 6.04 | 10.43 → 7.83 | bestanden |
| 20261013 | 500 | 29386 → 29138 | 760.53 → 62.15 | 4.98 → 3.42 | 11.70 → 8.49 | 14.72 → 13.55 | bestanden |
| 20261013 | 1000 | 45784 → 46907 | 4981.12 → 1038.10 | 8.45 → 5.85 | 14.85 → 11.33 | 18.71 → 14.23 | bestanden |
| 20261024 | 360 | 19626 → 19623 | 73.45 → 0.55 | 3.74 → 2.75 | 8.46 → 5.35 | 9.88 → 6.48 | bestanden |
| 20261024 | 500 | 29386 → 29138 | 760.53 → 62.15 | 4.73 → 3.24 | 10.20 → 8.24 | 12.79 → 11.74 | bestanden |
| 20261024 | 1000 | 45784 → 46907 | 4981.12 → 1038.10 | 7.94 → 5.47 | 13.66 → 10.35 | 17.74 → 14.14 | bestanden |
| 221041 | 360 | 19626 → 19623 | 73.45 → 0.55 | 2.65 → 2.00 | 5.60 → 3.83 | 6.59 → 4.75 | bestanden |
| 221041 | 500 | 29386 → 29138 | 760.53 → 62.15 | 3.38 → 2.26 | 7.94 → 5.38 | 9.20 → 8.89 | bestanden |
| 221041 | 1000 | 45784 → 46907 | 4981.12 → 1038.10 | 6.08 → 4.08 | 9.89 → 7.51 | 11.82 → 9.46 | bestanden |

### 50 Länder

| Seed | Ticks | Gebietsgewinn | Physische Verluste | Median ms | p95 ms | p99 ms | Ergebnis |
|---:|---:|---:|---:|---:|---:|---:|---|
| 20261013 | 360 | 35724 → 34660 | 4154.47 → 2392.27 | 7.91 → 4.53 | 14.09 → 9.60 | 16.35 → 11.86 | bestanden |
| 20261013 | 500 | 42654 → 42797 | 7272.07 → 3808.17 | 9.21 → 5.35 | 17.76 → 10.46 | 34.41 → 13.29 | bestanden |
| 20261013 | 1000 | 51389 → 52289 | 25372.08 → 19154.52 | 15.47 → 10.14 | 23.73 → 18.75 | 34.41 → 21.43 | bestanden |
| 20261024 | 360 | 35724 → 34660 | 4154.47 → 2392.27 | 8.51 → 5.19 | 15.91 → 11.73 | 20.12 → 14.40 | bestanden |
| 20261024 | 500 | 42654 → 42797 | 7272.07 → 3808.17 | 10.32 → 6.14 | 21.24 → 13.32 | 41.84 → 17.78 | bestanden |
| 20261024 | 1000 | 51389 → 52289 | 24444.64 → 19154.52 | 17.20 → 11.87 | 28.25 → 23.28 | 42.23 → 27.76 | bestanden |
| 221041 | 360 | 35724 → 34660 | 4154.47 → 2392.27 | 9.51 → 6.03 | 17.22 → 12.67 | 22.97 → 16.07 | bestanden |
| 221041 | 500 | 42654 → 42797 | 7272.07 → 3808.17 | 11.23 → 7.18 | 24.53 → 14.85 | 41.56 → 19.21 | bestanden |
| 221041 | 1000 | 51389 → 52289 | 24444.64 → 19154.52 | 18.80 → 12.79 | 33.36 → 24.42 | 41.60 → 29.52 | bestanden |

## Ab wann beginnt die ursprüngliche Langzeitregression?

Für Seed 20261013 überholen die **physischen** kumulierten Verluste der ersten Optimierung den Originalstand erstmals bei **Tick 477**; ein Abstand von mehr als 20 % beziehungsweise mindestens 10 Soldaten beginnt bei **Tick 484**. Der alte, unvollständige Verlustzähler zeigte den ersten Überholpunkt bei Tick 476.
Die Rechenzeit steigt erstmals im Abschnitt **301–400** sichtbar: Median 7,13 statt 5,94 ms. Im Abschnitt **401–500** liegt sie mit 9,27 statt 5,06 ms klar und anschließend dauerhaft höher. Diese Aussagen stammen aus den finalen seriellen Rohdaten, nicht aus subjektiver Beobachtung.

Die folgende Zeitreihe zeigt physisch kumulierte KI-Verluste und den Median innerhalb des jeweiligen 100-Tick-Abschnitts.

| Abschnitt | Verluste Original | Verluste erste Optimierung | Verluste Kandidat | Median Original | Median erste Optimierung | Median Kandidat |
|---|---:|---:|---:|---:|---:|---:|
| 1–100 | 0.00 | 0.00 | 0.00 | 4.08 | 3.08 | 2.45 |
| 101–200 | 21.10 | 0.00 | 0.00 | 4.90 | 3.18 | 2.49 |
| 201–300 | 290.75 | 0.00 | 0.00 | 6.88 | 3.70 | 3.32 |
| 301–400 | 447.56 | 156.04 | 35.20 | 5.94 | 7.13 | 5.84 |
| 401–500 | 458.76 | 760.53 | 62.15 | 5.06 | 9.27 | 7.21 |
| 501–600 | 596.28 | 1584.36 | 93.90 | 4.73 | 10.17 | 5.98 |
| 601–700 | 731.39 | 2417.90 | 367.06 | 5.58 | 8.63 | 6.68 |
| 701–800 | 906.54 | 3113.73 | 512.57 | 6.48 | 13.56 | 6.90 |
| 801–900 | 1195.93 | 3832.85 | 687.57 | 6.04 | 11.39 | 7.35 |
| 901–1000 | 1274.21 | 4981.12 | 1038.10 | 6.30 | 11.20 | 7.60 |

## Ursachen getrennt und behobene Algorithmen

| Ursache | Nachweis | Änderung |
|---|---|---|
| Größere reale Armeen | Im Abschnitt 401–500 hatte die erste Optimierung im Mittel rund 3.628 Feldsoldaten gegenüber 1.257 im Original. Die Rekrutierung und Stärke der 100er-Gruppen bleiben erhalten. | Verluste werden durch bessere Einsatzentscheidungen begrenzt, nicht durch eine globale Verringerung der Armee. |
| Grenzkontakte, Turmfeuer und Attrition | Direkte Kontaktpaare allein erklären die Verluste nicht. Die getrennten Phasenzähler zeigen zusätzliche Besetzungs-/Grenzverluste sowie Beschuss auf Marsch- und Haltepositionen. | Neutralrouten meiden reale feindliche Kontakt- und Turmfelder. Kostspielige Kampagnen erhalten einen Verlustetat und legale Rückzüge über mehrere eigene Zellen. Wertvolle Infrastruktur hat einen höheren Etat. |
| Wiederholte und nicht lohnende Ziele | Die erste Optimierung stieg im Abschnitt 901–1000 auf 127 wiederholte API-Zielanfragen binnen 16 Ticks. Länder griffen außerdem vor der Untersuchung neutraler Seeausgänge wieder an. | Zielbezogene Neubewertungssperre, Ziele nur aus dem eigenen erreichbaren Landkomponenten, fortgesetzte begrenzte Küstensuche statt immer derselben erfolglosen Präfixsuche. |
| Pathfinding | Lange eigene Märsche liefen zuvor wiederholt durch breite Suchräume. Veraltete Ziele konnten weitere Suchen auslösen. | Zielgerichtete achtgerichtete Suche mit legalen Ecken, wiederverwendete und mitgespeicherte Marschrouten, Replanung nur bei tatsächlicher Blockade. KI-Kampagnensuchen haben ein festes Knotenbudget statt eines Zeitlimits. |
| Strategische Zielberechnung | Geometrie wurde auch ohne freie Armeen berechnet; zweite Neutralringe und komplette Verteidigerlisten wurden wiederholt ausgewertet. | Sofortige Verteidigung bleibt aktiv. Vollständige Strategie nutzt den Vier-Tick-Takt. Exakte obere Schranken vermeiden unnötige zweite-Ring-Berechnungen; Verteidigerinformationen werden einmal gesammelt. |
| Ineffiziente Schleifen und Speicher | Der erste formale Kandidat scheiterte noch an p99. Profilierung zeigte redundante vollständige Küsten-/Grenzscans und wiederholte Bedrohungsringe. | Statische navigierbare Küsten, vorhandener gepflegter Grenzindex, separate kompakte Gebäudecode-Suche, Baustellensuche nur bei tatsächlich fehlender Kaserne, gemeinsam genutzte Bedrohungsringe und Komponenten-Puffer. |
| Naval-Suche und Cache | Mehrere Länder verdrängten ihre Wasserfelder gegenseitig; veränderte Küsten erzeugten veraltete Felder derselben Nation. | Begrenzter LRU-Cache für acht aktuelle Länderfelder; ersetzt die vorige Küstensignatur desselben Landes. Landlose Suchfelder werden gemeinsam benutzt. Landungen werden bei neu auftretender unverhältnismäßiger Verteidigung abgebrochen. |

Die Kontaktzahl in den Rohdaten ist ein Indikator sichtbarer Truppenpaare am Tickende, kein vollständiges Schadensprotokoll. Wiederholungszähler betreffen `orderSquadAttack`; direkte Marineplanung wird separat durch `maritimeRoute`-Aufrufe erfasst. Die Laufzeiten der verschachtelten Methoden sind inklusive und dürfen nicht als disjunkte Gesamtsummen addiert werden.

## Korrektheit, Tests und verworfene Ergebnisse

- **337 Tests bestanden**, einschließlich aller vorhandenen Classic-/RTS-Prüfungen und neuer Tests zu Zielwiederholung, Verlustetats, legalem Rückzug, begrenzter Suche, Route-Reuse, Grenzindex-Reuse, Cache-Speichergrenzen, echter Verlustbuchung, einmaliger Bewegung und gespeicherten Truppenkennungen.
- Eine besiegte frühere Arrayposition kann keine zweite Bewegung desselben Angreifers mehr auslösen: jede Formation wird genau einmal aus einer stabilen Tickliste verarbeitet.
- Fractionale besiegte Restbestände und tatsächlich entfernte stationierte Grenzwachen werden exakt einmal gebucht. Kein Bonus, keine kostenlosen Rekruten und kein Ersatz verlorener Soldaten.
- Eingeschiffte Gruppen kämpfen nicht vom bloßen Hafen-Anzeigemarker aus an Land. Einheiten, die erst zum Hafen marschieren, bleiben verwundbar.
- **6 unabhängige Wiederholungen** über jeweils 1.000 Ticks: alle drei Seeds mit 9 und 50 Ländern. Jeder echte Positionswechsel wird am Schreibzeitpunkt auf Schrittweite, aktuelle Eckeneigentümer, tatsächliche Seeroute und höchstens eine Bewegung pro Tick geprüft.
- Bei Tick 500 erfolgt eine echte JSON-Serialisierung und ein Neuladen; die Fortsetzung wird vollständig und exakt mit einer ununterbrochenen Referenz verglichen. Zusätzlich stimmen die Rohhashes der ununterbrochenen Wiederholung mit der Messmatrix überein.
- Optional neu auftauchende JSON-Eigenschaften können nach einem Reload eine andere Schlüsselreihenfolge haben. Der erste Replayprüfer verwechselte dies mit einem Zustandsfehler. Die abschließende Prüfung nutzt daher vollständige exakte Wertvergleiche und kanonische Hashes, ohne Felder oder Zahlen auszublenden. `replay-attempt-1.txt` bewahrt den ursprünglichen Fehlalarm.

Der erste vollständige Messversuch bestand nur **15/18** Fälle. p99 scheiterte bei 9 Ländern in den Fällen Seed 20261013/Tick 500, Seed 20261013/Tick 1000 und Seed 221041/Tick 500. Dieser Stand wurde nicht akzeptiert; Messwerte, Manifest und rekonstruierbarer Kandidatenpatch liegen in `attempt-1/`. Erst nach der Entfernung der redundanten Analysen wurde die komplette Matrix erneut gemessen.

Eine weitere gezielte Probe mit sicheren rückwärtigen Verteidigungsposten und einer gehaltenen Reserve wurde nicht übernommen. Bei 50 Ländern und Seed 20261013 verlor sie bis Tick 500 mehr Soldaten (3.813 statt 3.808) und gewann weniger Gebiet (41.970 statt 42.797) als der ausgewählte Kandidat. Die kleine spätere Verlustsenkung beseitigte die historische Lücke nicht. Beide Einzelversuche und ihre Patches liegen unter `exploratory/`; sie ersetzen keine vollständige Messmatrix.

## Historischer Originalstand: verbleibende Unterschiede

Mittelwerte über die drei Seeds, **historisches Original → Kandidat**. Die Tabelle weist die verbleibenden Unterschiede zum historischen Stand aus.

| Länder | Ticks | Gebietsgewinn | Physische Verluste | Median ms | p95 ms | p99 ms |
|---:|---:|---:|---:|---:|---:|---:|
| 9 | 360 | 13571 → 19623 | 429.97 → 0.55 | 5.17 → 2.55 | 8.38 → 5.07 | 10.35 → 6.35 |
| 9 | 500 | 15497 → 29138 | 476.10 → 62.15 | 5.05 → 2.98 | 8.98 → 7.37 | 11.12 → 11.39 |
| 9 | 1000 | 20019 → 46907 | 915.21 → 1038.10 | 5.03 → 5.13 | 8.78 → 9.73 | 11.12 → 12.61 |
| 50 | 360 | 24246 → 34660 | 5649.30 → 2392.27 | 12.57 → 5.25 | 19.07 → 11.33 | 22.57 → 14.11 |
| 50 | 500 | 26115 → 42797 | 6317.52 → 3808.17 | 12.49 → 6.22 | 18.65 → 12.88 | 22.71 → 16.76 |
| 50 | 1000 | 30086 → 52289 | 8341.33 → 19154.52 | 12.53 → 11.60 | 17.37 → 22.15 | 20.34 → 26.24 |

**Grenze:** Gegenüber der ursprünglichen, deutlich weniger aktiven Engine bleiben die absoluten 1.000-Tick-Verluste teilweise höher, besonders bei 50 Ländern. Dort sind auch die Verlustquote je Netto-Gebiet sowie p95/p99 gegenüber dem historischen Original schlechter. Diese Regression der gesamten ersten Optimierung gegenüber dem Original wird nicht als beseitigt ausgegeben. Die jetzige Folgeänderung reduziert sie gegenüber der ersten Optimierung deutlich, erhöht deren Langzeit-Gewinne und besteht sämtliche unverändert festgelegten Folge-Abnahmekriterien.
Die Messung ersetzt keine menschlichen Spieltests, keine variierenden Karten und keinen Beweis global optimaler Strategie. Sie zeigt reproduzierbar bessere Langzeitwerte des konkreten Folgepatches ohne wesentlichen Verlust der frühen Vorteile.

## Artefakte und Reproduktion

- `matrix.json`, `comparison.csv`, `summary.json`: sämtliche Vergleichswerte und Kriterien.
- `original-*.json`, `baseline-*.json`, `candidate-*.json`: Rohdaten mit Zeitabschnitten, Phasenkosten, realen Beständen, kumulierten Verlusten und Quantilen. Der erste 9-Länder-Seed enthält zusätzlich alle 1.000 Einzelticks.
- `manifest.json`: Node-/CPU-Angaben, Parameter und Engine-Hashes.
- `replay-verification.json`, `replay-verification.txt`: unabhängige Replay-, Bewegungs- und Bilanzprüfung.
- `full-tests.txt`: vollständige Testsuite.
- `attempt-1/`: vollständig aufbewahrter fehlgeschlagener Messversuch.

Die beiden Vergleichsstände aus der Originalrevision isoliert vorbereiten und die erste Optimierung aus dem gespeicherten Patch rekonstruieren:

```sh
mkdir -p /tmp/atlas-long-original /tmp/atlas-long-first
git archive cc55f94fed1b3d3ca2f2569e50b0287b98f36bfe | tar -x -C /tmp/atlas-long-original
cp -R /tmp/atlas-long-original/. /tmp/atlas-long-first/
(cd /tmp/atlas-long-first && git apply /Users/norbertfekete/Projects/atlas-dominion/docs/qa/rts-ai-long-term-20261013/first-optimization.patch)
./node_modules/.bin/tsc -p /tmp/atlas-long-original/tsconfig.json
./node_modules/.bin/tsc -p /tmp/atlas-long-first/tsconfig.json
npm test
node scripts/benchmark-rts-long-term.mjs docs/qa/rts-ai-long-term-rerun /tmp/atlas-long-original/dist/src/engine/game.js /tmp/atlas-long-first/dist/src/engine/game.js
node scripts/verify-rts-long-replay.mjs docs/qa/rts-ai-long-term-rerun
```

Die Befehle vom Projektverzeichnis aus ausführen. Zeitmessungen bleiben rechner- und lastabhängig; ein Wiederholungslauf muss deshalb seine eigenen Zeiten und Kriterien ausweisen.
