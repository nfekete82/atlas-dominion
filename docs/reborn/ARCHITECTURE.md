# Reborn / Architektur

Die alte Europasimulation wird vom neuen Einstiegspunkt nicht importiert. `legacy/index.html`, `legacy/style.css` und `legacy/README.md` archivieren die bisherige Oberfläche und Dokumentation. Die bisherigen TypeScript-Module bleiben an ihrem Ort, damit vorhandene Arbeit, Tests und Git-Historie erhalten bleiben.

| Datei | Aufgabe |
| --- | --- |
| `src/reborn/config.ts` | Zentrale Spielwerte, Asset-Pfade und gemeinsame Typen |
| `world.ts` | 3762 × 3762 Weltkoordinaten, 240 × 240 Navigationsraster, vollständige Hügelkonturen mit Körperabstand, A* mit Heap und Pfadglättung, 30 Territorien |
| `simulation.ts` | Feste 50-ms-Schritte, Wirtschaft, Bewegung, Kollisionsauflösung, Sicht, Kampf, Eroberung, Produktion, KI, Sieg/Niederlage, Save-Schema |
| `renderer.ts` | Canvas-2D-Sprites, Tiefensortierung, Kamera, Nebeltextur, Radar, Befehlsmarkierungen |
| `input.ts` | Bildschirm-/Weltkoordinaten, Auswahl, Befehle, Tastatur, Kameraränder und Minikarten-Ziehen |
| `storage.ts` | IndexedDB-Datenbank `atlas-dominion-reborn`, transaktionales Speichern eines vollständigen Snapshots |
| `main.ts` | HUD, lokale Spielsteuerung, Audio und Frame-Akkumulator |
| `audio.ts` | Gefilterte Wind-/Schrittgeräusche, räumliche Schüsse, Funksignale, Web-Audio-Lautstärke und dauerhafte lokale Einstellungen |

## Entscheidungen

Canvas 2D nutzt die vorhandene Browserumgebung und vermeidet eine neue Engine-Abhängigkeit. Es gibt keinen WebGL-spezifischen Renderer. Für maximal 48 eigene und 18 KI-Soldaten reicht die Darstellung aus; Positionsabfragen verwenden räumliche Buckets. Kamera und Zeichnen sind vom Simulationsschritt getrennt. Große Echtzeitsprünge werden nicht nachberechnet; ein versteckter Tab pausiert.

Die feinere Wüstengrafik definiert weiterhin das zusammenhängende Relief. Die Bodenmaterial-Darstellung trennt dieses Relief von der Körnung: auf freien Flächen werden vergrößerte Steine geglättet und mit einer feinen, von Helligkeitsverläufen bereinigten Sandstruktur aus dem Bild kombiniert. Hügel bleiben erhalten. Handgezeichnete Felskonturen beziehen sich auf die originalen 1254 × 1254 Pixel und werden mit Faktor drei in Weltkoordinaten übertragen. Navigationszellen prüfen ihre gesamte Fläche einschließlich Körperabstand. Gebäude suchen einen vollständig freien Aufstellplatz. Territoriumsgrenzen nutzen gemeinsame, deterministisch versetzte Eckpunkte. Das interne Raster erscheint nicht als Landschaftsgitter.

Sicht wird alle 200 Simulationsmillisekunden aus tatsächlichen Quellen und einer Gelände-Sichtlinie berechnet. Beide Fraktionen haben eigene sichtbare und erkundete Zellen. Unbekannte Flächen sind schwarz, bekannte Flächen dunkel; verborgene gegnerische Einheiten werden weder im Hauptbild noch auf dem Radar gezeichnet. Bereits gesichtete Gebäude haben eine gespeicherte, veraltbare Erinnerung. Die visuelle Nebelkante wird beim Skalieren weich interpoliert; die logische Sicht bleibt rastergenau.

Angriffsbewegungen halten zum Schießen und setzen anschließend ihren Auftrag fort. Angegriffene Infanterie erwidert während eines normalen Bewegungsbefehls das Feuer auf den tatsächlichen sichtbaren Angreifer. Der Befehl und seine Warteschlange bleiben erhalten; ohne Bedrohung geht es weiter. Manuelle Ziele werden nur bei eigener Sicht verfolgt; bei Sichtverlust bleibt die zuletzt befohlene Position. Schüsse werden an Felsen blockiert. Einheiten lösen Überlappungen symmetrisch auf. Die KI bezahlt ihre Einheiten, expandiert entlang ihrer Grenzen und reagiert zur Verteidigung nur auf selbst gesichtete Spielertruppen in der Nähe. Sie erhält weder freie Credits noch Wissen über verborgene Infanterie.

Ein lebendes feindliches Hauptquartier sperrt die Eroberung seines Territoriums. Nach Zerstörung und acht Sekunden am angrenzenden Kontrollpunkt wird es mit 600 TP übernommen. Es kann anschließend eigene Infanterie produzieren.

Speicherstände enthalten Seed, Spielzeit, Einkommensphase, beide Kontostände, Einheiten und Befehle, Gebäudestatus, Produktionsfortschritt, Sammelpunkte, Besitz und Eroberungsfortschritt, Erkundung beider Fraktionen, Gebäudeerinnerungen und KI-Timer. Temporäre Pfade werden beim Laden neu berechnet. Bisherige Spielstände mit 120 × 120 Erkundungszellen werden verlustfrei auf das feinere Raster übertragen; Einheiten und Gebäude werden bei Bedarf aus neu blockiertem Gelände versetzt. Geometrie, Einkommen und Nachbarn stammen aus der Weltdefinition. Der Einkommenszähler verwendet ausschließlich Simulationszeit. Die frühere Europaversion hat einen getrennten Speicher.

## Bewusste Grenzen des ersten Meilensteins

Eine Terrainkarte, ein Infanterietyp, ein Hauptquartiertyp und eine regelbasierte KI. Das Gelände ist bildgebunden; der Seed variiert die Territoriumsgrenzen, erzeugt keine neue Wüstenlandschaft. Infanterie besitzt einen transparenten Atlas mit vier Richtungsreihen und je acht Posen sowie ergänzenden Beinbewegungen, Atmung und Waffenrückstoß. Spiegelung ergänzt die Richtungen. Positionen werden zwischen den Simulationsschritten interpoliert. Es werden keine Schattenellipsen unter Objekten gezeichnet. Maus und Tastatur bilden die vollständige Steuerung, kein dediziertes Touch-Befehlsschema. Es gibt eine manuelle lokale Spielstandposition und keinen Cloud-Speicher.

`?debug` stellt `window.__reborn` ausschließlich für reproduzierbare Browserprüfungen bereit. Im normalen Spiel wird keine Debug-Schnittstelle angelegt.
