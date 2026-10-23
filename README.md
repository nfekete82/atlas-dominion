# ATLAS DOMINION — REBORN

Ein lokales Wüsten-RTS mit neun Einheitentypen, 30 eroberbaren Territorien und einer aktiven gegnerischen KI. Die Oberfläche folgt der Bildvorlage: Ressourcen oben links, Radar, Einheitenkatalog und Produktion rechts, kompakte Auswahl direkt links unten sowie ein zentrales Pausenmenü mit Metallrahmen.

## Starten

```sh
npm install
npm run dev
```

**http://127.0.0.1:8095** — oder `docker compose up --build -d`. Der Docker-Port ist auf `127.0.0.1` begrenzt. Keine Accounts, Cloud-Dienste oder Downloads zur Spielzeit. Start: 500 Credits, ein Soldat, Hauptquartier und drei eigene Sektoren. Bestehende Spielstände bleiben ladbar.

## Spielen

- Linksklick: Einheit oder Gebäude wählen. Ziehen: Gruppe markieren. Doppelklick: sichtbare eigene Truppen markieren.
- Rechtsklick: bewegen oder ein sichtbares Ziel angreifen. Shift: Befehle anhängen. **A**: Angriffsbewegung, **S**: halten. Soldaten und Fahrzeuge eröffnen in Waffenreichweite selbstständig das Feuer und setzen danach ihren Auftrag fort.
- WASD/Pfeile und Bildschirmrand bewegen die Kamera; Mausrad zoomt am Zeiger. Radar klicken/ziehen bewegt den Ausschnitt. **H**: Hauptquartier, **T**: Sektorgrenzen.
- Der Gebäudebau ist vorerst aus der Oberfläche entfernt. Hauptquartier und eroberbare Bastionen bleiben als Ausgangspunkt und Spielziele erhalten. Bestehende Spielstände mit weiteren Anlagen bleiben kompatibel.
- Die acht Produktionsplätze rechts unter dem Einheitenkatalog zeigen echte Aufträge. Ein Klick auf einen belegten Platz storniert genau diesen Auftrag mit voller Kostenerstattung. Der Fortschritt eines anderen laufenden Auftrags bleibt erhalten.
- **Einheiten** im rechten Katalog beauftragen das Hauptquartier. Alle neun Typen stehen ohne zusätzliche Gebäude zur Verfügung; Kosten, Produktionszeit, Kapazität und verfügbare Credits gelten weiterhin.
- Angrenzende Bastion acht Sekunden mit Bodentruppen halten. Feinde im Radius unterbrechen die Einnahme. Eigene Bastionen geben dauerhaft 320 Meter Sicht; bei Verlust endet ihre Sicht. Felsen begrenzen Bodensicht und Schusslinien. Fluggeräte überfliegen Felsen, können aber keine Bastionen sichern.
- Einkommen kommt alle zehn Simulationssekunden. **Leertaste**: taktische Pause. Zahnrad oder Esc ohne Auswahl: Spielmenü. **F5/F9** speichern/laden lokal in IndexedDB. Vor einem Seiten-Neuladen speichern und anschließend laden.
- Sieg: gegnerisches Hauptquartier zerstören, seinen Kontrollpunkt sichern und alle drei roten Startgebiete kontrollieren. Niederlage: keine Produktionsstätte und keine eigene Truppe mehr.

Die neun Truppen kosten 100/150/250 Credits für Infanterie, Pionier und schweren Schützen; 300/450/600 für Spähwagen, Panzer und Artillerie; 600/750/1000 für Spähheli, Kampfheli und Bomber. Pioniere reparieren nahe eigene Gebäude. Fahrzeuggrößen und Wege berücksichtigen ihre unterschiedliche Bodenfreiheit.

## Prüfen

```sh
npm run typecheck
npm run test:reborn    # 29 gezielte Simulationstests
npm test              # 401 Tests einschließlich Archiv und HTTP
npm run test:browser   # 13 Chrome-Fälle: Spielablauf, kompakte Oberfläche, Produktion, Menüs, Sicht, Audio
```

Browser-Abhängigkeiten: `npm ci --prefix tests/browser`. Chrome ist voreingestellt; `ATLAS_BROWSER_CHANNEL=chromium` verwendet Playwright Chromium. `ATLAS_BASE_URL` prüft einen bestehenden Server.

[Prüfprotokoll und Bilder](docs/reborn/QA.md) · [Architektur und Grenzen](docs/reborn/ARCHITECTURE.md) · [Bildquellen und Imagegen-Prompts](docs/reborn/ART_ASSETS.md)

## Technik und Grafik

TypeScript, Canvas 2D, feste 20 Simulationsschritte pro Sekunde, A*, räumliche Buckets und IndexedDB. Spielwerte stehen in `src/reborn/config.ts`, Einheiten und Gebäude in `src/reborn/catalog.ts`. Keine zusätzliche Laufzeitbibliothek.

Neue hochauflösende Einzelgrafiken ersetzen die vergrößerten Felsflächen. Ihre Alpha-Konturen bestimmen Bewegung und Sicht; `node scripts/compile-terrain-art.mjs` erzeugt daraus die deterministischen Masken. Feiner Boden wird separat aufgebaut. Gebäude werfen gerichtete, am Fundament anliegende Silhouettenschatten; es gibt keine schwebenden Schattenellipsen. Bastionen leuchten neutral weiß, blau oder rot.

Die Originalgrafiken bleiben erhalten. Die Bastion ist weiterhin eine erzeugte Nachbildung, da die benannte Originaldatei im Downloads-Ordner nicht zugänglich war. Die Infanterie teilt einen Richtungsatlas; Fahrzeuge nutzen gespiegelte Ansichten. Die KI expandiert und kämpft weiterhin mit Infanterie. Maus und Tastatur bilden die vollständige Steuerung; kein dediziertes Touch- oder Mehrspielersystem.

Die frühere Europaversion bleibt unter **http://127.0.0.1:8095/legacy/index.html** erreichbar. Ihre Quellen und vorhandenen Änderungen bleiben erhalten; ihre Dokumentation liegt in [legacy/README.md](legacy/README.md).
