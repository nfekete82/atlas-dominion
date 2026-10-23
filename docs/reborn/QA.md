# Reborn / Prüfung am 23. Oktober 2026

## Übernommene Legionär-Figur und 3D-Gebäudefamilie

**39 gezielte Node-Prüfungen und 19 Chrome-Fälle der Reborn-Suite bestanden.** Die freigegebene Figur ist bei allen drei Infanterierollen aktiv; die Bildressourcen werden geteilt. Sieben eigene Gebäudetypen besitzen reale GLB-Dateien, feste Schatten und registrierte Aktivitätslayer. Die Modellgalerie zeigt alle Typen, tatsächliche Schüsseldrehung und neutrale weiße Emission. Im Spiel sind Grundkörper und Bodenbereich bei wechselnder Schüsselzeit pixelgleich. Häufige Pixelabfragen der Prüffläche verwenden `willReadFrequently`, damit Chrome während des Vergleichs nicht zwischen GPU- und CPU-Rasterung wechselt. [Aktueller Umfang, Quellen und Browserbilder](../buildings-3d/README.md).

Die älteren Abschnitte dokumentieren die vorherigen Aufträge und deren damalige Assetstände.

## Aktueller Animationsauftrag

**37 gezielte Node-Prüfungen und sieben ausgewählte Chrome-Prüfungen bestanden.** Enthalten sind die 29 erhaltenen Reborn-Simulationstests, acht neue Animations-/Bewegungsfälle sowie Kampagne, Sicht, native Einheitendarstellung, Produktion aller Fahrzeuge, bestehende Gebäudeeffekte und das neue Animationslabor. Alle sieben Browserfälle bestanden zusätzlich gegen die abschließend neu gebaute und gestartete Docker-Fassung auf `127.0.0.1:8095`. [Aktuelles Animationsprotokoll mit Quellen und Grenzen](ANIMATION_SYSTEM.md), [Laufphasen](animation-lab-walk.png), [Treffer](animation-lab-hit.png), [Tod](animation-lab-death.png), [Video](animation-lab.webm).

Die folgenden Zahlen und Beschreibungen dokumentieren die **vorherige Fassung**. Deren komplette Archiv-/Browser-Suite wurde für den fokussierten Animationsauftrag nicht erneut ausgeführt; insbesondere sind die früheren 64 generierten Posen und Fahrzeugspiegelungen inzwischen ersetzt.

## Vorheriger Oberflächen- und Schattenauftrag

Geprüft mit TypeScript und lokalem Chrome auf macOS. Die neue Bildvorlage ist als echte Oberfläche umgesetzt: Ressourcenleiste links oben, Radar und Katalog rechts, kompakte Auswahl-/Kommandoleiste direkt links unten und Produktionswarteschlange im rechten Katalog, zentrales Pausenmenü mit Fortsetzen, Speichern, Laden, Optionen, Steuerung und Hauptmenü. CSS-/SVG-Rahmen und lokale Metall- und Landschaftsgrafiken bilden die Gestaltung.

- **401 Node-Tests bestanden**, einschließlich der erhaltenen Simulation, HTTP-Auslieferung und **29 gezielten Reborn-Fällen**.
- **14 Browserfälle bestanden**. Gameplayeingaben erfolgen über Maus/Tastatur. Lange Abschnitte werden durch echte feste Simulationsschritte beschleunigt.
- Die komplette Browser-Suite wurde auch gegen die abschließend neu gebaute Docker-Version auf `127.0.0.1:8095` ausgeführt. Der zusätzliche Vorschauprozess auf Port 8097 wurde danach beendet.

Der Kampagnentest startet mit einem Soldaten und 500 Credits, erobert Nomadenpfad, kehrt zum Hauptquartier zurück, bezahlt und produziert fünf weitere Soldaten und markiert die Sechsergruppe per Auswahlrahmen. Er expandiert durch Zentralpass und Alte Trasse, kämpft gegen die aktive KI, nimmt deren Kiesebene ein und speichert anschließend über das echte Pausenmenü. Nach vollständigem Neuladen werden Besitzer, Credits, Truppen-IDs, Erkundung und Spielzeit beim Laden verglichen. Die geänderten Felsformen verändern Wege und Gefechte; der Test verwendet entsprechend eine zusätzliche regulär bezahlte Einheit. Kein künstliches Versetzen, Heilen oder Setzen der Besitzer in diesem Kampagnenablauf.

Der Einheitenfokus-Test startet mit echten 500 Credits und nur den beiden Start-Hauptquartieren. Die Oberfläche bietet neun Einheitentypen und zwei Katalogreiter; Gebäudereiter, Bauknopf und B-Kürzel öffnen keinen Bauablauf. Ohne Kaserne werden 250 Credits für schwere Infanterie bezahlt und nach neun Simulationssekunden ein Schütze mit 190 TP erzeugt. Auswahl und Befehle sind bei 3434 × 1790 maximal 460 × 132 Pixel groß, zehn Pixel vom linken und unteren Rand entfernt. Bei 800 × 650 bleiben Auswahl, Angriff und Produktion sichtbar; Seitenleiste und Auswahl überlappen nicht. Optionen und Speichern/Laden werden weiterhin über das echte Pausenmenü geprüft.

Ein separater finanzierter Produktionsfall deaktiviert die KI und bildet alle sechs Fahrzeug-/Lufttypen direkt im Hauptquartier aus. Die Preise werden regulär abgebucht; alle sechs benötigen zusammen 99 Sekunden Produktionszeit. Ein später Auftrag wird über seinen Warteschlangenplatz storniert und zu genau seinem Preis erstattet. Die drei Bodenfahrzeuge müssen nach Marschbefehlen ihre Position verändern. Es werden keine zusätzlichen Gebäude benötigt. Diese Testkonfiguration prüft die Produktionswege, keine mit Startmitteln durchgespielte Kampagne.

Der neue Effekt-Test prüft 64 geladene Soldatenposen, 16 Schüsselansichten und tatsächlich halbtransparente dunkle Schattenpixel im Atlas. Das Hauptquartier darf keinen Laufzeitschatten projizieren. Echte Bildpixel müssen sich bei fortgeschrittener Schüssel-/Lichtzeit und bei Wind verändern; bei gleicher pausierter Zeit bleiben die Pixel gleich. Reines Zeichnen darf den gespeicherten Spielzustand nicht verändern. Die neuen Gebäudegrafiken und alle Posen wurden zusätzlich auf sandfarbenem Untergrund visuell geprüft.

Weitere Browserfälle prüfen:

- Radar ziehen, Kamera, Zoom am Mauszeiger, Shift-Aufträge, Stop, Angriffsbewegung, Sektorgrenzen und schnelle Pause.
- Keine sichtbaren Pixel verborgener Gegner auf Hauptkarte und Radar; erinnerte, aber aktuell unsichtbare Gebiete.
- Bedienbare 800 × 650 Ansicht, echte Steuerungshilfe sowie bestätigter/abgebrochener Neustart über das Hauptmenü.
- Tatsächlichen Audiosignalpegel, Stummschaltung und gespeicherte Lautstärke.
- Transparente Schrittposen, sichtbare Gangänderung, automatische Gegenwehr und erhaltene Befehlsfolge. Alle 64 Posen werden außerdem auf abgetrennte Nachbarfragmente und gleichmäßige Bodenhöhe oberhalb der registrierten Fußlinie geprüft; der integrierte Schatten darf darunter liegen.
- Sichtbaren Boden am früheren schwarzen Fleck, unter eigenen Einheiten und auf dem Radar sowie die vollständige Erkundung entdeckter Felsformationen.
- Übereinstimmung gezeichneter Felsflächen mit der Navigationsmaske: über 99 % der deutlich deckenden Gelände-Pixelproben liegen in blockierten Zellen. Die tatsächlichen Felsmotive besitzen jeweils mehr als 400 native Pixel Breite.
- Weiße, rote und blaue Bastion-Emission bei erhaltenem warmem Gehäusematerial, einschließlich tatsächlicher Besitzerwechsel im Renderer.
- Dauerhafte Sicht einer eroberten Bastion nach Abzug der Infanterie sowie selbst eröffnetes Feuer während eines Marsches, bevor der Gegner Schaden verursacht.

Ein zusätzlicher Simulationstest produziert jeden der neun Typen im unveränderten Start-Hauptquartier, prüft Abbuchung und Spielstandfortsetzung ohne weitere Gebäude. Die erhaltenen Kompatibilitätstests prüfen Voraussetzungen und komplette Grundflächen von Baustellen, doppelte Abbuchung, Baupause, Freischaltungen, gemischte Produktionsaufträge und genaue Storno-Erstattungen, alte Save-Migration, fortgesetzte Bau-/Produktionszustände, Energiekern-Einkommen, Baustellenstorno, Flug über Felsen ohne Lufteroberung, Fahrzeugabstand, Pionierreparatur und eigenständige Turmverteidigung. Frühere Sicht-, Wirtschafts-, KI-, Belagerungs-, Sieg-/Niederlage- und Speicherprüfungen bleiben enthalten.

Die neue Geometrie kann alte Gebäude oder Bodentruppen beim Laden auf nahe freie Flächen versetzen. Die Infanterietypen teilen einen Grundatlas; Fahrzeuge verwenden gespiegelte Ansichten. Die KI bleibt eine Infanterie-KI. Es gab keinen vollständigen manuellen Durchlauf bis zum Sieg und keinen Touch-Test. Ein tatsächlich ausgekämpfter Hauptquartierangriff mit anschließender Siegeinnahme ist separat in der Simulation geprüft.

Bilder: [Integrierte Schatten und Basisanimation](grounded-animation.png), [Kompakte Auswahl links unten auf großem Bildschirm](unit-focus-wide.png), [Einheitenfokus bei 800 × 650](unit-focus-compact.png), [Einheiten ohne Gebäudebau](unit-roster.png), [Pausenmenü nach Vorlage](reference-menu.png), [Start](initial.png), [Kampagne](campaign.png), [Kompakte Ansicht](compact.png), [Bastionssicht](bastion-sight.png). Die älteren separaten Farb-/Schrittphasentafeln dokumentieren Zeichenproben, keine vollständige Kampagne. Maschinenlesbare Ergebnisse und Traces liegen im ignorierten `tests/browser/artifacts/`.

Bildherkunft und vollständige Prompts: [ART_ASSETS.md](ART_ASSETS.md). Die Bastion ist weiterhin eine offen dokumentierte Nachbildung der nicht zugänglichen Originaldatei.
