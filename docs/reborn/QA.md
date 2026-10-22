# Reborn / Prüfung am 22. Oktober 2026

Geprüft mit TypeScript und lokalem Chrome auf macOS. Der Entwicklungsserver ist ausschließlich an `127.0.0.1` gebunden.

- 388 Node-Tests bestanden: neue RTS-Simulation sowie erhaltene Simulation und Infrastruktur. Die bisherigen DOM-Prüfungen beziehen sich nun auf die archivierte Europaversion; der HTTP-Test prüft beide Oberflächen und die neuen Module/Assets.
- 16 gezielte Reborn-Tests: exakter Start; deterministische Welt; Wege zu allen 30 Kontrollpunkten ohne Fels-/Gebäudekollision; Erkundung und achtsekündige Eroberung; unterbrochene und nicht angrenzende Einnahmen; Einkommen einschließlich Pause und Save/Load; Produktion und Erstattung; Befehlsketten und Stop; Kampf und Angriffsbewegung; blockierte Sicht-/Schusslinien; eigenständige KI-Produktion/Expansion; gespeicherter Produktions-/KI-/Erkundungszustand; Sieg und Niederlage; echte Hauptquartierbelagerung mit anschließender Übernahme; KI ohne Wissen über verborgene Spielerpositionen; Gegenwehr während eines Marschbefehls mit anschließender Fortsetzung der Befehlsfolge; freie Gebäudegrundfläche und vollständige Hindernisränder; Migration bisheriger Spielstände auf das feinere Navigations-/Sichtraster. Mehrere Aspekte teilen sich einen Test.
- Sechs Browser-Tests bestanden, ohne Bildantworten zu ersetzen. Befehle erfolgen über tatsächliche Maus-/Tastaturereignisse. Lange Spielabschnitte laufen in festen Simulationsschritten beschleunigt; ihre Ergebnisse werden nicht künstlich gesetzt.

Der Kampagnentest startet mit einem Soldaten und 500 Credits, sichert Nomadenpfad, erhöht das Einkommen, kehrt zur Basis zurück, bildet vier Soldaten aus, markiert die Gruppe mit einem Auswahlrahmen, expandiert durch Zentralpass und Alte Trasse, kämpft gegen die aktive KI und übernimmt deren Kiesebene. Er speichert danach in IndexedDB, lädt die Seite vollständig neu und prüft Credits, Besitzer, Einheiten-IDs, Erkundung und Spielzeit beim Fortsetzen. Keine JavaScript-Fehler.

Weitere Browserprüfungen: Minikarte klicken/ziehen; Kamera per Tastatur; am Mauszeiger verankerter Zoom; Shift-Befehlsfolge; Stop; Angriffsbewegung; Abwählen; Gebiets-Overlay; Pause; schwarz bleibende Pixel an verborgenen Gegnerpositionen in Hauptkarte und Radar; erhaltene dunkle Erkundung nach Weggehen; Hilfe, Neustart und bedienbare 800 × 650 Ansicht.

Die beiden zusätzlichen Browserfälle prüfen den tatsächlich erzeugten Audiosignalpegel, Stummschaltung und gespeicherte Lautstärke sowie transparente Animationsframes, sichtbare Gangänderung, automatisch erwiderten Kampfschaden, erhaltenen Marschbefehl und die Abwesenheit gefüllter Schattenellipsen. Die Zeichenreihenfolge legt den Geländenebel unter anhand ihrer Bodenposition sichtbare Objekte, damit hohe Masten nicht vom Nebel abgeschnitten werden.

Die Bastion ist eine erzeugte Nachbildung im passenden Stil. Die vom Nutzer benannte Originaldatei war durch macOS geschützt; sie wurde nicht als kopiertes Original ausgegeben. Die Nachbildung liegt als reguläre Projektdatei vor und wird blau, rot oder neutral eingefärbt. Herkunft und Prompts stehen in [ART_ASSETS.md](ART_ASSETS.md).

Die bestehende Docker-Compose-Umgebung wurde erfolgreich neu gebaut und gestartet. Ihr Port ist auf `127.0.0.1:8095` gebunden. Der vollständige zentrale Browser-Spielablauf hat auch gegen diese Container-Version bestanden. Der zusätzliche QA-Server auf 8097 wurde anschließend beendet.

Bilder: [Start](initial.png), [Produktion](production.png), [Kampagne](campaign.png), [Kompakte Ansicht](compact.png). Maschinenlesbare Browserergebnisse und Traces werden unter dem ignorierten `tests/browser/artifacts/` erzeugt.

Kein vollständiger manueller Kampagnendurchlauf bis zum Sieg und kein mobiler Touch-Test. Die Siegeinnahme des Hauptquartiers ist separat durch echte Kampfschritte und Eroberung in der Simulation geprüft.
