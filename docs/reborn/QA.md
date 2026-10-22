# Reborn / Prüfung am 23. Oktober 2026

Geprüft mit TypeScript und lokalem Chrome auf macOS. Die neue Bildvorlage ist als echte Oberfläche umgesetzt: Ressourcenleiste links oben, Radar und Katalog rechts, Produktions-/Kommandoleiste unten, zentrales Pausenmenü mit Fortsetzen, Speichern, Laden, Optionen, Steuerung und Hauptmenü. CSS-/SVG-Rahmen und lokale Metall- und Landschaftsgrafiken bilden die Gestaltung.

- **400 Node-Tests bestanden**, einschließlich der erhaltenen Simulation, HTTP-Auslieferung und **28 gezielten Reborn-Fällen**.
- **13 Browserfälle bestanden**. Gameplayeingaben erfolgen über Maus/Tastatur. Lange Abschnitte werden durch echte feste Simulationsschritte beschleunigt.
- Die komplette Browser-Suite wurde auch gegen die abschließend neu gebaute Docker-Version auf `127.0.0.1:8095` ausgeführt. Der zusätzliche Vorschauprozess auf Port 8097 wurde danach beendet.

Der Kampagnentest startet mit einem Soldaten und 500 Credits, erobert Nomadenpfad, kehrt zum Hauptquartier zurück, bezahlt und produziert fünf weitere Soldaten und markiert die Sechsergruppe per Auswahlrahmen. Er expandiert durch Zentralpass und Alte Trasse, kämpft gegen die aktive KI, nimmt deren Kiesebene ein und speichert anschließend über das echte Pausenmenü. Nach vollständigem Neuladen werden Besitzer, Credits, Truppen-IDs, Erkundung und Spielzeit beim Laden verglichen. Die geänderten Felsformen verändern Wege und Gefechte; der Test verwendet entsprechend eine zusätzliche regulär bezahlte Einheit. Kein künstliches Versetzen, Heilen oder Setzen der Besitzer in diesem Kampagnenablauf.

Der neue Bautest beginnt ebenfalls mit echten 500 Credits. Er öffnet den Gebäudekatalog, bricht eine Vorschau kostenlos mit Esc ab, versucht einen ungültigen Bauplatz am vorhandenen Hauptquartier und platziert danach eine Kaserne auf freiem eigenem Boden. Der Katalog sperrt schwere Infanterie bis zur Fertigstellung. Anschließend werden 250 Credits bezahlt und nach realer Produktionszeit ein schwerer Schütze mit 190 TP erzeugt. Optionen öffnen und schließen über dem Pausenmenü; nach Speichern und Seiten-Neuladen werden Kaserne und Truppe wiederhergestellt.

Ein separater, ausdrücklich finanzierter Produktionsfall deaktiviert die KI, baut Kaserne, Fabrik und Flugfeld über den Katalog und produziert alle sechs Fahrzeug-/Lufttypen. Die Preise und Bauzeiten werden regulär abgebucht bzw. simuliert. Die drei Bodenfahrzeuge erhalten danach Marschbefehle und müssen sich physisch bewegen. Diese Testkonfiguration ist eine gezielte Prüfung der sechs Produktionswege, kein Beleg für eine mit Startmitteln durchgespielte Kampagne.

Weitere Browserfälle prüfen:

- Radar ziehen, Kamera, Zoom am Mauszeiger, Shift-Aufträge, Stop, Angriffsbewegung, Sektorgrenzen und schnelle Pause.
- Keine sichtbaren Pixel verborgener Gegner auf Hauptkarte und Radar; erinnerte, aber aktuell unsichtbare Gebiete.
- Bedienbare 800 × 650 Ansicht, echte Steuerungshilfe sowie bestätigter/abgebrochener Neustart über das Hauptmenü.
- Tatsächlichen Audiosignalpegel, Stummschaltung und gespeicherte Lautstärke.
- Transparente Schrittposen, sichtbare Gangänderung, automatische Gegenwehr und erhaltene Befehlsfolge. Alle 16 Posen werden außerdem auf abgetrennte Nachbarfragmente und gleichmäßige Bodenhöhe geprüft.
- Sichtbaren Boden am früheren schwarzen Fleck, unter eigenen Einheiten und auf dem Radar sowie die vollständige Erkundung entdeckter Felsformationen.
- Übereinstimmung gezeichneter Felsflächen mit der Navigationsmaske: über 99 % der deutlich deckenden Gelände-Pixelproben liegen in blockierten Zellen. Die tatsächlichen Felsmotive besitzen jeweils mehr als 400 native Pixel Breite.
- Weiße, rote und blaue Bastion-Emission bei erhaltenem warmem Gehäusematerial, einschließlich tatsächlicher Besitzerwechsel im Renderer.
- Dauerhafte Sicht einer eroberten Bastion nach Abzug der Infanterie sowie selbst eröffnetes Feuer während eines Marsches, bevor der Gegner Schaden verursacht.

Die zusätzlichen Simulationstests prüfen Voraussetzungen und komplette Grundflächen von Baustellen, doppelte Abbuchung, Baupause, Freischaltungen, gemischte Produktionsaufträge und genaue Storno-Erstattungen, alte Save-Migration, fortgesetzte Bau-/Produktionszustände, Energiekern-Einkommen, Baustellenstorno, Flug über Felsen ohne Lufteroberung, Fahrzeugabstand, Pionierreparatur und eigenständige Turmverteidigung. Frühere Sicht-, Wirtschafts-, KI-, Belagerungs-, Sieg-/Niederlage- und Speicherprüfungen bleiben enthalten.

Die neue Geometrie kann alte Gebäude oder Bodentruppen beim Laden auf nahe freie Flächen versetzen. Die Infanterietypen teilen einen Grundatlas; Fahrzeuge verwenden gespiegelte Ansichten. Die KI bleibt eine Infanterie-KI. Es gab keinen vollständigen manuellen Durchlauf bis zum Sieg und keinen Touch-Test. Ein tatsächlich ausgekämpfter Hauptquartierangriff mit anschließender Siegeinnahme ist separat in der Simulation geprüft.

Bilder: [Pausenmenü nach Vorlage](reference-menu.png), [Bauplatzvorschau](construction-preview.png), [Kaserne und Produktion](reference-production.png), [Fabrik, Flugfeld und neue Truppen](reference-roster.png), [Start](initial.png), [Kampagne](campaign.png), [Kompakte Ansicht](compact.png), [Bastionssicht](bastion-sight.png). Die älteren separaten Farb-/Schrittphasentafeln dokumentieren Zeichenproben, keine vollständige Kampagne. Maschinenlesbare Ergebnisse und Traces liegen im ignorierten `tests/browser/artifacts/`.

Bildherkunft und vollständige Prompts: [ART_ASSETS.md](ART_ASSETS.md). Die Bastion ist weiterhin eine offen dokumentierte Nachbildung der nicht zugänglichen Originaldatei.
