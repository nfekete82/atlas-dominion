# PROJECT TITAN – Adaptive RTS AI

Fortsetzung: [gezielte Kollisionskorrektur und neue Commit-A/B-Validierung](titan-siege-coordination-20261026.md).
Sie gewinnt insbesondere den hier noch als Timeout dokumentierten großen
Festungsfall 98251. Die folgenden Messungen bleiben der unveränderte erste Stand.

Basis ist der unveränderte Threat-Response-Abschluss `c9b87e2`.
Entwicklungsbranch: `feat/project-titan-adaptive-ai-20261026`.
KI und Prüfstand: `e54248b`; danach separat die bitgenaue Sichtoptimierung `ccabb82`.
Es wurden keine GPL-Dateien übernommen oder übersetzt. Einheitenwerte, Preise,
Ressourcenregeln, Kapazitäten und Siegbedingungen bleiben unverändert.

## Engpässe und Ursachen

1. **Teure Angriffsziele waren zu beständig.** Bekannte Gebäude dominierten die
   Zielwahl auch dann, wenn Belagerungsmittel fehlten oder sich Verluste häuften.
   Opportunitäten und wirtschaftliche Kosten wurden nicht gegeneinander bewertet.
2. **Nominale Stärke und starre Sollroster unterschieden Gegner nicht ausreichend.**
   Artillerie konnte in einer nominellen Stärkesumme gegen Luft mitgezählt werden;
   schwere Infanterie wurde gegen Panzerung überschätzt. Der Prüfstand enthielt
   bisher hauptsächlich standhaltende Verteidiger.
3. **Navigation und Befehlszuständigkeit erzeugten unnötige Arbeit und Verluste.**
   Erfolglose Verfolgungswege wurden trotz bereits vorhandenen Wiederholtimers
   wieder angefragt. Explizite Gebäudeangriffe ließen Unterstützung teilweise
   gegen nahe, tatsächlich sichtbare schwere Gegner ungeschützt.

Der bekannte Einzelturmfall wurde auf unverändertem Code mit 735,8 s/17 Verlusten
reproduziert. Eine isolierte Änderung mit zusätzlichem Kollisionsdelay erreichte
zwar 498,4 s/8 Verluste, verschlechterte aber Drei-/Sechs-Turm-Fälle deutlich und
wurde vollständig verworfen. Beibehalten wurde ausschließlich die Beachtung des
bereits vorhandenen 0,7-s-Timers bei erfolglosen Angriffspfaden. In der Isolation
sanken A*-Aufrufe 5.488 → 4.803, sehr kurzfristige stationäre Wiederholungen
3.315 → 3.085. Die verbliebenen Kollisionswiederholungen sind nicht generell gelöst.

## Architektur und eigenes Verhalten

`adaptive-strategy.ts` ergänzt eine optionale, gespeicherte Gegnerhypothese:
unknown, tower, infantry, armor, air, expansion oder attrition. Die Klassifikation
verwendet ausschließlich aktuell sichtbare Gegner, kurz erinnerte beobachtete
Einheitenklassen, bekannte Gebäudememories, öffentliche Gebietsveränderungen und
eigene Verluste. Es werden keine versteckten Positionen, HP oder Passagiere
abgefragt. Beobachtete Rollen verfallen nach 45 s; die Produktion verwendet höchstens
30 s alte Beobachtungen mit ausreichender Konfidenz. Ein Transportheli allein gilt
nicht als Kampfluftangriff. Hysterese verhindert Strategieflattern bei kurzen
Sichtunterbrechungen.

`campaign-commander.ts` bewertet Alternativen anhand von Zielwert, Reiseweg,
bekannter Bedrohung, geschätztem Verlustanteil, fehlenden regulären Credits,
Informationenalter und gescheiterten Fronten. Nur erreichbare Kandidaten kommen
zur Auswahl; auch ein erreichbarer vierter Kandidat wird berücksichtigt, wenn die
ersten drei blockiert sind. Die besten Alternativen werden nachvollziehbar im
validierten optionalen Save-Feld protokolliert. Laufende Ziele bleiben bei normalen
Mikrorückzügen bestehen. Erst erhebliche reale Verluste oder eine längere,
unvorbereitete Belagerung mit vorhandenen Alternativen rechtfertigen einen Wechsel.

`battle-response.ts` bewertet Waffen gegen die tatsächlich bekannte Gegenbesetzung:
Artillerie ohne Luftangriff liefert keine fiktive Luftabwehrstärke, schwere Waffen
verwenden ihren echten reduzierten Schaden gegen Fahrzeuge und Fluggeräte.
Bekannte Infanterie-, Panzer- und Luftdefizite können die bezahlte Gegenproduktion
vor alte Sparprioritäten stellen. Unbekannte Technologien erzeugen keine Konter.

Der taktische Controller lässt nahe sichtbare Bedrohungen der Artillerie von
geeigneten Screens abfangen. Abfangpositionen werden gegen bekannte Geschütze
geprüft; laufende Feuerqueues und geschützte Rückzüge behalten ihre Zuständigkeit.
Vor Gebäudebeschuss werden gefährliche nahe mobile Gegner priorisiert. Die bereits
vorhandenen getrennten Haupt-, Verteidigungs- und Expansionsverbände bleiben erhalten.

## Produktion: absichtlicher Leerlauf statt künstlicher Auslastung

Der Produktionsmanager protokolliert je fertiger Anlage eine tatsächliche
Entscheidung mit Ziel und fehlenden Credits: produzieren, für Einheit/Gebäude
sparen, Geldmangel, volle Queue, Armeelimit, erfülltes Rollenprofil oder fehlender
Produzent. Voll laufende Queues sind produktive Zeit und werden nicht als
Leerlauf ausgegeben. Alle Käufe gehen weiterhin durch `build/recruit`.

Über die 27 neuen Entwicklungs-/Validierungsszenarien entfallen von den gemessenen
leeren Produzentensekunden ungefähr 78 % auf Einheitensparen, 14 % auf Geldmangel,
5 % auf erfüllte Rollen und 3 % auf Gebäudesparen. Das globale Armeelimit war in
dieser Matrix kein maßgeblicher Leerlaufgrund; es wurde nicht künstlich angehoben.
Volle Queues ergeben zusätzlich 140,3 Produzenten-Entscheidungssekunden und zählen
nicht zu diesen Leerzeiten. Produzentensekunden summieren über parallele Anlagen
und sind keine verstrichene Spielzeit.

Alte Reports können die damaligen internen Kaufabsichten nur aus realen Queues,
Credits und Sparfeldern ableiten. `productionIdleReasonSources` kennzeichnet diese
Inference. Deshalb ist ein Rückgang von „unexplained-idle“ kein Beleg für denselben
Rückgang echter Leerzeit. Es wurde nicht zum Füllen einer Statistik produziert.

## Eigenständige bezahlte Gegner und Self-Play-Grenze

`adaptive-opponents.mjs` und `benchmark-titan.mjs` ergänzen neun Profile:
Tower1/3/6, infantry, armor, expansion, fortress, combined und attrition.
Die ursprüngliche Turm-Rush-Policy bleibt unverändert. Neue Gegner benutzen eigene
Einheiten und Gebäude, aktuell sichtbare Gegner, eigene Erinnerungen und öffentliche
Sektoren. Sie bauen, produzieren, expandieren, verteidigen und ziehen sich über die
normalen öffentlichen Spielbefehle zurück. 950 Startcredits, normale Einkommen,
Preisabzüge und tatsächliche Geburten/Bauabschlüsse werden geprüft. Proxytests
verhindern versehentliche Zugriffe auf versteckte Gegnerfelder.

**Echtes symmetrisches Commander-Self-Play ist derzeit nicht ohne erhebliche
Faktionsverallgemeinerung möglich.** Die Simulation hat genau einen TacticalAI,
dessen Planung, Ressourcen, Erinnerungen, Schadensreaktionen und Save.ai auf Rot
festgelegt sind. Ein zweiter Constructor oder kurzfristiges Vertauschen von Besitzern
würde diese Zuständigkeiten und Mikroregeln nicht korrekt verallgemeinern. Daher
verwendet die Suite unabhängige adaptive blaue Akteure und behauptet kein
vollständiges Commander-gegen-Commander-Spiel. Die Spielregeln wurden dafür nicht verändert.

## Echte Commit-A/B-Methodik

Alle Paare verwenden Director gegen denselben Gegnercode; der interne
`baseline`-Schalter ist kein Commitvergleich. Die Originalreferenz wurde aus
`c9b87e2` separat kompiliert. Gleich sind Kartenseed, Initialwelt, 950 Startcredits,
Einheiten-/Gebäudekatalog, 20-Hz-Schritt, Gegnerpolicy, Fog-Beschränkungen und
900-s-Limit. Siege und Niederlagen sind tatsächliche terminale Spielzustände;
Timeouts bleiben Timeouts. Gebäude-Kills werden trotz ID-Wiederverwendung als
wirkliche Zerstörungen gezählt, Kaufaufträge und fertige Einheiten getrennt.

Entwicklung: Karte 4/Seed 2026. Nach dem Strategie-Freeze wurden einmalig die vorher
nicht verwendeten Validierungsfälle **Karte 3/Seed 74077** und **Karte 5/Seed 98251**
mit allen neun Profilen gespielt. Keine Fallauswahl oder Strategieanpassung anhand
der Blindresultate. Pro Version ergeben sich neun Entwicklungs- und 18 blinde Partien.

Die Spiel-A/B-Daten gehören zum eingefrorenen KI-Commit `e54248b`, Modulgraph-Hash
`a727195a8391553eff78dd93c45ec43b1c898ae40d678ae1215dcc959b5679b8`.
Der nachfolgende reine Sicht-Schnellpfad verändert nach Paritätsprüfung keine
Sichtbits, Trefferlogik oder Spielentscheidungen. Die finalen Browsermessungen
enthalten diese separat dokumentierte Performanceänderung.

### Unbenutzte Validierungsseeds

| Fälle je Version | Vorher S/N/T | TITAN S/N/T | Eigene Verluste |
|---|---:|---:|---:|
| Klein, 74077, neun Profile | 7/1/1 | 8/1/0 | 44 → 33 |
| Groß, 98251, neun Profile | 7/1/1 | 8/0/1 | 56 → 57 |
| Gesamt | **14/2/2** | **16/1/1** | **100 → 90** |

Gegnerische Verluste steigen 203 → 248; Eroberungsereignisse inklusive
Wiedereroberungen 99 → 103. Beide Versionen sehen 17 der 18 HQs; tatsächlich
zerstörte HQs steigen 14 → 16. Weitere Armeegrößen, Geburten, Schäden,
Verstärkungen, Rückzüge und Missionsereignisse stehen ungefiltert in den Rohdaten.

### Alle drei Szenarien je Gegnertyp: Entwicklung plus Blindvalidierung

S/N/T bedeutet Sieg/Niederlage/Timeout. Die letzte Spalte zählt, wie oft der
Gegner seine angekündigte Bau-/Produktionsstrategie tatsächlich verwirklichte.

| Gegner | Vorher S/N/T | TITAN S/N/T | Eigene Verluste | Strategie realisiert vorher → neu |
|---|---:|---:|---:|---:|
| Tower1 | 3/0/0 | 3/0/0 | 20 → 7 | 3/3 → 3/3 |
| Tower3 | 3/0/0 | 3/0/0 | 23 → 9 | 3/3 → 3/3 |
| Tower6 | 2/0/1 | 3/0/0 | 13 → 11 | 3/3 → 3/3 |
| Infantry | 0/3/0 | 2/1/0 | 35 → 16 | 3/3 → 3/3 |
| Armor | 3/0/0 | 3/0/0 | 11 → 11 | 2/3 → 2/3 |
| Expansion | 2/1/0 | 2/1/0 | 20 → 15 | 3/3 → 3/3 |
| Fortress | 2/0/1 | 2/0/1 | 13 → 35 | 3/3 → 2/3 |
| Combined | 3/0/0 | 3/0/0 | 7 → 7 | 2/3 → 2/3 |
| Attrition | 2/0/1 | 3/0/0 | 19 → 15 | 3/3 → 3/3 |

Auf Small wurden armor und combined in beiden Versionen vor dem ersten Panzer
beziehungsweise Flugzeug ausgeschaltet. Das sind Siege gegen die Versuche,
**keine bewiesenen Panzer-/Luftabwehrgefechte**. Auf Large und im Entwicklungsfall
werden Panzer und Gunship tatsächlich regulär produziert. Die neue KI verhindert
im Entwicklungs-Fortressfall die vollständige gleichzeitige Vier-Turm-Stellung
(Spitze zwei, vier Türme bezahlt gebaut); der Fall wird nicht entfernt oder als
Beleg gegen eine fertige Vier-Turm-Batterie ausgegeben.

Ein tatsächlich realisierter großer Infanterierush kippt von Niederlage458,65 s/
19 Verlusten auf Sieg454,25 s/8 Verluste. TITAN produziert dort fünf schwere
Infanteristen statt zwei. Eine schnelle kleine Infanterieoffensive bleibt verloren.

### Bekannte Regressionen bleiben sichtbar

Der wichtigste negative Blindfall ist **Large fortress**:
Referenzsieg552,85 s/3 Verluste → **Timeout900 s/28 Verluste**, kein HQ-Schaden.
Der Gegner erreicht dort vier Türme und zwei bezahlte Artillerien. TITAN kommt
zu spät in eine wirksame Belagerung und gerät anschließend in wiederholtes Sammeln.
Dieser Fall wurde nicht nachjustiert oder aus der Auswertung entfernt.

Auch einzelne Türme sind blind etwas langsamer: Small262,9 → 288,8 s,
Large323,05 → 335,5 s. Der Entwicklungs-Expansionsgegner gewinnt weiterhin
(Referenz342 s/8 Verluste, TITAN344,85 s/9 Verluste). Trotz besserer Gesamtquote
ist keine allgemeine Überlegenheit gegen beliebige menschliche Strategien bewiesen.

## Erhaltene Ausgangsstärken

Die sechs bisherigen Turm-Rush-Regressionspartien auf Karte 4/Seeds 2026 und 2027
bleiben **6/6 gewonnen**. Der ausdrücklich problematische Einzelturm2026 verbessert
sich gegenüber dem aktuellen Threat-Response-Stand von **735,8 s/17 Verlusten auf
637,7 s/1 Verlust**. Drei Türme2026:485,9 → 472,05 s bei unverändert drei Verlusten;
sechs Türme2026:469,7 → 495,45 s, sechs → sieben Verluste. Nicht jede einzelne
Kennzahl verbessert sich. Die drei 2027-Turmfälle bleiben ebenfalls gewonnen.

Die sechs bisherigen Kampagnen auf allen drei Größen/Seeds 2026 und 2027 bleiben
**6/6 gewonnen**. Gesamtverluste39 → 25, mittlere Dauer487,21 → 460,71 s.
Die gespeicherte Kampagnenreferenz stammt aus dem vorigen vollständigen Bericht;
ihre Gameplay-Quellhashes wurden gegen die separat ausgecheckte c9b87e2-Referenz
geprüft. Diese Wiederholungen werden nicht nochmals als unabhängige Blindfälle gezählt.

## Performance: Node und Browser getrennt

Die blinden Node-Läufe zeigen einen echten Preis der komplexeren Planung:
mittlerer KI-Puls1,17 → 3,21 ms; medianes Partie-p95 des KI-Pulses1,95 → 5,12 ms,
p99 8,10 → 28,06 ms. Der mittlere Simulationstick steigt1,86 → 2,30 ms; medianes
Partie-p95/p99 sinkt6,91/11,97 → 5,85/11,15 ms. Das sind teils parallele Node-Läufe
vor dem letzten Sicht-Schnellpfad, keine FPS-Angaben. Restspitzen bleiben vorhanden.

Der bestehende `vision-cache.ts` bleibt erhalten. Zusätzlich beweist ein
Integralbild, ob das gesamte Rechteck zwischen Quelle und Ziel frei von opaken
Zellen ist. Nur dann darf der ursprüngliche Sichtstrahl entfallen. Ansonsten wird
unverändert der alte Raycast verwendet. Keine Winkelapproximation, Quantisierung,
veraltete Sichtmaske oder veränderte Sichtweite. Geländeänderungen invalidieren
beide Caches. Fünf Paritätsprüfungen vergleichen Original-Raycasts, alle Karten,
Klippen, Wandänderungen, entfernte Quellen, Bewegung und bezahlte Simulation/Saves;
der Kontrolllauf deaktiviert ausdrücklich auch den neuen Rechteck-Schnellpfad.

Der erste TITAN-Browserlauf fand auf Small zunächst eine Regression auf50 ms p95.
Die isolierte Messung **derselben TITAN-KI** ohne/mit Sicht-Schnellpfad verbessert
p95/p99 von50,0/50,1 auf16,7/16,8 ms. Der abschließende vollständige Vergleich
gegen c9b87e2 wurde danach wiederholt:

| Chromium, 4× CPU | p95 vorher → final | p99 vorher → final |
|---|---:|---:|
| Small | 33,3 → 16,7 ms | 33,4 → 16,8 ms |
| Medium | 16,7 → 16,7 ms | 16,8 → 16,8 ms |
| Large | 16,8 → 16,7 ms | 16,8 → 16,8 ms |

Chromium155,1440×1000,DPR1, bezahlte 1/1/6-Turm-Kampagnen, jeweils240 simulierte
Sekunden Warmup und acht echte Sekunden rAF-Frames; identische Initialwelt- und
Gesamtkataloghashes, keine Seitenfehler. Gemessen wird die tatsächlich entwickelte
Spielsituation, nicht ein künstlich gleich großer Endroster. Die Ergebnisse sind
keine universelle Framerate-Garantie auf beliebiger Hardware.

## Legacy, Tests und Reproduktion

Der alte Drucktest scheiterte an Aufklärungsprioritäten, nicht an einer zu schwachen
Waffe oder an einer berechtigt nötigen Testlockerung. Auf Legacy-Karten werden
öffentliche gegnerische Frontiers jetzt vor unsortierten neutralen Zielen erkundet.
Seed2026 feuert nach259,5 s statt gar nicht bis300 s; Seed42 nach221,4 s.
Die ursprünglichen Testassertionen und Grenzen bleiben unverändert.

- **643/643 Gesamttests bestanden**, einschließlich ursprünglichem Legacy-Vorfehler.
- **13/13 bestehende Browserprüfungen bestanden**, einschließlich Save-Load,
  Bau/Reparatur, Transport, Produktion und Kampfsystem.
- Versteckte Gegnerfelder, kurze Sichtunterbrechungen, Waffenkompatibilität,
  bezahlte Konterproduktion, Missionspersistenz, unerreichbare Alternativen und
  sofortige Reaktion auf neue Spielerbefehle besitzen gezielte Tests.
- Die bestehende Befehlsstabilitätsprüfung setzt nun ausdrücklich eine bereits
  aktive HQ-Mission als Vorbedingung; alle Befehls-/Pfadidentitätsassertionen bleiben
  erhalten. Eine freie neue Zielwahl wird damit nicht mit einem stabilen Auftrag verwechselt.
- Build und `git diff --check` bestanden. Keine UI-/Grafikänderungen und keine
  nachträgliche Auswahl günstiger Seeds.

Rohdaten, Quellhashes, Produktionsgründe, Definition der gemessenen Gegenangriffe,
Missionsjournale und CPU-/Browsermessungen:
[`benchmarks/titan-20261026`](benchmarks/titan-20261026).
Die Entwicklung erhielt vor dem Policy-Freeze Korrekturen, damit Panzer/Luft
überhaupt regulär finanziert werden. Sämtliche hier verglichenen Spiele benutzen
dieselbe endgültige Gegnerpolicy. Die Beobachtertelemetrie wurde zwischen früher
Entwicklungsreferenz und Abschluss erweitert; Spielbefehle und Policies änderten
sich dadurch nicht. Detail-Hashes bleiben in den Reports sichtbar.

```sh
npm run build
node scripts/benchmark-titan.mjs --before /absolute/c9b87e2/dist/src/reborn/simulation.js --profiles tower1,tower3,tower6,infantry,armor,expansion,fortress,combined,attrition --maps 4 --seeds 2026 --seconds 900 --output /tmp/titan-dev.json
node scripts/benchmark-titan.mjs --before /absolute/c9b87e2/dist/src/reborn/simulation.js --maps 3 --seeds 74077 --seconds 900 --output /tmp/titan-small.json
node scripts/benchmark-titan.mjs --before /absolute/c9b87e2/dist/src/reborn/simulation.js --maps 5 --seeds 98251 --seconds 900 --output /tmp/titan-large.json
node scripts/benchmark-titan-browser.mjs --before /absolute/c9b87e2 --seconds 8 --warmup 240 --cpu 4 --output /tmp/titan-browser.json
```

Für die Referenz eine getrennte Quellkopie von c9b87e2 kompilieren. Browser und
Node sind eigenständige Messläufe; veröffentlichte strategische A/B-Daten gehören
zum eingefrorenen KI-Commit, Browser-Endmessungen enthalten den separat geprüften
Sicht-Schnellpfad. Self-Play bleibt eine ausdrücklich benannte technische Grenze.
