# Sanitäter, Bauarbeiter und Kontextauswahl

Leere Linksklicks heben die Auswahl auf und verbergen das gesamte linke Kontextpanel. Die beiden globalen Auswahltasten sowie Einheitenkatalog und Produktion bleiben bedienbar. Gebäudeaktionen arbeiten auf dem gezielt ausgewählten Gebäude; der Produktions-Fallback ist davon getrennt.

- Sanitäter (`medic`): 100 LP, 175 Credits, 8 s. Teilt insgesamt bis zu 12 LP/s auf eigene verletzte Infanterie einschließlich anderer Sanitäter im Radius von 70 Welteinheiten auf. Explizite Ziele werden angelaufen; automatische Heilung verfolgt niemanden. Selbstheilung erhält höchstens 3 LP/s, wartet nach Beschuss fünf Sekunden und entfällt, solange andere nahe Infanteristen unter 50 % Gesundheit liegen. Niemand wird über seine maximalen LP geheilt. In gemischten Formationen bleiben sie hinten und rücken bei Angriffsbewegung begrenzt zur Heilung nach.
- Bauarbeiter (weiterhin `engineer`): 110 LP, 200 Credits. Repariert nach dem Anlaufen mit 12 LP/s ohne Zusatzkosten. Die alte passive Reparaturschleife entfällt; untätige Arbeiter helfen weiterhin beschädigten Gebäuden in Reichweite.
- Beide tragen Pistolen mit 4 Schaden, 110 Reichweite und 1,8 s Schussintervall. Sie greifen auf expliziten Befehl oder zur Abwehr eines direkten Angreifers an. Automatische Verfolgung entfällt. Heilen hat Vorrang; angegriffene Bauarbeiter unterbrechen ihre Arbeit für die bestehende 5-s-Verteidigungsphase.
- „Bauen“ bietet Geschützturm (175 Credits / 10 s) und Kaserne (200 Credits / 12 s). Die Platzvalidierung prüft die Erkundung der gesamten Grundfläche, Felsen, Gebäude, Bastionen, Einheiten, Limit und Credits. Eigene, neutrale und gegnerische Gebiete sowie bereits erforschter Kriegsnebel sind bebaubar; Gebietseigentum bleibt dabei erhalten. Rot/grün markiert die Vorschau. Linksklick beauftragt und bezahlt einmal; Esc/Rechtsklick beendet nur die Platzierung.
- Baustellen benötigen zugewiesene lebende Arbeiter in Reichweite. Tod, Wegbewegen oder Stoppen pausiert. Rechtsklick eines anderen Arbeiters auf die Baustelle setzt fort. Ein Arbeiter arbeitet mit 1×, zwei oder mehr mit höchstens 1,5×. Abbrechen erstattet einmalig 75 % der Gebäudekosten. Zerstörte Baustellen erstatten nichts.
- Fertige Kasernen produzieren die vier Infanterietypen über die bestehende bezahlte Warteschlange und unterstützen Sammelpunkte. Das HQ behält alle zehn Einheiten.
- Aufträge referenzieren Ziel-IDs und bleiben in Spielständen der Version 2 erhalten. Alte `engineer`-Einheiten bleiben gültig; bestehende unbeaufsichtigte Baustellen warten auf einen Bauarbeiter. Produktionskosten werden pro Auftrag gespeichert; alte Bauarbeiter-Aufträge erstatten weiterhin ihre damaligen 150 Credits.

## Assets reproduzieren

```sh
node scripts/export-detailed-infantry.mjs --support
```

Der vorhandene Three.js-/Chrome-Exporter nutzt das lokale CC0-Infanterieskelett und die prozedurale Wüstenausrüstung. Er exportiert für `medic` und `engineer` jeweils beide Fraktionen nach `src/assets/reborn/prototype/{medic,engineer}-{0,1}.{glb,png,json}`. Beide behalten fünf Animationszustände, acht Blickrichtungen und 296 Atlasframes. Medizinische Rucksäcke/Kreuze beziehungsweise Werkzeugtasche/Schraubenschlüssel und kompakte Pistolen unterscheiden die Rollen. Bestehende Infanterieassets werden mit `--support` nicht überschrieben. Der vollständige Export erzeugt inzwischen auch die eigene schwere Infanterie und die stärkeren Fraktionsmaterialien (siehe `docs/reborn-overhaul.md`).

## Gezielte Prüfung

```sh
npm run build
node --test tests/reborn-support.test.mjs tests/reborn.test.mjs tests/reborn-campaign.test.mjs tests/reborn-animation.test.mjs tests/reborn-buildings.test.mjs
npm --prefix tests/browser test -- reborn-support.spec.mjs
```

Die Browsertests verwenden echte Klicks für Auswahl, Heilziel, Platzierung, Abbruch, Kasernenproduktion, Sammelpunkt und Reparatur. Testdaten werden über die vorhandene Debug-Schnittstelle vorbereitet; die Simulationsuhr läuft deterministisch. Screenshots liegen unter `tests/browser/artifacts/reborn/`.

Prüfergebnis: `npm run build` erfolgreich; 75/75 gezielte Simulations-, Kampagnen-, Animations- und Gebäudetests bestanden. 4/4 Browsertests bestanden (die drei Support-Szenarien und die vorhandene Maus-/Minikarten-/Kamerasteuerung). `git diff --check` ohne Befund. Das gesamte projektweite Legacy-Testpaket wurde nicht ausgeführt.

## In diesem Auftrag geänderte Dateien

- Oberfläche/Simulation: `index.html`, `src/reborn/catalog.ts`, `src/reborn/simulation.ts`, `src/reborn/main.ts`, `src/reborn/input.ts`, `src/reborn/renderer.ts`, `src/reborn/style.css`, `src/reborn/asset-paths.ts`, `src/reborn/icons.ts`.
- Generatoren: `scripts/animation/detailed-infantry.js`, `scripts/animation/detailed-export.js`, `scripts/export-detailed-infantry.mjs`.
- Neue Assets: die zwölf Dateien `src/assets/reborn/prototype/{medic,engineer}-{0,1}.{glb,png,json}`.
- Tests: `tests/reborn-support.test.mjs` (neu), `tests/reborn.test.mjs`, `tests/reborn-animation.test.mjs`, `tests/browser/reborn-support.spec.mjs` (neu), `tests/browser/reborn.spec.mjs`, `tests/browser/reborn.config.mjs`.
- Dokumentation: `docs/reborn-support.md` (diese Datei).

Die bereits vorhandenen lokalen Änderungen an Bastionen, Gebäudepräsentation, Einheitenpräsentation und weiteren Dateien bleiben erhalten. Es wurden keine Stashes verändert und keine Änderungen gepusht.
