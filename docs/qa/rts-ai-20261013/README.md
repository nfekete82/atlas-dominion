# RTS-KI: Messbericht vom 13.10.2026

Fortsetzung: [Langzeitoptimierung und vollständige Folge-Abnahme](../rts-ai-long-term-20261013/README.md).

## Umfang und Stand

Ausgangsrevision: `cc55f94fed1b3d3ca2f2569e50b0287b98f36bfe`.
Feature-Branch: `feat/rts-ai-pressure-breakout-20261013`.
Die Änderungen bleiben lokal zur Prüfung; kein Commit, Push, Merge oder Deployment. Die vorhandene unversionierte `package-lock.json` wurde nicht verändert.

Die 360-Tick-Vergleiche zeigen über alle drei Seeds deutlich mehr Gebiet, geringere Verluste, kompaktere Gebiete und geringere Tickkosten. **Die vollständige Abnahme ist jedoch nicht erreicht:** Im zusätzlich geprüften 1.000-Tick-Lauf steigen absolute Verluste und Tickkosten. Die Änderungen sind deshalb keine uneingeschränkte Erfüllung sämtlicher angeforderter Abnahmekriterien.

## Drei nachgewiesene Schwächen

1. **Armeeplätze durch Kleingruppen blockiert.** Die bisherige KI rekrutierte ab 10 Soldaten, benötigte für Feldzüge aber 30. Im 360-Tick-Lauf mit Seed 20261013 standen 18 Gruppen mindestens 16 Ticks still; die längste Episode dauerte 335 Ticks. Geld für weitere Rekrutierung war vorhanden, aber die Armeeplätze waren belegt.
2. **Friedliche Expansion und Verlustbewertung waren widersprüchlich.** Die Neutralpräferenz endete pauschal bei Tick 240. Neutralziele wurden ohne nahe gegnerische Armeen bewertet, Wege durften fremdes Land durchqueren, und neutrale Feldzüge besetzten nebenbei fremdes Staatsgebiet. Verteidigung wurde auch auf leere entfernte Grenzfelder verteilt.
3. **Alarmbefehle und Verlustbuchung verletzten die eigene Strategie.** Der Notfallzweig durfte laufende Verteidigungsmärsche und Seetransporte umleiten. Gleichzeitig konnte summierter Kontaktschaden mehr Gefallene buchen, als eine Gruppe Soldaten hatte. Neue Regressionstests reproduzieren diese Fälle.

## Änderungen

- Die KI wartet auf eine tatsächlich finanzierte Gruppe von 100 Soldaten und hält weiterhin Geld für einen Turm zurück.
- Geschwächte, befehlslose Gruppen werden nur bei tatsächlicher gemeinsamer Anwesenheit an derselben Kaserne zusammengeführt. Soldaten werden übertragen; Reserven und Geld bleiben dabei unverändert.
- Erreichbar nahe Neutralfronten bleiben auch nach Tick 240 bevorzugt. Bewertet werden Breite, Anschluss an eigenes Gebiet, Entfernung, andere Kampagnen und gegnerische Soldaten im Kontaktradius.
- KI-Neutralfeldzüge durchqueren kein fremdes Staatsgebiet und führen keine beiläufigen feindlichen Besetzungssweeps aus. Spielerbefehle behalten ihre bisherigen Regeln.
- Bei friedlichem Expansionsausgang konzentrieren sich mobile Verteidiger auf das Kernland und Hauptstädte, Kasernen, Städte und Fabriken. Für das Kernland zählt die wirkliche ursprüngliche Hauptstadt, nicht das gegnerische strategische Ziel.
- Wiederholte Alarme erhalten bestehende Verteidigungsmärsche und Seetransporte; bereits gedeckte Ziele ziehen keine weitere Notfallarmee ab.
- Gebuchte Kontaktverluste werden auf die tatsächlich lebenden Soldaten begrenzt.
- Nationale Neutralfront-Geometrie wird einmal pro Planungszyklus berechnet. Die Kampagnen-Wegsuche nutzt A* mit derselben Auswahl gleich kurzer Wege wie die bisherige Breitensuche; keine persistente Weg- oder KI-Zustandserweiterung. Der 1.000-Tick-Endzustand blieb durch diese Optimierung bitgenau identisch.

## Messverfahren

Seeds: `20261013`, `20261024`, `221041`. Spielmodus RTS, Schwierigkeit balanced, Spielerland DE, kein menschlicher Eingriff. Jeweils drei gepaarte Vorher/Nachher-Läufe für 360 Ticks mit 8 Gegnern, 360 Ticks mit 49 Gegnern und 1.000 Ticks mit 8 Gegnern: insgesamt 18 finale Simulationen.
Die Baseline wurde aus dem unveränderten Engine-Stand separat unter `/tmp/atlas-ai-baseline` kompiliert und mit demselben erweiterten Diagnoseskript gemessen. Vorher/Nachher-Läufe wurden nacheinander ausgeführt. Die feste Europakarte und die Länderaufstellung ändern sich nicht mit dem Seed; die drei neuen Läufe haben gleiche aggregierte Spielmetriken und sind keine drei unabhängigen Kartenstichproben.

`losses` summiert tatsächliche kumulierte KI-Verluste (`attackFallen + defenseSpent`). Bewegungen werden aus physischen Positionen ermittelt, einschließlich legaler Seelandungen. Die Diagnose prüft Sprungweite, Wasserziele und Wasserecken. Eigentumswechsel innerhalb desselben Ticks können Diagonalen erst legal machen; die Eigentumsprüfung am tatsächlichen Bewegungsschritt wird deshalb zusätzlich in Engine-Regressionstests geprüft.
Kompaktheit wird durch dünne Sektoren und Umfang je eigenem Sektor angenähert; dies ist kein vollständiger Zusammenhangs- oder Richtungsbias-Nachweis. Stillstand zählt ab 16 aufeinanderfolgenden Ticks ohne Positionswechsel, auch bei bestehendem Auftrag. Die alten aktiv/idle-Auftragszähler sind Kontext, kein Bewegungsnachweis. Alle folgenden Werte sind Mittelwerte über die drei Seeds.

## Ergebnisse

### 360 Ticks, 9 Länder

| Messgröße | Vorher | Nachher | Änderung |
|---|---:|---:|---:|
| Netto-Gebietsgewinn | 13571.00 | 19626.00 | +44.6 % |
| Reale KI-Verluste | 386.02 | 73.45 | -81.0 % |
| Anteil dünner Sektoren | 0.0570 | 0.0544 | -4.6 % |
| Umfang je Sektor | 0.2022 | 0.1826 | -9.7 % |
| Tatsächliche Bewegungsticks | 5764.33 | 4476.00 | -22.4 % |
| Unmittelbare Rückbewegungen | 156.00 | 0.00 | -100.0 % |
| Ungültige Landbewegungen | 0.00 | 0.00 | — |
| Seelandungen | 0.00 | 0.00 | — |
| Lange Stillstandsepisoden | 19.67 | 0.00 | -100.0 % |
| Längster Stillstand (Ticks) | 335.00 | 4.00 | -98.8 % |
| Median Tickdauer (ms) | 3.89 | 2.82 | -27.6 % |
| P95 Tickdauer (ms) | 7.11 | 6.01 | -15.5 % |

### 360 Ticks, 50 Länder

| Messgröße | Vorher | Nachher | Änderung |
|---|---:|---:|---:|
| Netto-Gebietsgewinn | 24246.00 | 35724.00 | +47.3 % |
| Reale KI-Verluste | 5043.74 | 3428.26 | -32.0 % |
| Anteil dünner Sektoren | 0.0829 | 0.0769 | -7.2 % |
| Umfang je Sektor | 0.2866 | 0.2577 | -10.1 % |
| Tatsächliche Bewegungsticks | 12129.00 | 12768.00 | +5.3 % |
| Unmittelbare Rückbewegungen | 1656.00 | 902.00 | -45.5 % |
| Ungültige Landbewegungen | 0.00 | 0.00 | — |
| Seelandungen | 9.00 | 5.00 | -44.4 % |
| Lange Stillstandsepisoden | 136.33 | 20.00 | -85.3 % |
| Längster Stillstand (Ticks) | 335.00 | 305.00 | -9.0 % |
| Median Tickdauer (ms) | 12.42 | 8.83 | -28.9 % |
| P95 Tickdauer (ms) | 20.67 | 16.73 | -19.1 % |

### 1.000 Ticks, 9 Länder

| Messgröße | Vorher | Nachher | Änderung |
|---|---:|---:|---:|
| Netto-Gebietsgewinn | 20018.67 | 45784.00 | +128.7 % |
| Reale KI-Verluste | 858.34 | 4893.10 | +470.1 % |
| Anteil dünner Sektoren | 0.0481 | 0.0312 | -35.1 % |
| Umfang je Sektor | 0.1740 | 0.1110 | -36.2 % |
| Tatsächliche Bewegungsticks | 12702.00 | 23302.00 | +83.5 % |
| Unmittelbare Rückbewegungen | 603.67 | 138.00 | -77.1 % |
| Ungültige Landbewegungen | 0.00 | 0.00 | — |
| Seelandungen | 7.33 | 9.00 | +22.7 % |
| Lange Stillstandsepisoden | 39.00 | 21.00 | -46.2 % |
| Längster Stillstand (Ticks) | 975.00 | 499.00 | -48.8 % |
| Median Tickdauer (ms) | 3.92 | 5.86 | +49.4 % |
| P95 Tickdauer (ms) | 7.19 | 10.24 | +42.3 % |

## Bewertung und verbleibende Grenzen

- Die 360-Tick-Resultate erfüllen das Kernziel deutlich. Die langsamere Eröffnung durch das Ansparen größerer Gruppen wird später mehr als aufgeholt. Weniger Bewegungsticks im 9-Länder-Lauf bedeuten hier keinen Aktivitätsverlust: größere reale Gruppen nehmen breitere Neutralflächen ein und vermeiden Umwege.
- Im 50-Länder-Lauf bleiben einzelne Gruppen lange inaktiv; maximale Stillstände von 305 Ticks sind noch vorhanden. Seelandungen finden nachweisbar statt, aber weniger als in der 360-Tick-Baseline. Eine allgemeine Verbesserung der Naval-KI wird nicht behauptet.
- Im 1.000-Tick-Lauf wächst der Nettogewinn von durchschnittlich 20.019 auf 45.784 Felder. Gleichzeitig steigen Verluste von rund 858 auf 4.893 und der Median von 3,92 auf 5,86 ms. Auch Verluste je gewonnenem Feld verschlechtern sich. Diese Langlaufregression bleibt offen; die höhere Zahl aktiver Operationen erklärt sie teilweise, hebt sie aber nicht auf.
- Ein zusätzlich ausprobierter taktischer Rückzug wurde verworfen: Er erhöhte Pendelbewegungen und verschlechterte Gewinne und Verluste. Varianten mit Gruppen ab 60 Soldaten wurden zugunsten der besser abschneidenden 100er-Gruppen verworfen.
- Die Engine behält achtgerichtete eigene Märsche ohne Eckensprung und vierseitige Eroberungs-/Kampfadjazenz. Kein Save-Format- oder Ressourcenbonus wurde eingeführt. Kampagnen können weiterhin bei später ungünstigen Routen abbrechen; das ist keine vollständige Langzeit-Feldzugsplanung.

## Validierung

Baseline: vollständiges `npm test`, **314/314 bestanden**. Der erste Sandboxlauf konnte den HTTP-Server nicht auf localhost öffnen; die vollständige Wiederholung mit erlaubtem Localhost-Zugriff bestand.
Neue Prüfungen: bezahlte Rekrutierung, lokale Truppenkonsolidierung, stabile Verteidigungsbefehle, spätere Neutralpräferenz, Schutz entfernter Infrastruktur, reale Verlustbilanz, legaler Neutralumweg, Save/Load-Fortsetzung ab Tick 500 sowie kürzeste deterministische Wege über 40 Hindernisfelder.
Abschließende vollständige Suite: **324/324 bestanden**, siehe `final-tests.txt`. Sämtliche 18 finalen Simulationen melden null ungültige Landbewegungen. Endzustand-Hashes liegen in den Einzelberichten.

## Reproduktion

```sh
npm test
node scripts/rts-ai-activity.mjs 360 20261013 8 DE
node scripts/rts-ai-activity.mjs 360 20261013 49 DE
node scripts/rts-ai-activity.mjs 1000 20261013 8 DE
node scripts/compare-rts-ai.mjs docs/qa/rts-ai-20261013/baseline-20261013.json docs/qa/rts-ai-20261013/after-20261013.json
```

Entsprechend mit den beiden weiteren Seeds wiederholen. Einzelberichte: `baseline-*.json`, `after-*.json`, `comparison-*.json`; aggregierte Zahlen: `summary.json`. Zeitmessungen hängen vom lokalen Rechner ab und enthalten nur `game.step()`, nicht die anschließende Auswertung.
