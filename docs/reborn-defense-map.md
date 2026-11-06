# Fernverteidigung und 16-Sektoren-Kampagnen

Der aktuelle lokale Spielstand mit getrennt drehbaren Türmen, 64 Waffenansichten, Bauarbeitern, Sanitätern und verbesserten Modellen bleibt die Grundlage. Es wurden keine Grafikassets neu exportiert, keine Stashes verändert und keine Commits oder Pushes erstellt.

## Fernverteidigung

`RULES.turret` definiert die Werte zentral: **600 Welteinheiten Waffenreichweite**, **750 eigene Sicht**, maximal **180° Drehung pro Sekunde**, weiterhin **24 Schaden je Salve** und **0,8 s Nachladezeit**. Der Katalog, die Simulation und der dezente Reichweitenkreis für ausgewählte eigene Türme verwenden dieselben Werte. Die Grafik bleibt bei den bisherigen 64 Ansichten mit gemeinsam drehenden Kanonen und registrierten Mündungen.

Die beiden festen 300er-Prüfungen für Zielzulassung und räumliche Suche wurden entfernt. Ein gültiges Ziel ist eine lebende gegnerische Einheit innerhalb von 600 Einheiten. Infanterie, Fahrzeuge und Luftunterstützung sind zulässig. Die Erfassung berücksichtigt gemeinsame Fraktionssicht und unmittelbare eigene Sicht, damit ein noch nicht aktualisiertes Nebelraster die Erfassung nicht verzögert. Die Schusslinie prüft unabhängig davon Felsen und Gebäudekörper; gemeinsame Sicht erlaubt keine Schüsse durch Hindernisse. Der eigene Turmsockel wird bei dieser Prüfung ausgenommen.

Ein gültiges erfasstes Ziel bleibt stabil, auch wenn ein zweiter Gegner näher kommt. Bei Tod, Verlassen der Reichweite oder blockierter Schusslinie wird neu erfasst. Die Rotation läuft auch während des Nachladens. Gefeuert wird erst bei ausreichender Ausrichtung; vier zeitlich getrennte Schüsse wechseln zwischen den tatsächlichen Waffenmündungen, jeweils mit 6 Schaden und kurzer ballistischer Spur (siehe `reborn-combat-polish.md`). Ohne Ziel bleibt das langsame Absuchen aktiv. Kontrollpunkt-Bastionen sind weder Kampfziele noch zusätzliche Schusshindernisse: Bekämpft werden die Einheiten um sie herum.

## Neue Karten

Neue Kampagnen verwenden `mapVersion: 2`, weiterhin auf einer Karte von 3.762 × 3.762 Welteinheiten. Es gibt **16 Sektoren in einem 4 × 4-Netz**: zwei blaue, zwei rote und zwölf neutrale. Die Startsektoren liegen gegenüber. Kontrollpunktpositionen, Sektorgrenzen, Start-HQs und neue HQ-Produktionsausgänge werden gespiegelt angelegt; die Felslandschaft bleibt zufällig.

Kontrollpunkte halten mindestens **650 Einheiten Abstand**. Ein HQ steht ungefähr 308 Einheiten von seiner Bastion entfernt. Um Startpunkte bleiben größere freie Zonen geschützt; auch die übrigen Bastionen erhalten mehr freien Boden. Zwischen allen horizontalen und vertikalen Nachbarn werden breite Wege freigehalten. Sektorgrenzen und symmetrische Nachbarschaftsbeziehungen kommen aus dem zur Version passenden Layout.

Beide Fraktionen starten mit **35 Credits Einkommen je zehn Sekunden**, einschließlich HQ. Für die geringere Anzahl von Sektoren liefern neue Bastionen je nach Wert 10, 15 oder 30 Credits; gespiegelte Sektoren sind gleich viel wert. Sieg erfordert die Kontrolle beider HQs und der beiden roten Startsektoren. KI, Eroberung und Einkommen arbeiten weiter über die tatsächlichen Territorien und Nachbarn.

Sektorzähler, Feldhandbuch und Siegtext verwenden die passende Anzahl. Die Sektorliste wird beim Laden und Neustarten neu aufgebaut, damit der Wechsel zwischen 16er- und 30er-Karten keine falschen oder fehlenden Einträge hinterlässt.

## Alte Spielstände

Das Speicherformat bleibt bei `version: 2`; die Kartenversion ist davon unabhängig:

| Kartenversion | Geometrie | Sektoren | Startsektoren je Fraktion |
| --- | --- | --- | --- |
| 0 / fehlende Angabe | ursprüngliche feste Wüstenkarte | 30 | 3 |
| 1 | bisherige Zufallskarten | 30 | 3 |
| 2 | neue Zufallskarten | 16 | 2 |

Alte Karten werden nicht verkleinert oder auf eine andere Geometrie umgerechnet. Die bisherige Zufallsgenerierung wird mit ihrer alten Parametrisierung weiterverwendet. Sechs Geometrie-Prüfsummen aus beiden alten Versionen wurden vor der Änderung erfasst und sind als Regressionstest hinterlegt. Sie umfassen Gelände, Kontrollpunkte, Grenzen, HQs und Anfangseinheiten. Alte Einkommen und Siegbedingungen bleiben an ihre Kartenversion gebunden.

Die Ladeprüfung erwartet die zur Version gehörige Sektoranzahl. Bau- und Heilaufträge, Produktionswarteschlangen, Besitz und Credits bleiben erhalten. Neue Spiele verwenden die neue Version; gespeicherte alte Kampagnen behalten ihre ursprüngliche Variante.

## Prüfung

```sh
npm run build
node --test tests/reborn-defense-map.test.mjs tests/reborn-campaign.test.mjs tests/reborn.test.mjs tests/reborn-support.test.mjs tests/reborn-overhaul.test.mjs
npm --prefix tests/browser test -- --grep 'defense map:|real worker placement|minimap drag, anchored zoom'
```

Der Kartenlauf prüft 100 Seeds mit Mindestabständen und tatsächlichen Fußwegen von beiden Starts zu allen Bastionen. Weitere Tests prüfen freie Bauflächen in jedem Sektor, gleiche Startchancen, sichere Spawns, KI-Eroberungen, Einkommen und Siegbedingungen sowie Speichern/Laden aller drei Varianten. Die Turmtests prüfen beide Fraktionen gegen Infanterie, Panzer und Luftziele in 500 Einheiten Entfernung, die exakte 600er-Grenze, Sicht bis 750, Nachladen, Mündungen und blockierte Schusslinien trotz gemeinsamer Sicht.

Die fünf ausgewählten Browserfälle prüfen den tatsächlichen lokalen Speicher mit alten und neuen Karten, die dynamische Sektorliste und Zielbeschreibung, neue Kampagnen, Eroberung und Einkommen, den exakten Radius des gezeichneten Kreises, Fernkampf neben Bastionen sowie bestehende Bau-/Reparatur- und Eingabebefehle.

Die vollständige projektweite Legacy-Testsuite wurde nicht ausgeführt.

## Betroffene Quellen

`src/reborn/config.ts`, `catalog.ts`, `world-generation.ts`, `world.ts`, `simulation.ts`, `renderer.ts`, `main.ts` und `index.html`; die neuen Tests `tests/reborn-defense-map.test.mjs`, `tests/browser/reborn-defense-map.spec.mjs`, die Geometrie-Prüfsummen unter `tests/fixtures/reborn-legacy-maps.json` sowie angepasste vorhandene Kampagnen-/Browsertests und diese Dokumentation.

Ergebnis: `npm run build` erfolgreich. 90 unterschiedliche gezielte Simulations-/Regressionstests bestanden (89 im kombinierten Lauf, ergänzt um die anschließende Prüfung der gespiegelten Produktionsausgänge; der Karten-/Fernverteidigungslauf besteht mit 24 Tests einschließlich 100 Seeds). Alle fünf ausgewählten Browserfälle bestanden; die Prüfung alter/neuer Spielstände wurde nach Ergänzung einer Wartebedingung für den Dialogabschluss und der sofortigen Sektornamenanzeige gezielt bestätigt. `git diff --check` ohne Befund. Keine bekannten offenen Fehler in den geprüften Abläufen.
