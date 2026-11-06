# Kampf- und Unterstützungseffekte

Die bestehenden lokalen Modelle, Karten, Reichweiten und getrennten Turmlagen bleiben erhalten. Für diesen Auftrag wurden keine Assets neu exportiert, keine Abhängigkeiten installiert und keine Commits, Pushes oder Stash-Aktionen ausgeführt.

## Simulation und Balance

- Infanterie: drei tatsächliche Treffer zu je 17/3 Schaden, 75 ms zwischen Schüssen, bisherige 0,85 s zwischen Salvenstarts. Schwere Infanterie: drei Treffer zu je 40 gegen Infanterie beziehungsweise 18 gegen gepanzerte Ziele, 100 ms Abstand, 1,15 s zwischen Salvenstarts (aktualisiert mit der kombinierten Armee). Die feste Simulationsuhr quantisiert die Abstände auf ihre Ticks.
- Turm: vier Treffer zu je 6 Schaden mit 70 ms Abstand, abwechselnd Lauf 0/1/0/1; weiterhin 24 Schaden je 0,8 s, 600 Reichweite, 750 Sicht, 180°/s Drehgeschwindigkeit. Jeder Treffer benötigt gültige Sichtlinie, Reichweite und Ausrichtung. Der bestehende Sockel und die 64 echten Waffenansichten werden verwendet.
- Sanitäter/Bauarbeiter: einzelne Pistolenschüsse mit bisherigen Werten, ausschließlich zur Abwehr oder auf direkten Angriffsbefehl. Der Transportheli verwendet drei MG-Treffer zur Abwehr. Der Raketenwerfer besitzt gespeicherte echte Geschosse; siehe [kombinierte Armee](reborn-combined-arms.md). Die übrigen Fahrzeuge und Flugzeuge behalten ihre Schadenswerte und Einzelschüsse.
- `Shot` trägt tatsächlichen Schusstyp, Quelle, Zeit, Bodenpositionen, Zielpanzerung und beim Turm Lauf/Mündung. Infanterieposen und Blickwinkel erlauben korrekte Atlas-Mündungen auch bei inzwischen entfernten Schützen. Darstellung und Audio verarbeiten jedes Objekt höchstens einmal. Partikel berechnen keinen Schaden.
- Der optionale `burst`-Zustand bewahrt noch ausstehende tatsächliche Treffer beim Speichern. Version-2-Saves ohne diesen Zustand bleiben lesbar. Schüsse, Partikel und Arbeitseffekte werden nicht gespeichert und beim Laden nicht wiederholt. Unterbrechung, Tod, Zielwechsel, verlorene Sichtlinie oder Reichweite brechen die verbleibenden Einzelschüsse ab.

## Darstellung

Der gemeinsame Pool begrenzt sämtliche bewegten Effekte auf 240 Einträge und verwendet freigewordene Objekte erneut. Goldene Tracer fliegen mit 1100/1300 Welteinheiten pro Sekunde; jede sichtbare Teilstrecke ist höchstens 12 Einheiten lang. Warme Mündungsblitze und kleine Rauchwolken starten an den registrierten Mündungen. Einschläge erzeugen Staub oder kleine Metallfunken erst bei Ankunft der rein visuellen Geschosse. Normale Treffer erzeugen keine Explosionen.

Grüne Kreuze mit ruhigem Glow erscheinen pro tatsächlich geheiltem Empfänger. Ein dezenter Bodenradius erscheint bei ausgewählten oder aktiv heilenden Sanitätern. Reparierte Gebäude erhalten genau einen kleinen goldenen Schraubenschlüssel, auch mit mehreren Arbeitern. Aktive Baustellen erhalten orange Funken, Staub und einen technischen Impuls; die unfertige Gebäudegrafik bleibt transparent und wächst sichtbar mit dem kompakten Fortschrittsbalken. Alle Arbeitssymbole leiten sich ausschließlich aus positiven HP-Änderungen beziehungsweise tatsächlichem Baufortschritt ab und blenden nach Arbeitsende innerhalb von 0,4 s aus.

Partikelzeit folgt der Simulationszeit. Pause friert sie ein und startet keine neuen Arbeitsfunken. Die vorhandene Partikeloption schaltet die neuen Symbole, Radien, Tracer, Blitze, Rauch und Funken aus. Reduced Motion reduziert Waffen auf einen kurzen kleinen Blitz und ruhige Arbeitssymbole; bewegte Tracer, Funken und Staub entfallen. Es entstehen keine Canvas- oder DOM-Elemente pro Frame.

## Heilung, Reparatur und Bau

Sanitäter behandeln mehrere eigene verletzte Infanteristen im Radius 70 gleichzeitig. Das Gesamtbudget beträgt höchstens 12 LP/s je Sanitäter; Empfänger unter 50 % Gesundheit bekommen die doppelte Gewichtung. Fahrzeuge, Gebäude, Gegner und tote Einheiten bleiben ausgeschlossen. Selbstheilung erhält höchstens 3 LP/s und entfällt bei dringend verletzten anderen Empfängern sowie während der fünf Sekunden nach einem Treffer. Normale eigene Bewegungs-/Angriffsbefehle unterbrechen die automatische Behandlung; gemischte Formationen behalten die bestehende sichere hintere Position und begrenztes Nachrücken.

Reparaturen bleiben bei 12 LP/s je Arbeiter. Baustellen benötigen weiterhin lebende zugewiesene Arbeiter, pausieren bei deren Unterbrechung und lassen sich fortsetzen. Die Baugeschwindigkeit bleibt auf 1,5× begrenzt. Die kurzlebigen `workEffects` fassen alle aktiven Quellen je Empfänger und Arbeitsart zusammen.

## Audio

Ein AudioContext erzeugt reproduzierbares Rauschen mit Hoch-/Tiefpassfiltern, kurzen Hüllkurven und mechanischen Dreieck-Transienten. Das Gewehr klingt kurz und knackig, schwere Infanterie tiefer, der Turm bassreicher und länger, die Pistole trockener und leiser. Es gibt keine externen Audiodateien und keine Waffenschleifen. Pro tatsächlichem Schuss wird höchstens eine zusammengesetzte Stimme gestartet.

Maximal 20 gleichzeitige Effektstimmen und ein gemeinsamer Dynamikkompressor begrenzen Gefechtspegel. Jede beendete Stimme trennt ihre Audioknoten. Entfernung zur Kamera dämpft die komplette Waffenstimme einschließlich Bass; Quellen außerhalb des Bildschirms oder ohne eigene Sicht bleiben stumm. Pause unterbricht Waffen- und Schrittstimmen; Funkbestätigung und Audiotest bleiben im Pausenmenü bedienbar. Ein ausgeblendetes Dokument, Audio-Aus und Lautstärke null unterbrechen alle Stimmen. Übersprungene alte, stumme oder unsichtbare Ereignisse werden später nicht nachgeholt. Der vorhandene Lautstärkeregler bleibt zuständig. Optionale Werkzeuggeräusche wurden nicht ergänzt.

## Betroffene Dateien und Prüfung

Implementierung: `src/reborn/{simulation,renderer,particles,audio,unit-presentation,catalog}.ts`. Tests: `tests/reborn-polish.test.mjs`, bestehende Kampf-/Support-/Turmtests, `tests/browser/reborn-polish.spec.mjs` und Browserkonfiguration. Die vorherigen Support-/Turmdokumentationen wurden an die neuen Werte angepasst.

```sh
npm run build
node --test tests/reborn-polish.test.mjs tests/reborn-support.test.mjs tests/reborn-overhaul.test.mjs tests/reborn-defense-map.test.mjs tests/reborn-campaign.test.mjs tests/reborn.test.mjs
npm --prefix tests/browser test -- --grep 'polish:|overhaul: real group'
```

Die gezielten Browserfälle prüfen echte Atlas-Mündungen, Tracer, beide Turmläufe, synchron gestartete Stimmen, im OfflineAudioContext gerenderte unterscheidbare Waffensignale, Stimmengrenze, Pause, Mute, Lautstärke, Sichtbarkeit, Heil-/Reparatur-/Bauaktivität, Formationen und echtes Speichern/Laden. Screenshots liegen nach dem Lauf unter `tests/browser/artifacts/reborn/polish-{rifle,turret,support}.png`.

Die akustische Klangfarbe ist synthetisch; die Browserprüfungen messen Signale und Zustände, ersetzen aber keine subjektive Lautsprecher-/Kopfhörerabnahme. Gewehr- und Kanonentreffer werden unmittelbar in der Simulation berechnet; ihre kurze Flugzeit gehört zur Darstellung. Der später ergänzte Raketenwerfer verursacht seinen Schaden erst beim tatsächlichen Einschlag. Langzeit-Leistungsbenchmarks und das gesamte projektweite Legacy-Testpaket gehören nicht zu diesem gezielten Prüflauf.

Abschließender Prüfstand: `npm run build` bestanden; **98/98** gezielte Simulations-/Support-/Karten-/Effekttests und **5/5** Browserfälle bestanden. `git diff --check` ohne Befund.
