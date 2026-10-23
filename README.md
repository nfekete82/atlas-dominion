# ATLAS DOMINION — REBORN

Ein lokales Wüsten-RTS mit neun Einheitentypen, 30 eroberbaren Territorien und einer aktiven gegnerischen KI. Die Oberfläche folgt der vereinfachten Bildvorlage mit ruhigen dunklen Flächen und dezenten Akzenten: Ressourcen oben links, Radar, Einheitenkatalog und Produktion rechts, kompakte Auswahl direkt links unten sowie ein zentrales Pausenmenü mit Metallrahmen.

## Starten

```sh
npm install
npm run dev
```

**http://127.0.0.1:8095** — oder `docker compose up --build -d`. Der Docker-Port ist auf `127.0.0.1` begrenzt. Keine Accounts, Cloud-Dienste oder Downloads zur Spielzeit. Start: 500 Credits, ein Soldat, Hauptquartier und drei eigene Sektoren. Jeder neue Spielstart erzeugt zufälliges Gelände und verteilt die Bastionen mit mindestens 440 Welteinheiten Abstand. Alle Bastionen sind zu Fuß erreichbar. Laden stellt die gespeicherte Karte wieder her; bestehende Spielstände bleiben ladbar.

## Spielen

- Linksklick: Einheit oder Gebäude wählen. Ziehen: Gruppe markieren. Doppelklick: sichtbare eigene Truppen markieren.
- Rechtsklick: bewegen oder ein sichtbares Ziel angreifen. Shift: Befehle anhängen. **A**: Angriffsbewegung, **S**: halten. Soldaten und Fahrzeuge erfassen sichtbare Gegner im nächsten Simulationstakt, halten ihren Gegner im Gefecht und wechseln erst danach zum nächsten gültigen Ziel. Anschließend setzen sie ihren Auftrag fort.
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
npm run test:reborn    # 37 gezielte Simulationstests, einschließlich 100 Zufallskarten
npm run test:animation # 11 gezielte Animations-/Bewegungs-/Gebäudemodelltests
npm test              # einschließlich Archiv und HTTP
npm run test:browser   # Chrome: Spielablauf, Oberfläche, Produktion, Menüs, Sicht, Audio, Animationslabor
```

Browser-Abhängigkeiten: `npm ci --prefix tests/browser`. Chrome ist voreingestellt; `ATLAS_BROWSER_CHANNEL=chromium` verwendet Playwright Chromium. `ATLAS_BASE_URL` prüft einen bestehenden Server.

[Prüfprotokoll und Bilder](docs/reborn/QA.md) · [Architektur und Grenzen](docs/reborn/ARCHITECTURE.md) · [Bildquellen und Imagegen-Prompts](docs/reborn/ART_ASSETS.md)

## Technik und Grafik

TypeScript, Canvas 2D, feste 20 Simulationsschritte pro Sekunde, A*, räumliche Buckets und IndexedDB. Spielwerte stehen in `src/reborn/config.ts`, Einheiten und Gebäude in `src/reborn/catalog.ts`. Keine zusätzliche Laufzeitbibliothek.

Neue Kampagnen verwenden native facettierte Mesas, fein texturierten Sand mit Windrippen, kleinen Steinen und dekorativen blauen Kristallen nach der neuen Landschaftsvorlage. Gelände und Navigation werden gemeinsam aus dem Kartenseed erzeugt. Alte Spielstände behalten die frühere Landschaft samt Alpha-Konturen. [Zufallskarten, Zielbindung, Fahrzeugmodelle und Prüfung](docs/reborn/RANDOM_CAMPAIGNS.md). Die freigegebene Legionär-Figur und sieben eigene Gebäudetypen werden aus zusammengehörigen 3D-Modellen mit fest integrierten Schatten gerendert. Basis und Bastion blinken dezent und drehen ihre Schüsseln in 48 Sekunden. Leichte Sandverwehungen ziehen über sichtbaren freien Boden; alle Effekte stehen bei Pause still. Bastionen besitzen eigene neutral weiße, blaue und rote Modellfassungen.

Die freigegebene Infanterie verwendet echte Idle-/Walk-/Attack-/Hit-/Death-Clips: acht Ansichten mit acht unterschiedlichen Laufphasen je Richtung. Sechs eigene Fahrzeugmodelle übernehmen Keramik, Bronze, dunklen Stahl und Teamfarben der Modellfamilie. Sie besitzen 16 gerenderte Ansichten, echte Rad-/Ketten-/Rotorphasen und begrenzte Lenkgeschwindigkeit. Panzer und Artillerie besitzen getrennte Rümpfe, Türme und Rohre. Der Canvas-Renderer deformiert oder dreht keine vollständigen Einheitensprites. Partikel sind unter Optionen abschaltbar. Three.js wird zum Offline-Export und im separaten 3D-Modellinspektor verwendet; das Hauptspiel bleibt Canvas 2D.

Das [Animationslabor](http://127.0.0.1:8095/animation-lab.html) zeigt sechs Prüfabläufe gleichzeitig mit der aktuell aktiven Infanterie. [Animationssystem, Quellen und konkrete Asset-Grenzen](docs/reborn/ANIMATION_SYSTEM.md) dokumentieren die Entwicklung; alte generierte Bilder und die ersten einfachen Figuren bleiben archiviert. Die KI expandiert und kämpft weiterhin mit Infanterie. Maus und Tastatur bilden die vollständige Steuerung; kein dediziertes Touch- oder Mehrspielersystem.

Der freigegebene Legionär ist im Spiel aktiv und bildet die gemeinsame Grundrüstung von Infanterie, Pionier und schwerem Schützen. Die [3D-Modellgalerie](http://127.0.0.1:8095/model-3d.html?model=headquarters) enthält ihn und alle sieben Gebäudetypen mit echten Animationen, Teamfarben und GLB-Downloads. [Sprite-Vergleich](http://127.0.0.1:8095/model-preview.html), [Übernahme und Gebäudemodelle](docs/buildings-3d/README.md). Die fünf zusätzlich erhaltenen Gebäudetypen bleiben für alte Spielstände verfügbar; der Gebäudebau wird nicht wieder in die Oberfläche aufgenommen.

Die frühere Europaversion bleibt unter **http://127.0.0.1:8095/legacy/index.html** erreichbar. Ihre Quellen und vorhandenen Änderungen bleiben erhalten; ihre Dokumentation liegt in [legacy/README.md](legacy/README.md).

[Sandtextur, vereinfachtes HUD und Gegenwehr unter Beschuss](docs/reborn/SAND_HUD_V2.md).

Gruppenformationen sind auf dem tatsächlichen Ziel zentriert. Ein Rechtsklick auf Bastionsturm, Sockel oder Beschriftung führt die Truppen zum Einnahmepunkt; mehrere eigene Bodeneinheiten können gemeinsam eine Bastion sichern. Getrennte Gruppen können mehrere angrenzende Bastionen parallel einnehmen.
