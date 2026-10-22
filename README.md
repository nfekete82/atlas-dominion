# ATLAS DOMINION — REBORN

Ein lokales Wüsten-RTS mit Basisbau, neun Einheitentypen, 30 eroberbaren Territorien und einer aktiven gegnerischen KI. Die Oberfläche folgt der Bildvorlage: Ressourcen oben links, Radar und Baukatalog rechts, Auswahl und Produktion unten sowie ein zentrales Pausenmenü mit Metallrahmen.

## Starten

```sh
npm install
npm run dev
```

**http://127.0.0.1:8095** — oder `docker compose up --build -d`. Der Docker-Port ist auf `127.0.0.1` begrenzt. Keine Accounts, Cloud-Dienste oder Downloads zur Spielzeit. Start: 500 Credits, ein Soldat, Hauptquartier und drei eigene Sektoren. Bestehende Spielstände bleiben ladbar.

## Spielen und bauen

- Linksklick: Einheit oder Gebäude wählen. Ziehen: Gruppe markieren. Doppelklick: sichtbare eigene Truppen markieren.
- Rechtsklick: bewegen oder ein sichtbares Ziel angreifen. Shift: Befehle anhängen. **A**: Angriffsbewegung, **S**: halten. Soldaten und Fahrzeuge eröffnen in Waffenreichweite selbstständig das Feuer und setzen danach ihren Auftrag fort.
- WASD/Pfeile und Bildschirmrand bewegen die Kamera; Mausrad zoomt am Zeiger. Radar klicken/ziehen bewegt den Ausschnitt. **H**: Hauptquartier, **T**: Sektorgrenzen.
- Rechter Katalog **Gebäude** oder **B**: Bauwerk wählen und mit Linksklick platzieren. Die vollständige Grundfläche muss frei, sichtbar und im eigenen Gebiet liegen. Gebäude, Bastionen, Felsen und Bodenfahrzeuge blockieren den Bauplatz. Rechtsklick oder Esc bricht die Vorschau kostenlos ab.
- Gebäude werden in Simulationszeit gebaut. Erst danach produzieren sie Einheiten beziehungsweise Einkommen. Abbrechen einer Baustelle erstattet 75 %; ein stornierter Produktionsauftrag seinen vollständigen Preis. Die fünf Produktionsplätze unten zeigen echte Aufträge und lassen sich einzeln stornieren.
- **Einheiten** im rechten Katalog beauftragen die passende eigene Produktionsstätte. Die Icons zeigen Kosten; der Tooltip nennt Voraussetzungen und Bauzeit. Das Hauptquartier und die Kaserne bilden Infanterie/Pioniere aus, schwere Infanterie benötigt die Kaserne, Fahrzeuge die Fabrik, Fluggeräte das Flugfeld.
- Angrenzende Bastion acht Sekunden mit Bodentruppen halten. Feinde im Radius unterbrechen die Einnahme. Eigene Bastionen geben dauerhaft 320 Meter Sicht; bei Verlust endet ihre Sicht. Felsen begrenzen Bodensicht und Schusslinien. Fluggeräte überfliegen Felsen, können aber keine Bastionen sichern.
- Einkommen kommt alle zehn Simulationssekunden. **Leertaste**: taktische Pause. Zahnrad oder Esc ohne Auswahl: Spielmenü. **F5/F9** speichern/laden lokal in IndexedDB. Vor einem Seiten-Neuladen speichern und anschließend laden.
- Sieg: gegnerisches Hauptquartier zerstören, seinen Kontrollpunkt sichern und alle drei roten Startgebiete kontrollieren. Niederlage: keine Produktionsstätte und keine eigene Truppe mehr.

| Gebäude | Credits | Bauzeit | Wirkung |
| --- | ---: | ---: | --- |
| Kaserne | 200 | 12 s | Infanterie, Pioniere und schwere Infanterie |
| Fahrzeugfabrik | 350 | 18 s | Spähwagen, Kampfpanzer, Artillerie |
| Flugfeld | 450 | 22 s | Spähheli, Kampfheli, Bomber |
| Energiekern | 150 | 9 s | +10 Credits / 10 s nach Fertigstellung |
| Geschützturm | 175 | 10 s | Selbstständige Verteidigung auf 300 m |

Die neun Truppen kosten 100/150/250 Credits für Infanterie, Pionier und schweren Schützen; 300/450/600 für Spähwagen, Panzer und Artillerie; 600/750/1000 für Spähheli, Kampfheli und Bomber. Pioniere reparieren nahe eigene Gebäude. Fahrzeuggrößen und Wege berücksichtigen ihre unterschiedliche Bodenfreiheit.

## Prüfen

```sh
npm run typecheck
npm run test:reborn    # 28 gezielte Simulationstests
npm test              # 400 Tests einschließlich Archiv und HTTP
npm run test:browser   # 13 Chrome-Fälle: Spielablauf, Bau, Produktion, Menüs, Sicht, Audio
```

Browser-Abhängigkeiten: `npm ci --prefix tests/browser`. Chrome ist voreingestellt; `ATLAS_BROWSER_CHANNEL=chromium` verwendet Playwright Chromium. `ATLAS_BASE_URL` prüft einen bestehenden Server.

[Prüfprotokoll und Bilder](docs/reborn/QA.md) · [Architektur und Grenzen](docs/reborn/ARCHITECTURE.md) · [Bildquellen und Imagegen-Prompts](docs/reborn/ART_ASSETS.md)

## Technik und Grafik

TypeScript, Canvas 2D, feste 20 Simulationsschritte pro Sekunde, A*, räumliche Buckets und IndexedDB. Spielwerte stehen in `src/reborn/config.ts`, Einheiten und Gebäude in `src/reborn/catalog.ts`. Keine zusätzliche Laufzeitbibliothek.

Neue hochauflösende Einzelgrafiken ersetzen die vergrößerten Felsflächen. Ihre Alpha-Konturen bestimmen Bewegung und Sicht; `node scripts/compile-terrain-art.mjs` erzeugt daraus die deterministischen Masken. Feiner Boden wird separat aufgebaut. Gebäude werfen gerichtete, am Fundament anliegende Silhouettenschatten; es gibt keine schwebenden Schattenellipsen. Bastionen leuchten neutral weiß, blau oder rot.

Die Originalgrafiken bleiben erhalten. Die Bastion ist weiterhin eine erzeugte Nachbildung, da die benannte Originaldatei im Downloads-Ordner nicht zugänglich war. Die Infanterie teilt einen Richtungsatlas; Fahrzeuge nutzen gespiegelte Ansichten. Die KI expandiert und kämpft weiterhin mit Infanterie. Maus und Tastatur bilden die vollständige Steuerung; kein dediziertes Touch- oder Mehrspielersystem.

Die frühere Europaversion bleibt unter **http://127.0.0.1:8095/legacy/index.html** erreichbar. Ihre Quellen und vorhandenen Änderungen bleiben erhalten; ihre Dokumentation liegt in [legacy/README.md](legacy/README.md).
