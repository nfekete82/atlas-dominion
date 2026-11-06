# Kompakte Sidebar und Minimap-Befehle

Ausgangsbasis: `d57dd965eb00c4780c4c0a99fa47ce67653236e8`, Branch `fix/sandforge-legacy-save-footprint-20261028`. Das Arbeitsverzeichnis war sauber. Implementierung auf `feat/sandforge-compact-minimap-ui-20261028`.

## Verhalten

- Bei 1440 × 1000 sinkt das Radar-Panel von 429,80 auf 292,16 CSS-Pixel: **32,0 % weniger Höhe**. Die quadratische Karte sinkt von 356,80 auf 258,16 Pixel (27,6 %). Die Weltfläche bleibt vollständig enthalten. Messungen und weitere Viewports: [layout.json](layout.json).
- Rechtsklick auf der Minimap sendet einen normalen `move` über dieselbe `Simulation.command`-API wie Weltkartenbefehle. Formationen, Wegfindung, sichtbare Rückmeldung und Funkbestätigung werden wiederverwendet. Shift hängt Wegpunkte an. Keine Zielauflösung, Feindabfrage, Sammelpunktänderung oder Teleportation.
- Koordinaten kommen aus dem tatsächlichen CSS-Rechteck und der jeweiligen Weltgröße. Canvas-Backing, DPR und Kamera-Zoom fließen nicht erneut in die Umrechnung ein. Die Karte hat eine äußere Outline statt einer koordinatenverschiebenden Border. Linksziehen navigiert weiterhin; H und die übrigen HQ-Schaltflächen bleiben erhalten.
- Tabs: Symbol links, Text rechts, 56 Pixel Desktophöhe / 52 Pixel bei schmalen Fenstern. Tastaturfokus und native Enter-/Leertastenaktivierung bleiben funktionsfähig.
- Acht Produktionsslots stehen in einer Zeile. Auf schmalen Bildschirmen scrollt ausschließlich die Slotreihe horizontal. Fortschritt, Reihenfolge, Kosten und Stornierungsrückerstattung bleiben erhalten.
- Der ausgewählte Produzent bestimmt die Produktionsanzeige. Baustellen zeigen ihren Baufortschritt; Nichtproduzenten zeigen keine irreführende HQ-Schnellproduktion. Die Schnellproduktion verwendet ausdrücklich den angezeigten Produzenten.

## Pionier-Untersuchung

Der aktuelle Katalog und der vor der Änderung gestartete Browser zeigten bereits **Pionier**, mit internem Schlüssel `engineer`, Kosten 200, Bauzeit 7 und ausschließlich HQ als Produzenten. Eine aktuelle sichtbare Bezeichnung „Ingenieur“ ließ sich nicht reproduzieren. Noch vorhandene statische „Bauarbeiter“-Texte in Hilfen, Hinweisen und der initialen HTML-Oberfläche wurden auf Pionier/Pioniere vereinheitlicht. Der unpassende HQ-Fallback bei ausgewählten anderen Gebäuden wurde korrigiert. Kein Löschen von Browserdaten oder Spielständen.

## Nachweise

- Typecheck und Build erfolgreich.
- Vollständiges `npm test`: 725 Prüfungen, 724 bestanden, keine Fehler; ein bestehender optionaler Premium-Infanterie-Test übersprungen.
- Neue Koordinaten-/Katalogtests: 12/12 bestanden.
- Gezielte Browserregressionen für kompaktes UI, bestehendes Layout, Produktion, Support und Performance: 22/22 bestanden.
- Der Bewegungs-Browsertest prüft Infanterie, Fahrzeug und Luftfahrzeug nach echten Rechtsklicks: zunächst unveränderte Position, danach tatsächliche Bewegung durch Simulationsschritte. Gruppen erhalten verschiedene Formationsziele; Shift erhält den ersten Auftrag.
- Responsive Nachweise für 1440, 1200, 900, 620 und 390 Pixel, zusätzlich Retina mit DPR 2, CSS-Transformation und Kamera-Zoom. Acht gefüllte Slots und Stornierung auch bei horizontalem Scrollen geprüft.
- Vollständiger Browserlauf: 71/80 bestanden. Neun bekannte Altprüfungen bleiben offen (Grafik-/Farbannahmen, Infanterieposen, Kampfannahmen, Audio-Dialog, ältere HUD-/Katalogannahmen). Die zwischenzeitliche Desktop-Schriftabweichung wurde auf 15 Pixel korrigiert; die HUD-Nachprüfung erreicht danach wieder die zuvor dokumentierte veraltete Hintergrundgradient-Erwartung. Abschließend bestanden alle 22 relevanten Browsertests erneut gegen den finalen Docker-Build. Fehlernamen und Nachweise: [test-results.json](test-results.json), Vergleich: [früherer Prüfbericht](../transport-helicopter-20261028/test-results.json). Keine Tests deaktiviert oder gelockert.
- Docker mit dem angeforderten Compose-Projektnamen neu gebaut und gestartet; HTTP 200 auf `http://127.0.0.1:8095/` bestätigt.

Screenshots: [Desktop](sidebar-1440.png), [Telefon](sidebar-390.png), [gefüllte Produktion Desktop](production-full-desktop.png), [gefüllte Produktion Telefon](production-full-mobile.png), [Retina](retina-map.png).

Weltgenerierung, Renderer, Karten-/Kamera-Zoom-Logik, Saveformat, Assets und Simulationsmechanik wurden nicht verändert. In `simulation.ts` wurde ausschließlich ein sichtbarer Hinweistext geändert.
