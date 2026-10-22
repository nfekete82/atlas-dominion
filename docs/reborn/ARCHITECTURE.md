# Reborn / Architektur

Die alte Europasimulation wird vom neuen Einstiegspunkt nicht importiert. `legacy/index.html`, `legacy/style.css` und `legacy/README.md` archivieren die bisherige Oberfläche und Dokumentation. Die bisherigen TypeScript-Module bleiben an ihrem Ort, damit vorhandene Arbeit, Tests und Git-Historie erhalten bleiben.

| Datei | Aufgabe |
| --- | --- |
| `src/reborn/config.ts` | Zentrale Spielwerte, Asset-Pfade und gemeinsame Typen |
| `world.ts` | 3762 × 3762 Weltkoordinaten, 120 × 120 Navigationsraster, Felskonturen, A* mit Heap und Pfadglättung, 30 Territorien |
| `simulation.ts` | Feste 50-ms-Schritte, Wirtschaft, Bewegung, Kollisionsauflösung, Sicht, Kampf, Eroberung, Produktion, KI, Sieg/Niederlage, Save-Schema |
| `renderer.ts` | Canvas-2D-Sprites, Tiefensortierung, Kamera, Nebeltextur, Radar, Befehlsmarkierungen |
| `input.ts` | Bildschirm-/Weltkoordinaten, Auswahl, Befehle, Tastatur, Kameraränder und Minikarten-Ziehen |
| `storage.ts` | IndexedDB-Datenbank `atlas-dominion-reborn`, transaktionales Speichern eines vollständigen Snapshots |
| `main.ts` | HUD, lokale Spielsteuerung, Audio und Frame-Akkumulator |

## Entscheidungen

Canvas 2D nutzt die vorhandene Browserumgebung und vermeidet eine neue Engine-Abhängigkeit. Es gibt keinen WebGL-spezifischen Renderer. Für maximal 48 eigene und 18 KI-Soldaten reicht die Darstellung aus; Positionsabfragen verwenden räumliche Buckets. Kamera und Zeichnen sind vom Simulationsschritt getrennt. Große Echtzeitsprünge werden nicht nachberechnet; ein versteckter Tab pausiert.

Die Wüstengrafik wird einmal auf die Welt skaliert. Handgezeichnete Felskonturen beziehen sich auf ihre originalen 1254 × 1254 Pixel und werden mit Faktor drei in Weltkoordinaten übertragen. Jede Territoriumsgrenze nutzt gemeinsame, deterministisch versetzte Eckpunkte. Kontrollpunkte befinden sich auf navigierbarem Gelände. Das interne Raster erscheint nicht als Landschaftsgitter. Die Karte enthält keine wiederholten Terrainkacheln.

Sicht wird alle 200 Simulationsmillisekunden aus tatsächlichen Quellen und einer Gelände-Sichtlinie berechnet. Beide Fraktionen haben eigene sichtbare und erkundete Zellen. Unbekannte Flächen sind schwarz, bekannte Flächen dunkel; verborgene gegnerische Einheiten werden weder im Hauptbild noch auf dem Radar gezeichnet. Bereits gesichtete Gebäude haben eine gespeicherte, veraltbare Erinnerung. Die visuelle Nebelkante wird beim Skalieren weich interpoliert; die logische Sicht bleibt rastergenau.

Angriffsbewegungen halten zum Schießen und setzen anschließend ihren Auftrag fort. Bewegungsbefehle priorisieren den Weg. Manuelle Ziele werden nur bei eigener Sicht verfolgt; bei Sichtverlust bleibt die zuletzt befohlene Position. Schüsse werden an Felsen blockiert. Einheiten lösen Überlappungen symmetrisch auf. Die KI bezahlt ihre Einheiten, expandiert entlang ihrer Grenzen und reagiert zur Verteidigung nur auf selbst gesichtete Spielertruppen in der Nähe. Sie erhält weder freie Credits noch Wissen über verborgene Infanterie.

Ein lebendes feindliches Hauptquartier sperrt die Eroberung seines Territoriums. Nach Zerstörung und acht Sekunden am angrenzenden Kontrollpunkt wird es mit 600 TP übernommen. Es kann anschließend eigene Infanterie produzieren.

Speicherstände enthalten Seed, Spielzeit, Einkommensphase, beide Kontostände, Einheiten und Befehle, Gebäudestatus, Produktionsfortschritt, Sammelpunkte, Besitz und Eroberungsfortschritt, Erkundung beider Fraktionen, Gebäudeerinnerungen und KI-Timer. Temporäre Pfade werden beim Laden neu berechnet. Geometrie, Einkommen und Nachbarn werden aus der vertrauenswürdigen Weltdefinition rekonstruiert. Der Einkommenszähler verwendet ausschließlich Simulationszeit. Die frühere Version hat einen getrennten Speicher.

## Bewusste Grenzen des ersten Meilensteins

Eine Terrainkarte, ein Infanterietyp, ein Hauptquartiertyp und eine regelbasierte KI. Das Gelände ist bildgebunden; der Seed variiert die Territoriumsgrenzen, erzeugt keine neue Wüstenlandschaft. Die Auflösung der Originalgrafik begrenzt die Bodendetails beim starken Hineinzoomen. Infanterie nutzt das einzelne gelieferte Standbild mit Spiegelung, dezenter Laufbewegung und Schusseffekten; es gibt keinen erfundenen Animationsatlas. Maus und Tastatur bilden die vollständige Steuerung, kein dediziertes Touch-Befehlsschema. Es gibt eine manuelle lokale Spielstandposition und keinen Cloud-Speicher.

`?debug` stellt `window.__reborn` ausschließlich für reproduzierbare Browserprüfungen bereit. Im normalen Spiel wird keine Debug-Schnittstelle angelegt.
