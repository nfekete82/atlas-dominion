# TITAN: kollidierte Fahrzeuge wieder an die Front bringen

Fortsetzung vom 26.10.2026 auf `feat/titan-siege-coordination-20261026`.
Unveränderte Referenz: **a877391**. Finale Implementierung: **c946b06**.
Die adaptive KI und der vorherige Vergleich gegen Threat Response `c9b87e2`
stehen im [ursprünglichen TITAN-Bericht](project-titan-20261026.md).
Die neuen Spiele vergleichen zwei echte TITAN-Commits, nicht den internen
`baseline`-Modus. Kein fremder oder übersetzter Petra-Quellcode wurde übernommen.

## Behobene Ursache

Im bekannten Entwicklungsfall Groß/Fortress/98251 steht die erste Artillerie
mit vollen 340 HP zwischen etwa 240 und 600 Sekunden bei
`(3095.0501807567116, 1556.7869575694258)` fest. Ein zweiter Artillerist bleibt
später auf dem Reparaturrückweg stehen. Bei 600 Sekunden besitzt RED zwar 21
Einheiten, aber fünf erfüllen Unterstützungsrollen, sieben erholen sich und nur
sehr wenig Kampfkraft erreicht den örtlichen Sammelradius. Die Bewertung
`reinforce` ist für den tatsächlich verfügbaren Verband richtig.

Die Wegglättung prüft lange Segmente bisher in Abständen von ungefähr sieben
Welteinheiten. Eine sehr kurze Berührung einer Fahrzeug-Clearanceprobe mit einer
Felskante fällt zwischen diese Abtastpunkte. Die Bewegung erkennt die reale
Kollision, verwirft den Pfad und erhält erneut dieselbe unbrauchbare Route.

Die finale Korrektur greift **erst nach einer wirklichen Bewegungskollision**.
Die betroffene Bodeneinheit erhält `exactPath=true`. Künftige Routen dieser
Einheit prüfen alle Rasterzellen entlang der Fahrzeugmitte und der bestehenden
acht Clearanceproben sowie die ganzen Segmente an runden Gebäudehindernissen.
A* prüft auch Kanten und zurückgegebene Glättung. Normale Missionswege und bisher
nicht kollidierte Einheiten verwenden weiterhin das ursprüngliche Verfahren.

Das gilt für beide Seiten auf modernen Karten ab Version 3 bei positiver
Boden-Clearance. Sicht, Trefferprüfung, Waffenwerte, Kollisionsradien, Ökonomie,
Gegnerpolicy, Legacy-Wege und Luftwege bleiben unverändert. Für RED stammen
Navigationshindernisse weiterhin aus eigenen Gebäuden und legalen Erinnerungen;
die Kollision verrät weder ID noch Position eines verborgenen Gebäudes.

`exactPath` ist ein optionales, validiertes Boolean im vorhandenen Unit-Save.
Alte Spielstände benötigen das Feld nicht. Der Zustand nach einer Kollision
bleibt beim Laden erhalten; Positionen, Befehle und Spielzustand werden im neuen
Fortsetzungstest verglichen. Nur der schon bisher beim Laden zurückgesetzte
transiente `repath`-Timer wird dabei normalisiert. Ungültige Feldwerte werden
abgelehnt.

## Verworfene Ansätze und ehrliche Validierungsfolge

Die erste Variante `0611d95` aktivierte die genaue Navigation allgemein und
priorisierte sichtbare Bauarbeiter beziehungsweise gegnerische Artillerie aus
sicherer Schussreichweite. Im bekannten Festungsfall senkte sie Verluste von 28
auf 5, gewann aber nicht. Ein zwischenzeitlicher Frontalangriffsversuch erhöhte
Verluste und Siegzeiten und wurde ebenfalls verworfen.

Anschließend wurde `0611d95` auf dem vorher unbenutzten Seed **154873** mit allen
neun Profilen und allen drei Karten vollständig validiert. Das Ergebnis war
**21/5/1 → 20/5/2** Siege/Niederlagen/Timeouts, Verluste **165 → 161**. Insbesondere
Groß/Fortress verschlechterte sich von Sieg 741,75 s / 3 Verlusten zu Timeout
900 s / 38 Verlusten. Diese Variante wurde deshalb **nicht als Endstand behalten**.
Die vollständigen schlechten Ergebnisse bleiben in `validation-rejected-*.json`.

Die finale Eingrenzung aktiviert genaue Navigation ausschließlich für tatsächlich
kollidierte Fahrzeuge. Die zusätzliche Belagerungs-Zielpriorisierung wurde
zurückgenommen. Seed 154873 ist seitdem ein bekannter Entwicklungsfall und wird
nicht erneut als blind bezeichnet.

| Groß/Fortress, bekannte Fälle | TITAN a877391 | Finale Kollisionskorrektur |
|---|---:|---:|
| 98251 | Timeout 900 s / 28 Verluste | **Sieg 699,90 s / 4 Verluste** |
| 154873 | Sieg 741,75 s / 3 Verluste | **Sieg 617,55 s / 3 Verluste** |

Die verbleibende Belagerungslogik ist dieselbe wie vor dieser Fortsetzung. Die
Verbesserung entsteht aus wieder ankommenden Fahrzeugen und Reparaturrückkehrern,
nicht aus aggressiveren Stärkeschätzungen oder zusätzlichen Ressourcen.

Nach Build und **648/648 Node-Tests** wurde der korrigierte Stand als `c946b06`
eingefroren. Für die neue Abschlussvalidierung wurde vorab Seed **640519**
festgelegt: erneut alle neun Profile, alle drei Kartengrößen und 900-s-Limit.
Keine Auswahl der besten Fälle und keine weitere Anpassung anhand dieses Seeds.
Die verworfene und die finale Validierung werden getrennt ausgewiesen.

## Methodik und Performance

Alle Paare verwenden denselben bezahlten Gegnercode, 950 Startcredits,
20-Hz-Simulation, identischen Einheiten-/Gebäudekatalog und identische Anfangswelt.
Controller dürfen nur eigene Einheiten, sichtbare Gegner, bekannte Gebäude und
öffentliche Sektoren verwenden. Der reine Beobachter darf vollständige Ergebnisse
messen und gibt dieses Wissen nicht an die Controller weiter. Nicht realisierte
Strategien werden ebenso behalten wie Niederlagen und Timeouts.

Die genaue Kantenprüfung wird nur für einen kostengünstigeren A*-Kandidaten
aufgerufen. Ein verworfener teurerer Kandidat verändert weder Kosten noch
Vorgänger noch Heap; die ausgelassenen geometrischen Prüfungen sind rein.
[Der reproduzierbare Prüfer](../scripts/benchmark-navigation-parity.mjs) zeigt
auf zwölf bekannten Wegen mit und ohne synthetisches Risikoband exakt identische
Wegpunkte einschließlich IEEE754-Bytehashes. Kantenprüfungen sinken von
806.581 auf 351.479 (**−56,4 %**). Das ist eine gemessene Aufrufreduktion für die
exakte Reparatursuche, keine pauschale FPS-Aussage. Zusätzlich wurden 30.000
Segmente einschließlich Rastergrenzen ohne Richtungsasymmetrie oder übersehene
dicht abgetastete Blockierung geprüft.

Node-Spielmessungen und echte Browser-Frames werden getrennt berichtet. Die
vollständigen Spielreihen liefen teilweise parallel; CPU-Spitzen daraus sind
Beobachtungen und kein kontrollierter Prozessormikrovergleich.

## Browser-Vorfehler

Die einmal zusätzlich ausgeführte vollständige Browser-Suite des ersten Standes
bestand **56/61** Prüfungen. Alle fünf auffälligen Fälle wurden auch gegen die
unveränderten `a877391`-Module wiederholt und scheiterten ebenfalls: drei
Legacy-Infanterie-/Kampffix­turen, eine Zufallskarten-Prüfung und eine Audio-/Menü-
Prüfung mit Chrome-/Display-Fehlern beziehungsweise Timeout. Diese Tests wurden
nicht gelöscht oder abgeschwächt. Die finale Fortsetzung meldet die relevanten
modernen Browserprüfungen separat; eine vollständig grüne 61er-Suite wird nicht
behauptet.

## Reproduktion und Daten

Alle Entwicklungsvarianten, verworfenen Validierungsfälle und Abschlussdaten
liegen in [diesem Datenverzeichnis](benchmarks/titan-siege-20261026/).
Quell-/Modulhashes identifizieren die separat kompilierten Archive.

```sh
npm run build
node --test tests/*.test.mjs
node scripts/benchmark-titan.mjs \
  --before /tmp/titan-before/dist/src/reborn/simulation.js \
  --after /tmp/titan-after/dist/src/reborn/simulation.js \
  --profiles tower1,tower3,tower6,infantry,armor,expansion,fortress,combined,attrition \
  --maps 3,4,5 --seeds 640519 --seconds 900 --output /tmp/titan-collision.json
```

Der HTTP-Node-Test und Browserprüfungen benötigen einen lokalen Server-Port.
Die Referenz- und Releasepfade im Beispiel müssen separat kompilierte Checkouts
von `a877391` und `c946b06` enthalten.

## Finale Validierung: vorab festgelegter Seed 640519

Alle 27 Paare sind vollständig; Anfangswelten, Katalog und bezahlte Policies stimmen überein. S/N/T bedeutet Sieg/Niederlage/Timeout.

| Gegner, je drei Karten | Referenz S/N/T | Finale KI S/N/T | Eigene Verluste | Strategie realisiert vorher → neu |
|---|---:|---:|---:|---:|
| tower1 | 3/0/0 | 3/0/0 | 10 → 11 | 3/3 → 3/3 |
| tower3 | 3/0/0 | 3/0/0 | 6 → 5 | 3/3 → 3/3 |
| tower6 | 3/0/0 | 3/0/0 | 8 → 12 | 3/3 → 3/3 |
| infantry | 0/3/0 | 0/3/0 | 25 → 25 | 3/3 → 3/3 |
| armor | 3/0/0 | 3/0/0 | 19 → 12 | 3/3 → 3/3 |
| expansion | 0/2/1 | 0/3/0 | 39 → 33 | 3/3 → 3/3 |
| fortress | 3/0/0 | 3/0/0 | 8 → 8 | 3/3 → 3/3 |
| combined | 3/0/0 | 3/0/0 | 10 → 10 | 2/3 → 2/3 |
| attrition | 1/1/1 | 2/0/1 | 67 → 36 | 3/3 → 3/3 |

Gesamt: **19/6/2 → 20/6/1**, eigene Verluste **192 → 152**. Alle 19 vorherigen Siege bleiben erhalten.
Neu gewonnen wird Attrition/Small (vorher Niederlage). Expansion/Large verschlechtert sich vom Timeout zur Niederlage. Infantry bleibt auf allen drei Karten verloren; schnelle Expansion ist ebenfalls weiterhin eine Schwäche. Attrition/Medium bleibt im Timeout. Diese Grenzen werden nicht als erfolgreiche Verteidigung gewertet.
Fortress wird auf allen drei neuen Karten gewonnen, aber langsamer: 661,30 → 674,90 s, 562,45 → 661,75 s und 553,85 → 601,70 s. Die Kollisionskorrektur löst nicht jede Belagerungsentscheidung optimal. Combined/Small endet in beiden Versionen vor der ersten Flugzeuggeburt und zählt deshalb nicht als erfolgreich getesteter Luftangriff.

| Weitere Messgröße | Referenz | Finale KI |
|---|---:|---:|
| Gegnerische Einheitenverluste | 297 | 285 |
| Eroberungsereignisse | 135 | 124 |
| Zerstörte Gebäude | 133 | 144 |
| Gebäudeschaden, HP | 110642.695 | 117238.163 |
| Zerstörte HQs | 19 | 20 |
| Verstärkungen | 345 | 266 |
| Geschützte Rückzüge | 13 | 12 |
| Abgebrochene Missionen | 166 | 157 |
| Festgefahrene Missionen | 17 | 16 |

Armeezusammensetzung, bezahlte Produktion, begründete Leerlaufzeiten, HQ-Sichtungen, Missionsereignisse und Zwischenstände stehen für jede Partie unverändert in den Rohdaten. Produktionssekunden summieren Einrichtungen, nicht Wandzeit. Gebäude-Kills zählen tatsächliche Zerstörungen; ID-Wiederverwendung kann die rein ID-basierte Missionshistorie weiterhin zusammenfassen.

## Bisherige Siegfähigkeit und finale Prüfungen

**648/648 Node-Tests**, **14/14 relevante moderne Browserprüfungen**, **6/6 bisherige Turm-Rush-Partien** (Mittel, 1/3/6 Türme, Seeds 2026/2027) und **6/6 gewöhnliche Kampagnenpartien** (alle drei Größen, Seeds 2026/2027) bestanden. Diese Regressionen werden nicht als weitere unabhängige Blindfälle mit dem neuen Seed zusammengerechnet.
Die sechs Kampagnen verlieren insgesamt 17 statt zuvor 25 Einheiten. Die sechs Turm-Rush-Spiele verlieren 25 statt zuvor 24 Einheiten; alle bleiben Siege. Einzelne Siege werden weiterhin langsamer oder teurer. Die vollständige 61er-Browser-Suite hat die oben dokumentierten bestehenden Fehler.

## Node-Aufwand der finalen Spielreihen

| Phase | Mittel ms vorher → neu | Median der Partie-p95 ms | Median der Partie-p99 ms | Höchster Einzelwert ms |
|---|---:|---:|---:|---:|
| ai | 2.709 → 2.662 | 6.385 → 6.882 | 44.845 → 44.367 | 104.029 → 94.796 |
| simulation | 2.09 → 1.863 | 5.342 → 5.519 | 9.152 → 11.328 | 191.947 → 244.84 |
| pathfinding | 2.113 → 2.071 | 3.202 → 3.902 | 9.005 → 8.734 | 36.677 → 124.432 |
| vision | 4.315 → 4.258 | 8.305 → 8.337 | 9.685 → 10.244 | 85.129 → 72.323 |

Die unterschiedlichen Armeeverläufe und teilweise parallelen Prozesse begrenzen diese CPU-Vergleiche. Aufwendige exakte Reparatursuchen können weiterhin Spitzen verursachen; es wird keine allgemeine CPU-Verbesserung behauptet.

## Isolierte Browser-Frames des finalen Standes

Nach Abschluss aller eigenen Simulationsreihen wurden beide Commits mit derselben UI und bezahlten Turmpolicy in Chromium gemessen: 1440×1000, DPR 1, vierfache CPU-Drosselung, 240 simulierte Sekunden Vorlauf und jeweils acht reale Sekunden Messfenster. Anfangswelten und Katalog sind identisch.

| Karte / bezahlte Türme | Referenz p95 / p99 ms | Final p95 / p99 ms |
|---|---:|---:|
| small / 1 | 16.7 / 16.8 | 16.8 / 16.8 |
| medium / 1 | 16.7 / 16.8 | 16.8 / 16.8 |
| large / 6 | 16.7 / 16.8 | 16.8 / 16.8 |

Keine Page-Errors; alle sechs Messläufe abgeschlossen. Unterschiede von 0,1 ms liegen in der Streuung des etwa 60-Hz-Messfensters. Diese Prüfung belegt keine durchgehend ruckelfreien 900-Sekunden-Partien; späte große Gefechte und seltene Reparaturwegsuchen können teurer sein.

## Restschwächen und Commits

Infanterieangriffe und schnelle Expansion bleiben die wichtigsten strategischen Schwächen. Auch bei gewonnenen Festungsspielen bleiben Dauer und Zielwechsel verbesserungsfähig. Die genaue Navigation behebt das festhängende Fahrzeug, ersetzt aber keine bessere Bewertung jeder späten Schlacht.

`0611d95` enthält den dokumentierten ersten Versuch; `c946b06` nimmt dessen breite Aktivierung und zusätzliche Zielpriorisierung zurück und enthält die finale, ereignisbezogene Kollisionskorrektur. Die Pfadprüfungen werden nur nach echtem Bedarf aktiviert. Quellhashes, alle schlechten Versuche und die vollständigen Abschlussdaten sind mit diesem Bericht committet.
