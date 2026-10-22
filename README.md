# ATLAS DOMINION — REBORN

Ein spielbares 2D-Wüsten-RTS mit den drei bereitgestellten Originalgrafiken. Eine zusammenhängende Karte, 30 Territorien, blaue und rote Fraktion, echte Erkundung, Einkommen, Infanterieproduktion und Echtzeitkampf.

## Lokal starten

```sh
npm install
npm run dev
```

Öffnen: **http://127.0.0.1:8095**. Ein neues Spiel startet sofort mit Hauptquartier, genau einem Soldaten, drei kontrollierten Gebieten und 500 Credits. Kein Account, keine externen Dienste und keine Downloads zur Laufzeit.

Die frühere Europaversion bleibt unter **http://127.0.0.1:8095/legacy/index.html** erreichbar. Ihre Quellen und bisherigen Änderungen bleiben erhalten; die bisherige Dokumentation liegt in [legacy/README.md](legacy/README.md).

## Spielen

- Linksklick wählt Soldaten oder das Hauptquartier. Ziehen markiert mehrere Soldaten; Doppelklick wählt sichtbare Infanterie.
- Rechtsklick bewegt oder greift einen sichtbaren Gegner an. Shift hängt Befehle an.
- **A**, dann Linksklick: Angriffsbewegung. **S**: Stoppen. Halten von A/S scrollt nach kurzem Antippen; WASD und Pfeile bewegen die Kamera.
- Mausrad zoomt am Zeiger. Minikarte klicken/ziehen verschiebt den Ausschnitt. **H**: Basis, **T**: Gebietsgrenzen.
- Einen angrenzenden Kontrollpunkt acht Sekunden halten. Feinde im Radius unterbrechen die Einnahme. Durchmarsch allein erobert nichts.
- Einkommen wird alle zehn Simulationssekunden gutgeschrieben. Hauptquartier: +10; Gebiete: +5, +15 oder +25 Credits. Das Hauptquartier produziert einen Soldaten für 100 Credits in fünf Sekunden. Rechtsklick setzt seinen Sammelpunkt.
- **Leertaste** pausiert. **F5 / F9** oder die Symbole oben speichern/laden in IndexedDB. Nach einem Browser-Neustart „Laden“ wählen. Das Wechseln in einen anderen Tab pausiert die Simulation.
- Sieg: feindliches Hauptquartier zerstören, seinen Kontrollpunkt sichern und alle drei roten Startgebiete kontrollieren. Niederlage: kein funktionsfähiges Hauptquartier und keine eigene Infanterie mehr.

**F1** öffnet das Feldhandbuch. Maus und Tastatur sind die vorgesehenen Eingabegeräte.

## Prüfen

```sh
npm run typecheck
npm run test:reborn    # 16 gezielte Simulationstests
npm test              # Gesamte Suite, einschließlich Archiv und HTTP
npm run test:browser   # Sechs Chrome-Tests für Gameplay, Grafik und Audio
```

Für Browser-Tests einmalig `npm ci --prefix tests/browser` ausführen. Chrome ist lokal voreingestellt; `ATLAS_BROWSER_CHANNEL=chromium` verwendet Playwright Chromium. Ein bereits laufender Server kann über `ATLAS_BASE_URL` angegeben werden.

[Architektur und Grenzen](docs/reborn/ARCHITECTURE.md) · [Prüfprotokoll](docs/reborn/QA.md)

## Technik und Assets

TypeScript, Canvas 2D, feste 20 Simulationsschritte pro Sekunde, A*, räumliche Buckets, getrennte Simulation/Darstellung/Eingabe/Speicherung. Die neue Architektur liegt vollständig in `src/reborn/`. Sie benötigt keine zusätzlichen Laufzeitbibliotheken. Spielwerte und Asset-Pfade stehen in `src/reborn/config.ts`.

Die Original-PNGs bleiben unverändert in `src/assets/reborn/`: `desert.png`, `infantry.png`, `headquarters.png`. Die feinere Terrainfassung liegt in `desert-fine.png`, der transparente Laufatlas in `infantry-walk.png`. Die Bastion wird aus `src/assets/reborn/bastion.png` geladen und je Besitzer blau, rot oder unbeleuchtet dargestellt. Der Laufatlas kombiniert 32 Posen mit kontinuierlicher Beinbewegung; die Füße sind am Boden verankert. Künstliche Bodenschatten werden nicht gezeichnet.

Der Boden trennt großräumiges Relief und feine Sandstruktur. Hügel und Felsen bleiben an ihren Kartenpositionen und blockieren das feinere Navigationsraster. Angegriffene Infanterie erwidert das Feuer auch während eines Marschbefehls und setzt danach ihren ursprünglichen Weg fort. Der Soundregler oben bietet Schüsse, Schritte, Funkbestätigungen und Wüstenwind; Ton startet mit der ersten Interaktion.

[Bildquellen und Generierungsprompts](docs/reborn/ART_ASSETS.md)

Die Bastion ist derzeit eine erzeugte Nachbildung im passenden Stil, da macOS die Originaldatei im Downloads-Ordner nicht freigibt. Zum Einsetzen des Originals genügt das Ersetzen von `src/assets/reborn/bastion.png` und ein erneuter Build.

Docker bleibt verfügbar: `docker compose up --build`. Der veröffentlichte Port ist lokal auf `127.0.0.1:8095` begrenzt.
