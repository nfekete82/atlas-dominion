# Taktische Gegner-KI

Die rote Fraktion plant alle drei simulierten Sekunden ab der bisherigen Eröffnungszeit. Die bestehende Simulation, Karten, Waffenwerte, Kosten, Produktion und Unterstützer bleiben maßgeblich. Die KI erhält keine zusätzlichen Ressourcen, Einheiten, Trefferpunkte oder Schadensboni.

## Wissen und Verluste

`src/reborn/tactical-ai.ts` verwaltet einen optionalen versionierten Zustand. Türme gelangen ausschließlich durch aktuelle rote Sicht in diesen Speicher. Eigene Verluste speichern Position, Zeitpunkt, ID und geschätzte eigene Kampfstärke; der unbekannte Schütze wird dadurch nicht verraten. Zwei nahe Verluste sperren kleine Erkundungsangriffe für die Dauer der Erinnerung und verteuern das Verlustgebiet. Wiederholt gescheiterte Sektorangriffe erhalten außerdem eine zeitweilige Zielabwertung.

Ein entdeckter Turm erzeugt eine Gefahrenzone über seine vollen 600 Welteinheiten plus Sicherheitsabstand. Sichtkontakt aktualisiert die Erinnerung. Ein sichtbar zerstörter oder verschwundener Turm wird entfernt. Unsichtbare Zerstörung wird nicht aus den echten Gebäudedaten abgelesen: Veraltete Gefahren werden schrittweise schwächer gewichtet und nach vier Minuten ohne Bestätigung verworfen. Alte Gebäudeerinnerungen aus vorhandenen Spielständen können bekannte Türme wiederherstellen.

## Wege und Ziele

Die vorhandene A*-Suche in `world.ts` akzeptiert optional ein Gefahrenfeld. Zusätzliche Kosten berücksichtigen bekannte Türme, jüngste Verlustgebiete und aktuell sichtbare gegnerische Einheiten. Die Glättung darf einen sicheren Umweg nicht wieder durch die Gefahr abkürzen. Die normale Wegsuche ohne Gefahrenfeld bleibt verfügbar.

Strategische Wege verwenden eigene Anlagen und erinnerte gegnerische Gebäude. Unbekannte gegnerische Gebäude werden nicht für die taktische Vorausplanung ausgelesen; die bestehende physische Kollisionsprüfung gilt weiterhin. Routen werden je Planung geteilt und bei gleicher Lage zwischengespeichert, maximal 128 Einträge. Relevante Wissens-, Sicht- oder Hindernisänderungen verwerfen den Cache. Es gibt keine komplette taktische Pfadsuche pro Einheit und Simulationstakt.

Erreichbare angrenzende Bastionen werden nach Weglänge, Routenrisiko, bekannten Verteidigern, Turmabdeckung, Einkommen, weiteren Nachbarsektoren und gescheiterten Angriffen bewertet. Es werden keine festen Sektorindizes verwendet. Eine umgehbare Turmstellung kann flankiert werden; ist ein anderer Sektor günstiger, wechselt das Ziel. Bei vollständig gedeckten Wegen plant die KI eine stärkere Angriffsgruppe oder untersucht zunächst einen sicheren Randpunkt.

## Gruppen und Phasen

- **Sammeln:** Normalerweise vier bis sechs Kampfeinheiten, gegen bekannte Verteidigung mindestens sechs und höchstens zehn; mit einem Raketenwerfer gegen eine Turmstellung können vier ausreichen. Ein sicheres Aufmarschgebiet liegt außerhalb bekannter Gefahr. Gesundheit und Waffenleistung ergeben zusätzlich eine grobe Kampfstärke. Einzelne Erkundungs-/Einnahmeaufträge bleiben bei unbewachten Zielen und ohne jüngste Verlustserie möglich.
- **Angreifen:** Die Gruppe erhält in derselben Planung gemeinsame Befehle und gemeinsame Marschzugehörigkeit. Das Tempo richtet sich nach der langsamsten Frontrolle; eine zusätzliche Fortschrittsgrenze verhindert das Davonlaufen schneller Einheiten. Panzer und schwere Infanterie erhalten vordere Plätze beim Aufmarsch. Fahrzeuge kämpfen mit ihren vorhandenen Waffenreichweiten. Sanitäter verwenden die bestehenden hinteren Formationsplätze und Heilregeln. Eine notwendige Turmstellung wird zuerst direkt angegriffen, anschließend die Bastion eingenommen. Bastionen bleiben Kontrollpunkte und werden nicht beschossen.
- **Neu formieren:** Zwei schnelle Gruppenverluste, weniger als 60 % der ursprünglichen Front, eine neu erkannte Gefahr auf dem bisherigen sicheren Weg oder ausbleibender Fortschritt brechen den Angriff ab. Überlebende bekommen echte Rückzugs-/Sammelbefehle. Mindestens neun Sekunden vergehen vor einem erneuten Gruppenstart. Ziele und Wege werden weiter geprüft.
- **Verteidigen:** Sichtbare Angreifer nahe eigenen wichtigen Gebäuden haben Vorrang. Verfügbare Kampfeinheiten kehren gemeinsam zurück. Nach der Abwehr folgt die Neuformierung. Bei größeren Feldgruppen bleiben ein bis zwei nahe Kampfeinheiten als Reserve zurück.

Die KI produziert weiterhin über `recruit` und reguläre bezahlte Warteschlangen. Die erweiterte situationsabhängige Wirtschaft errichtet mit echten Arbeitern auch Kaserne, Fabrik und Flugfeld und berücksichtigt alle zehn Typen; Rollen, Erholung, Raketenwerfer und Transportheli sind in [Kombinierte Armee](reborn-combined-arms.md) dokumentiert. Bei erkannten Gefahren plant sie schwere Infanterie und Fahrzeuge, ergänzt bei ausreichender Front Sanitäter und bei Gebäudeschäden einen Bauarbeiter. Für teurere Einheiten kann sie Credits ansparen; das Warten ist begrenzt. Arbeiter reparieren über die vorhandenen Befehle. Ohne Produktionsbasis können vorhandene Truppen weiter von einem eigenen Sektor aus planen.

## Speicherung und Grenzen

Spielstände behalten Version 2 und erhalten lediglich das optionale Feld `ai`. Turmerinnerungen, Verluste, Zielabwertungen, Phase, Sammelpunkt, Gruppe, Ziel und Sparvorhaben werden gespeichert und validiert. Taktische Marschzugehörigkeit steht im optionalen Auftragsfeld `tactical`. Die nächste Einheiten-ID bleibt nach dem Laden monoton, damit gefallene Einheiten aus dem Verlustgedächtnis nicht mit neuer Verstärkung verwechselt werden. Abgeleitete Gefahrenfelder und Routen-Caches werden nach dem Laden aus gültigem Wissen rekonstruiert. Alte 30-Bastionen-Karten und neue 16-Bastionen-Karten bleiben unterstützt. Pause hält sämtliche Planungs-, Produktions- und Verlustfristen an.

Die KI verwendet nachvollziehbare Heuristiken: Sie prognostiziert keine kompletten Gefechte und koordiniert jeweils eine Hauptangriffsgruppe. Unbestätigte Informationen können vorübergehend zu vorsichtigem Verhalten führen. Eine militärisch aussichtslose Lage wird nicht mit unfairen Boni aufgelöst. Die Tests decken keinen unbegrenzten Langzeit-Spielverlauf ab.

## Dateien und gezielte Prüfung

Implementierung: `src/reborn/tactical-ai.ts` (neu), `src/reborn/simulation.ts`, `src/reborn/world.ts`. Tests: `tests/reborn-tactical-ai.test.mjs` und `tests/browser/reborn-tactical-ai.spec.mjs` (neu), Browserkonfiguration erweitert. Bestehende Grafikassets und Waffeneffekte wurden nicht ersetzt.

```sh
npm run build
node --test tests/reborn-tactical-ai.test.mjs tests/reborn-polish.test.mjs tests/reborn-support.test.mjs tests/reborn-overhaul.test.mjs tests/reborn-defense-map.test.mjs tests/reborn-campaign.test.mjs tests/reborn.test.mjs
npm --prefix tests/browser test -- --grep 'tactical AI:|polish:|overhaul: real group|real worker placement'
```

Die neuen KI-Tests prüfen Sicht und veraltetes Wissen, verborgene Feinde, Verlustlernen, sichere Umwege, gemeinsame Starts, Marschtempo gemischter Truppen, Sanitäter hinter der Front, gezielte Turmangriffe, alternative Ziele, bezahlte Verstärkung, Verteidigung, Pause und Speichern/Laden für Kartenversionen 0/1/2. Aktive echte Kampagnen werden auch nach dem Laden weitergespielt.

Der Browserfall baut den blauen Turm tatsächlich mit einem Bauarbeiter auf der unveränderten 16-Sektoren-Karte und lässt ihn zwei rote Infanteristen durch echte Salven ausschalten. Die KI sammelt vier bezahlte Kämpfer, rückt gemeinsam vor, erkennt den zunächst unbekannten Turm, zieht Überlebende zurück und wählt einen anderen Sektor. Eine JSON-Anlage im Testbericht dokumentiert die Entscheidungen; `tests/browser/artifacts/reborn/tactical-ai-after-ambush.png` zeigt den anschließenden Zustand. Die übrigen Browserfälle prüfen weiterhin Turm-/Gewehrsalven, Audio, Heilung, Bau, Reparatur, Formationen und echtes Speichern/Laden.

Keine Resets, Stash-Aktionen, automatischen Commits oder Pushes. Vorhandene lokale Änderungen bleiben erhalten.

Prüfstand: `npm run build` erfolgreich. Der gemeinsame Lauf bestand 114/114 Tests; der abschließende KI-Lauf bestand 17/17 einschließlich der zusätzlich geprüften monotonen Einheiten-IDs nach dem Laden. Damit sind 17 KI- und 98 bestehende Simulationsprüfungen abgedeckt. Der Browserlauf bestand 7/7 Fälle einschließlich echtem Hinterhalt, Zielwechsel und Speichern/Laden. `git diff --check` ohne Befund.


## Aktualisierung: Nachschub und Angriffsdruck (24.10.2026)

Neu produzierte Kämpfer rücken zur laufenden Angriffsgruppe nach, ohne deren Marsch durch wartende Rekruten an der Basis zu blockieren. Sie schließen sich in Frontnähe an; eine Heimatwache und die Gruppengrenze bleiben erhalten. Sammelbewegungen laufen ohne starre Marschkohorte, und Geländeumwege setzen die direkte Fortschrittsbremse vorübergehend aus. Nach dem Aufbau einer kleinen Gebietsgrundlage bevorzugt die KI den Weg zur gegnerischen Front gegenüber entfernten neutralen Umwegen. Gefahrenbewertung, Ressourcenregeln und Sichtwissen bleiben maßgeblich. Messwerte und Regressionen stehen im [Änderungsbericht](qa/2026-10-24-tactics/README.md).
