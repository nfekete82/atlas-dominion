# Reborn / Architektur

Die archivierte Europasimulation unter `legacy/` wird vom neuen Einstiegspunkt nicht importiert. Bestehende Module und die nicht zu diesem Umbau gehörenden lokalen Änderungen bleiben erhalten.

| Datei | Aufgabe |
| --- | --- |
| `src/reborn/catalog.ts` | Neun Truppentypen, sechs Gebäudetypen einschließlich Hauptquartier, Kosten, Zeiten, Produzenten und Kampfwerte |
| `config.ts` | Weltgröße, Wirtschaft, Gebietseinnahme und Asset-Pfade |
| `world.ts` | 240 × 240 Navigation, Zusammenhangskomponenten, A*, Pfadglättung, Körperabstand und 30 Territorien |
| `terrain-art.ts` | Aus PNG-Alpha erzeugte Felsplatzierungen und Masken; generierte Datei |
| `scripts/compile-terrain-art.mjs` | Liest PNG-Alpha ohne Bildänderungen und kompiliert deterministische Hindernis-/Höhenmasken |
| `simulation.ts` | Feste 50-ms-Schritte, Sicht, Bau, typisierte Produktion, Wirtschaft, Kampf, Reparatur, KI und Save-Schema |
| `renderer.ts` | Sprites, Silhouettenschatten, feiner Boden, native Felsgrafiken, Platzierungsvorschau, Kamera, Radar und Nebel |
| `input.ts` | Auswahl, Befehlsfolgen, Platzieren/Abbrechen, Tastatur und Radarsteuerung |
| `main.ts`, `icons.ts`, `style.css` | Katalog-Tabs, echte Auftragsplätze, Kontextanzeige, Menüs, lokale SVG-Icons und Metallrahmen |
| `storage.ts`, `audio.ts` | Transaktionale IndexedDB-Speicherung und lokale Web-Audio-Sounds mit gespeicherten Einstellungen |

## Gebäude und Produktion

Die bisherige `Base`-Struktur beschreibt jetzt Hauptquartiere und zusätzliche Gebäude mit `kind`, `buildRemaining`, typisiertem `queueTypes` und einer parallelen Zeitliste `queue`. Dadurch bleiben frühere Spielstände mit fünfsekündigen Infanterieaufträgen kompatibel. Aufträge bezahlen ihren konkreten Einheitentyp; Produzenten, Budget, Kapazität und Warteschlangenlänge werden in der Simulation geprüft. Stornieren des aktiven Auftrags verwirft dessen Fortschritt, späterer Aufträge lässt den aktuellen Fortschritt bestehen.

Eine Baustelle benötigt ein lebendes eigenes Hauptquartier, sichtbaren eigenen Boden und vollständig freie Grundfläche. Prüfungen erfolgen vor der Abbuchung erneut in `build`, nicht ausschließlich im HUD. Baustellen blockieren Bewegung und werden in Simulationszeit fertiggestellt. Fertige Energiekerne liefern zusätzliches Einkommen; Geschütztürme greifen sichtbare Gegner an. Pioniere reparieren nahe eigene Gebäude, wenn sie stehen und gerade nicht schießen. Kostenlose Vorschau-Abbrüche und die 75-prozentige Baustellenerstattung sind getrennte Abläufe.

Neue Gebäude erhalten konfliktfreie IDs. Zerstörte zusätzliche Gebäude werden entfernt; Hauptquartiere bleiben für die Siegeinnahme erhalten. Bereits beobachtete, inzwischen sichtbar verschwundene Gebäude verlieren ihre veraltete Erinnerung. Die rote KI verwendet weiterhin Infanterie und den vorhandenen territorialen Expansionsplan.

## Bewegung, Gelände und Sicht

Die neue Felsgrafik ist kein hochskaliertes Landschaftsfoto. Vier native Felsvarianten werden an 20 Positionen platziert und direkt in die aktuelle Canvas-Auflösung gezeichnet. Die alten Landformumrisse geben die grobe Platzierung vor; die aus tatsächlicher Alpha-Deckung kompilierten Masken sind für Navigation und hohe Felsflächen maßgeblich. Navigationsmasken enthalten den Körperabstand um die gesamte Zelle. Niedrige Innenfelsen blockieren Wege, werfen aber keinen hohen Sichtschatten. Größere Fahrzeuge prüfen zusätzliche Bodenfreiheit in Zielsuche, A*, Glättung und Bewegung. Der Boden verwendet feine, von langsamen Helligkeitsverläufen getrennte Sandstruktur und ein deterministisches großräumiges Farbfeld.

Bodentruppen folgen kollisionsfreien Wegen. Fluggeräte bewegen sich direkt, überfliegen Gelände und erhalten erhöhte Sicht, ohne Territorien einzunehmen. Überlappungen werden abhängig von Einheitengröße aufgelöst; Luft- und Bodentruppen blockieren sich nicht gegenseitig.

Beide Fraktionen besitzen getrennte aktuelle und erinnerte Sicht. Eigene Einheiten, Gebäude und Bastionen sind tatsächliche Sichtquellen; Bastionen behalten ihren 320-Meter-Radius nach Abzug der Truppen. Besitzerwechsel berechnen die Sicht noch im gleichen Simulationsschritt neu. Nahe Bodenbereiche bleiben sichtbar. Entdeckte zusammenhängende Felsformationen werden vollständig als Gelände bekannt, ohne Gegner dahinter aufzudecken. Verborgene Gegner erscheinen weder auf Hauptkarte noch Radar. Sicht wird regulär alle 200 Simulationsmillisekunden aktualisiert.

Alle Truppen eröffnen in ihrer jeweiligen Waffenreichweite selbstständig das Feuer, auch während eines normalen Marsches, und behalten ihre Befehlsfolge. Tatsächliche Angreifer werden priorisiert; automatische Ziele werden nicht über die Waffenreichweite hinaus verfolgt. Manuelle Angriffsziele werden bei Sichtverlust zu einem Auftrag an ihrer zuletzt bekannten Position. Bodenfeuer berücksichtigt Felsen; Luftziele beziehungsweise Schüsse aus der Luft verwenden keine Boden-Hindernismaske.

## Darstellung und Menüs

Ganz gezeichnete, registrierte Infanterieposen vermeiden verdrehte Sprite-Hälften. Helm und Bodenposition werden beim Laden ausgerichtet; erweiterte Atlaszellen und Alpha-Zusammenhangskomponenten halten überstehende Waffen vollständig und schließen Nachbarfragmente aus. Infanterietypen teilen den Grundatlas. Fahrzeuge und Fluggeräte besitzen eigene Sprites mit Spiegelung statt vollständigem achtseitigen Richtungsatlas. Positionen werden zwischen den Simulationsschritten interpoliert.

Gebäudesilhouetten werden am Fundament auf die Bodenebene projiziert. Fluggeräte schweben sichtbar über ihrem gerichteten Schatten; unter Bodentruppen werden keine gefüllten Schattenellipsen ergänzt. Das Terrain wird vor dem Nebel gezeichnet, sichtbare Gebäude und Truppen anschließend nach Bodenhöhe sortiert. Bastionfarben verändern ihre blauen Lichtpixel zu Weiß oder Rot, während warmes Gehäusematerial erhalten bleibt.

Das Menü besitzt funktionsfähiges Fortsetzen, Speichern, Laden, Audiooptionen, Steuerung und Hauptmenü. Ein geöffneter Dialog pausiert die Simulation; verschachtelte Optionen führen zum Pausenmenü zurück. Die Leertaste bietet weiterhin schnelle taktische Pause. Die drei Katalog-Tabs zeigen echte Produktionsaufträge, platzierbare Gebäude und bereits erkundete Sektoren. Unbekannte Sektorzeilen verraten weder Besitzer noch Einkommen. Metallstruktur und Menülandschaft liegen als lokale Rastergrafiken vor, Rahmen und Icons als CSS/SVG.

## Speicherstände und Grenzen

Save-Version 2 wird beibehalten. Fehlende Einheitentypen werden Infanterie, frühere Bases Hauptquartiere und frühere Zeitaufträge typisierte Infanterieaufträge. Alte 120er-Erkundungsraster werden auf 240 × 240 übertragen. Geänderte Felskonturen können beim Laden Einheiten oder Gebäude auf einen nahen freien Platz versetzen. Pfade werden neu berechnet; Sicht wird aus realen Quellen erneut aufgebaut. Wirtschaft, Befehle, Produktionsfortschritt, Baustellen und typisierte Aufträge bleiben erhalten. Das Archiv verwendet einen getrennten Speicher.

Ein manuell belegbarer lokaler Speicherplatz, keine Cloud, kein Mehrspieler und kein Touch-Befehlsschema. Die Geländeplatzierung bleibt fest; der Seed variiert Gebietsgrenzen. Canvas 2D benötigt keine neue Engine. `?debug` stellt ausschließlich für Prüfungen `window.__reborn` bereit.
