# RTS-Überarbeitung: Türme, Baugebiete, Formationen und Fraktionen

Die Implementierung baut auf dem lokalen Stand mit Sanitätern, Bauarbeitern, Bauaufträgen und Kasernenproduktion auf. Es wurden keine Commits oder Pushes erstellt und keine Stashes verändert.

## Kompakter drehbarer Geschützturm

Die Darstellungsbreite beträgt jetzt **72 statt 98 Welteinheiten** (26,5 % kleiner). Der Kollisionsradius bleibt bei 30; Kosten, Lebenspunkte, Reichweite und Schaden bleiben unverändert. Der neue Turm besitzt 120 Modellteile und 56.724 Dreiecke: segmentierte Keramikpanzerung, Drehkranz, mechanische Halterungen, zwei gekühlte Rohre mit Mündungsbremsen, Zieloptik, Sensor und Statusleuchte. Größere blaue beziehungsweise rote Waffenpanzerungen kennzeichnen die Fraktion.

Der Sockel wird einmal als statisches Bild exportiert. `TurretHead` enthält alle drehenden Bauteile. Der vorhandene Gebäudeexporter rendert **64 echte perspektivische Richtungen** dieser Baugruppe, mit einheitlicher Kamera, unverändertem Maßstab, gemeinsamem Pivot und registrierten Mündungspositionen. Die isometrische Verkürzung wird beim Ausrichten der 3D-Ansichten berücksichtigt.

Die Simulation speichert optional `turretAngle`, `previousTurretAngle` und `turretTarget`. Sie hält gültige Ziele stabil, dreht auf dem kürzesten Winkelweg mit maximal π rad/s (180°/s) und feuert bei weniger als 0,045 rad Restfehler. Ohne Ziel scannt der Kopf mit 0,14 rad/s. Sicht, Sichtlinie, Reichweite, Cooldown, Pause und simulierte Zeit bestimmen die Funktion. Beide Mündungen erzeugen inzwischen abwechselnde ballistische Schüsse mit insgesamt 24 Schaden je Salve; Details und aktuelle Prüfungen stehen in `reborn-combat-polish.md`.

`turret-rig.ts` wird aus denselben Exportdaten erzeugt wie die Waffenebene. Die Simulation berechnet daraus die tatsächlichen Weltpositionen der Mündungen; der Renderer verwendet die entsprechende Richtungsansicht. Die feststehende Basis wird nicht gedreht. Alte Spielstände ohne Turmzustand bleiben gültig.

## Kaserne und übrige Modelle

Die neue Kaserne besitzt 126 Modellteile und 60.112 Dreiecke: verstärkte Ecken, zweiflügelige Personenschleuse, Vordach, geriffelte Rampe, segmentierte Dachpanzerung, Fenster, Versorgungselemente, Lüftungen, Antenne und größere Fraktionsflächen. Ihr Spielmaßstab, Kollisionsradius, Preis, Bauzeit und Produktion bleiben erhalten.

Infanterie, schwere Infanterie, Sanitäter und Bauarbeiter verwenden weiterhin das bestehende Skelett und die offline gebackenen Hand-/Waffensockets. Brust-, Schulter-, Arm-, Helm- und Rucksackflächen tragen deutlicheres Teamenamel. Schwere Infanterie besitzt jetzt ein eigenes Modell und einen eigenen Atlas mit breiteren Schulterpanzern, zusätzlichem Brustpanzer und schwererer Waffe. Sanitäter haben kleinere Schulterplatten und medizinische Ausrüstung, Bauarbeiter Werkzeugrucksack, Werkzeugtasche, Schraubenschlüssel und gelbe Kennzeichnung. Beide behalten die Pistolen. Alle vier Rollen behalten fünf Animationszustände, acht Blickrichtungen und 296 Atlasframes je Fraktion.

Bei den sechs Fahrzeugtypen wurden bestehende Hauben, Kettenabdeckungen, Turmpanzerungen, Tragflächen und Seitenmarkierungen mit größeren Fraktionsmaterialien versehen. Geometriefamilie, Bewegungsphasen und bestehende Animationen bleiben erhalten. Die ursprünglichen Fabrik-, Flugfeld- und Generatormodelle erhalten ebenfalls stärkere sichtbare Teamflächen.

**HQ und Bastion wurden nicht neu exportiert.** Die 28 bereits vorhandenen HQ-/Bastion-Dateien wurden vor und nach der Arbeit per SHA-256 verglichen und sind unverändert. Die vorhandenen Tests gegen die vom Nutzer verbesserten Quell-GLBs bleiben bestanden.

## Bauen auf erforschter Karte

`buildError()` prüft `hasExplored()` für jeden Kartenausschnitt, der die kreisförmige Grundfläche schneidet, und zusätzlich die freie Grundfläche. Aktuelle Sicht und Gebietseigentum beschränken die Platzierung nicht mehr. Eigene, neutrale und gegnerische erforschte Flächen sowie bereits erkundeter Kriegsnebel sind bebaubar. Unerforschte Flächen, Felsen, Kartenränder, Gebäude, Einheiten und Bastionsabstände bleiben gesperrt.

Ein Gebäude gehört dem beauftragenden Spieler. Sein Gebiet wird durch den Bau nicht erobert; Einnahmeregeln und Gebietseinkommen bleiben erhalten. Vor der einmaligen Abbuchung wird ein erreichbarer Arbeitszugang mit der vorhandenen Navigation geprüft. Bei Ablehnung gibt es weder Abbuchung noch eine kostenlose Baustelle; eine Meldung erklärt den fehlenden Zugang. Arbeiter laufen real zur Baustelle. Unterbrechungen, Tod, Wiederaufnahme, Rückerstattung und der gemeinsame Bauhöchstwert von 1,5× bleiben erhalten. Arbeitszugang und Ziel-ID werden gespeichert.

## Sanitäter hinter der Front

Gemischte Bewegungs- und Angriffsbefehle sortieren schwere Infanterie nach vorn und Sanitäter in eigene hintere Reihen. Die Infanterie marschiert gemeinsam mit dem Tempo ihrer langsamsten Frontrolle. Die Sanitäter folgen der am wenigsten vorgerückten lebenden Front; ein Fortschrittslimit verhindert das Überholen. Mehrere Sanitäter erhalten getrennte seitliche Plätze. Die Marschrichtung bleibt für den Auftrag stabil, anstatt bei jedem Tick neue Rollen zu verteilen.

Während Angriffsbewegungen erkennen Sanitäter verletzte eigene Infanterie im begrenzten Umfeld und rücken nur zu einem Heilpunkt hinter der Front nach. Bekannte feindliche Waffenreichweiten begrenzen dieses Nachrücken. In 70 Welteinheiten Heilreichweite wird ein Gesamtbudget von 12 LP/s auf die verletzte Infanterie verteilt, mit Lebenspunktgrenze und langsamer Selbstheilung. Nach der Behandlung wird wieder die hintere Position angestrebt. Stirbt die Front, wird der zugehörige Formationsmarsch beendet. Eigenständige Sanitäter dürfen weiterhin normale Bewegungs- und ausdrückliche Angriffsbefehle erhalten.

Vorhandene explizite Heilaufträge bleiben bei Gruppenbefehlen erhalten. Auch ein manuell beauftragtes bewegliches Heilziel kann nicht unbegrenzt verfolgt werden: Entfernt es sich mehr als 160 Einheiten vom anfänglichen Heilort und liegt außerhalb der Heilreichweite, wartet der Sanitäter und behält seinen Auftrag. Der Kontext erklärt den Wartezustand. Kehrt das Ziel zurück, wird die Heilung fortgesetzt. Die Pistole bleibt zur direkten Selbstverteidigung verfügbar; es gibt keine automatische Gegnerjagd.

## Reproduktion und gezielte Prüfung

```sh
node scripts/export-atlas-buildings.mjs turret barracks factory airfield generator
node scripts/export-detailed-infantry.mjs
node scripts/render-unit-atlases.mjs rover tank artillery scout gunship bomber
npm run build
node --test tests/reborn-overhaul.test.mjs tests/reborn-support.test.mjs tests/reborn.test.mjs tests/reborn-campaign.test.mjs tests/reborn-animation.test.mjs tests/reborn-buildings.test.mjs
npm --prefix tests/browser test -- --grep 'overhaul:|support HUD:|minimap drag, anchored zoom'
```

Neu exportiert wurden jeweils beide Fraktionen der vier Infanterierollen, aller sechs Fahrzeuge und der fünf genannten Gebäudetypen. Die Turmdateien enthalten zusätzlich `turret-{0,1}-turret.png` mit 64 Richtungen und Mündungsmetadaten. Schwere Infanterie liegt nun unter `prototype/heavy-{0,1}.{glb,png,json}`. Es wurden keine neuen Abhängigkeiten installiert.

Die neuen Tests prüfen Turmrotation, Schussfreigabe, beide Fraktionen, Mündungen, Sichtlinien, Pause und Savegames, vollständige Erkundung, neutrale/gegnerische Bauplätze, Kriegsnebel, reale Anreise, unerreichbare Aufträge, hintere Formationsplätze, Heilung während Angriffsbewegung, begrenzte Heilzielverfolgung und echte exportierte Geometrie. Im Browser werden die 64 Ansichten auf unterschiedliche Bildinhalte, alle zehn Einheitentypen auf sichtbare Fraktionsflächen und alle geladenen Spielassets auf HTTP-Fehler geprüft. Die jeweiligen Tests erzeugen Screenshots unter `tests/browser/artifacts/reborn/overhaul-{turrets,barracks,formation}.png`; Playwright räumt das Artefaktverzeichnis vor dem nächsten Lauf auf.

Die vollständige projektweite Legacy-Testsuite wurde nicht ausgeführt. Die Spielgrafik nutzt 64 diskrete Turmansichten bei kontinuierlicher Simulationsausrichtung. Die bestehende Navigation behandelt Formationen als einzelne kollidierende Einheiten; es werden keine Einheiten teleportiert.

## Betroffene Quellen

- `src/reborn/simulation.ts`, `turret.ts`, `turret-rig.ts`, `renderer.ts`, `building-presentation.ts`, `catalog.ts`, `asset-paths.ts`, `input.ts`, `main.ts` und `index.html`.
- `scripts/animation/atlas-buildings.js`, `building-export.js`, `detailed-infantry.js`, `detailed-export.js`, `atlas-vehicles.js`, `render.html` und `scripts/export-atlas-buildings.mjs`.
- GLBs, PNGs und Metadaten unter `src/assets/reborn/{buildings-3d,prototype,animation}` für die oben genannten Typen.
- `tests/reborn-overhaul.test.mjs`, `tests/reborn-support.test.mjs`, `tests/browser/reborn-overhaul.spec.mjs`, `tests/browser/reborn.spec.mjs`, `tests/browser/reborn.config.mjs` und die Dokumentation.

## Ergebnis

`npm run build` erfolgreich. **88/88** gezielte Simulations-, Kampagnen-, Animations- und Gebäudetests bestanden. Alle **sieben** ausgewählten Browserprüfungen bestanden; der Reparaturablauf wurde nach einer Korrektur der Kamera-Testvorbereitung separat erfolgreich bestätigt. Keine fehlerhaften Spielasset-HTTP-Antworten oder Browser-JavaScript-Fehler in diesen Prüfungen. `git diff --check` ohne Befund. Alle 28 geschützten HQ-/Bastion-Dateien bleiben per Prüfsumme unverändert. Keine bekannten offenen Fehler in den geprüften Abläufen.
