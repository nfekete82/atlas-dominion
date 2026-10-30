# HQ-Aufbaustart und Radarfreischaltung · 30.10.2026

Basis: `fix/sandforge-static-props-stay-visible-20261030` / `7d403e1`. Feature-Branch: `feat/sandforge-hq-bootstrap-radar-offline-20261030`.

[Matchstart mit Radarrauschen](radar-offline-start.png) · [Tatsächlich errichtetes HQ mit aktivem Radar](radar-online-hq.png) · [Prüfbericht](validation.json)

## Verhalten

Neue Kampagnen starten für jede Fraktion mit genau einem Infanteriesoldaten und einem Pionier, ohne Gebäude. Der eigene Pionier wird zu Beginn ausgewählt; Kamera/Home orientieren sich ohne HQ am Pionier beziehungsweise der überlebenden eigenen Einheit. Alte Konstruktor-/Spielstandaufbauten behalten vorhandene HQs.

Das erste HQ kostet **300 Credits** und benötigt **20 Sekunden aktive Pionierarbeit**, zuzüglich Anfahrt. Damit ist es auf allen bisherigen Startbudgets sofort finanzierbar. Die großzügige Startregion hat einen Radius von `min(600, Kartengröße / 6)` um den bisherigen sicheren Startanker. Ihr Umriss erscheint während der HQ-Platzierung. Die Position ist frei wählbar; die gesamte physische HQ-Grundfläche muss innerhalb der Region und auf freiem, bereits erforschtem Terrain liegen. Die vorhandenen Prüfungen für Felsen, Kartenränder, Bastionen, andere Gebäude, Einheiten und erreichbare Arbeiter gelten weiterhin. Es gibt keinen fest vorgeschriebenen Baupunkt.

Vor einem fertiggestellten eigenen HQ steht ausschließlich das HQ im Baumenü. Eine zweite lebende HQ-Baustelle ist ausgeschlossen. Reguläre Gebäude und Rekrutierung sind auch über die Simulations-API gesperrt. Aufträge, Abbruch mit bestehender 75-%-Erstattung, Wiederaufnahme und Baufortschritt verwenden vollständig `Simulation.build`, vorhandene Pionieraufträge und die reguläre Bauschleife. HQ-Bauvorschau und Baustelle unterstützen dieselbe gespiegelte Ausrichtung und den unveränderten R-Hinweis.

Das Radar zeigt ausschließlich animiertes weiß-graues Signalrauschen mit **„RADAR OFFLINE“** und **„Errichte ein Hauptquartier“**. Vor dem HQ verlassen weder Terrain, Fog, Einheiten, Gebäude, Gegner, Angriffspunkte noch Kamerarechteck den Offline-Renderpfad. Die Rauschfunktion erhält überhaupt keinen Spiel- oder Kartenzustand. Auch Radarbeschriftung und Minimap-Eingaben sind gesperrt. Kamera per Tastatur/Weltansicht, Bewegung, Kampf und normaler Fog of War funktionieren weiter. Reduzierte Bewegung friert das Rauschen ein.

Erst wenn aktive Pionierarbeit das HQ wirklich fertigstellt, werden Radar und reguläre Basisfunktionen automatisch aktiviert. Genau einmal entsteht **„Hauptquartier errichtet. Radar online.“**, über die vorhandene Fertigmeldungsdarstellung und deren Audiosignal. Ein pausierter Bau, Platzieren oder Laden einer unfertigen Baustelle genügt nicht. Ohne lebendes fertiges HQ gilt in diesen neuen Kampagnen weiterhin die Aufbausperre.

Die KI plant ihren HQ-Aufbau bereits im normalen 3-Sekunden-Takt vor der bisherigen offensiven Eröffnungsverzögerung. Sie sucht deterministische Kandidaten in ihrer eigenen Startregion, verwendet ausschließlich die reguläre Bezahl-/Bau-/Erreichbarkeitsprüfung und setzt unterbrochene Arbeiteraufträge wieder fort. Falls nötig erkundet der Pionier weitere Startflächen. Nach Fertigstellung läuft dieselbe vorhandene Tactical AI weiter. Es gibt keine kostenlosen KI-Gebäude und keine zweite Baufortschrittslogik.

Ohne fertiges HQ und ohne lebenden Pionier endet die Partie für die betroffene Fraktion, auch wenn der Soldat noch lebt oder eine unfertige Baustelle übrig ist. Der Spieler erhält eine verständliche Niederlage; beim entsprechenden gegnerischen Verlust gewinnt er. Ein fertiges HQ kann einen verlorenen Pionier regulär ersetzen. Der Siegtest verhindert außerdem einen unbeabsichtigten Sofortsieg durch eine leere HQ-Liste.

## Spielstände und bestehende Systeme

Die Save-Hülle bleibt Version 2. Nur neue Aufbauspiele erhalten das optionale Merkmal `bootstrapVersion: 1`. Damit sind auch null beziehungsweise eine HQ-Baustelle gültige Speicherzustände. Vorhandene Saves ohne dieses Merkmal behalten ihre bisherigen HQs, Radarfunktion und Migrationen. Startregionen werden aus Seed/Kartenversion rekonstruiert und nicht aus gespeicherten Koordinaten übernommen. Beim Laden entstehen keine kostenlosen HQs oder zusätzlichen Starteinheiten.

GLBs, PBR-/Sprite-Assets, Prop-Sichtbarkeit bei Einheitenkontakt, Kollisions-/Navigationsalgorithmen, Terrain-Generierung und Bauausrichtung bleiben unverändert. Die Atmosphärenplatzierung berücksichtigt auch die ursprünglichen Startanker ohne vorgefertigtes HQ. Tests über Produktion und etablierte Kartenaufbauten verwenden nun ausdrücklich bestehende HQ-Fixtures oder errichten sie mit echten Arbeiteraufträgen; der neue Start selbst wird separat vollständig geprüft.

## Prüfung

- `npm run build`: erfolgreich.
- [Gezielte Node-Auswahl](targeted-node-tests.txt): **61 bestanden, 0 fehlgeschlagen**. Startaufstellung, große gültige Regionen, echte bezahlte HQ-Bauten, Baupausen/Wiederaufnahme, genau einmalige Meldung, Produktionsfreischaltung, Niederlage ohne Pionier, KI, neue/alte Saves, Noise ohne Informationszugriff, normale Kollisionen, statische Props, Bauausrichtung und bestehende Fertigmeldungen.
- [Vollständige Node-Suite](full-node-tests.txt): **945 Tests: 943 bestanden, 1 fehlgeschlagen, 1 übersprungen**. Auch der lokale HTTP-Test besteht bei erlaubtem Serverstart.
- Der einzige Fehlschlag ist unabhängig: `tests/reborn-palm-knockdown.test.mjs` / „occupied tree slots hide …“ erwartet nach wie vor ein verschwundenes Sprite bei Einheitenkontakt (`0`), während die ausdrücklich gewählte Basis statische Palmen sichtbar hält (`1`). [Derselbe Fehler im unveränderten Ausgangsstand](baseline-palm-failure.txt). Test und Sichtbarkeitslogik wurden nicht umgebaut. Der übersprungene Test betrifft eine bereits fehlende Premium-Infanterie-Binärversion.
- [Playwright](browser-tests.txt): **13 bestanden, 0 fehlgeschlagen**. Start ohne HQ; ausschließlich HQ im Baumenü; animiertes Rauschen und gesperrte Radareingaben; echte gespiegelte Platzierung; keine Freischaltung während Baupause; fertiges HQ mit Radar/Meldung; KI-Start; IndexedDB vor/während/nach Aufbau; Niederlage vor/während HQ-Bau; alter HQ-Spielstand; kompakte Darstellung und Tastaturkamera; bestehende Bauausrichtung, Atmosphäre und Produktion.
- Zusätzlicher deterministischer Stresstest: **100 von 100** KI-HQs auf Kartenversionen 11–14 innerhalb von 50 Simulationssekunden fertiggestellt. Seeds: `imul(i + 1337, 2654435761) >>> 0`, Version: `[11,12,13,14][i % 4]`, `i = 0…99`.
- Browserbilder wurden geöffnet und visuell geprüft.

## Lokal prüfen und Docker aktualisieren

```sh
npm run build
node --test tests/reborn-hq-bootstrap.test.mjs tests/reborn-production.test.mjs tests/reborn-defense-map.test.mjs tests/reborn-campaign.test.mjs tests/reborn-production-ready-notifications.test.mjs tests/reborn-building-orientation.test.mjs tests/reborn-navigation-clearance.test.mjs tests/reborn-static-props-visibility.test.mjs tests/savegame.test.mjs
node --test tests/*.test.mjs
npm --prefix tests/browser test -- --grep 'HQ opening|construction: R|production: worker|production: real factory|production: full queues|Atmosphere 1.0'
```

```sh
cd ~/Projects/sandforge-bastion-wars
docker compose up -d --build
```

Der bestehende lokale Dienst bleibt unter `http://127.0.0.1:8095` erreichbar. Docker wurde für diese Aufgabe nicht neu gestartet.
