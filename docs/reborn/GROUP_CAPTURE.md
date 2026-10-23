# Einnahme mit Gruppen

Der gemeldete Fehler wurde auf der Zufallskarte mit Seed 2026 reproduziert: Nach einem Befehl oben auf dem Bastionsturm (100 Welteinheiten über dem Bodenpunkt) nahm ein einzelner Soldat die Bastion ein, zwei Soldaten dagegen nicht. Sie blieben mit 97 bzw. 99 Einheiten Abstand außerhalb des Einnahmeradius von 95 stehen.

Die Formation benutzte ihre Spaltenzahl auch zur Zentrierung der Zeilen. Zwei Soldaten bildeten dadurch eine nach oben verschobene Reihe. Nun wird der Mittelpunkt der tatsächlich belegten Formationsplätze auf den Befehlspunkt gelegt; auch unvollständige letzte Reihen verursachen keinen Versatz mehr.

Zusätzlich lösen Rechtsklicks auf einen bereits erkundeten Bastionsturm, seinen Sockel oder seine Beschriftung den tatsächlichen Bodenpunkt auf. Die Trefferfläche folgt den gerenderten Asset-Metadaten und gilt in Weltkoordinaten bei jeder Zoomstufe. Sichtbare Gegner behalten die bisherige Angriffsauswahl-Priorität. Unerkundete Bastionen werden durch die Trefferprüfung nicht verraten.

Mehrere eigene Bodeneinheiten dürfen eine Bastion gemeinsam sichern. Die Einnahmezeit beträgt weiterhin acht Simulationssekunden; zusätzliche Truppen vervielfachen den Fortschritt nicht. Getrennte Gruppen können mehrere Bastionen gleichzeitig einnehmen. Die bisherigen Regeln zu angrenzenden eigenen Gebieten, gegnerischen Truppen im Radius, intakten gegnerischen Hauptquartieren und Fluggeräten bleiben erhalten. Bereits gespeicherte Aufträge bleiben erhalten; ein neuer Rechtsklick verwendet die korrigierte Zielauflösung.

Gezielt geprüft:

- Reproduktion mit einem bzw. zwei Soldaten; die Zweiergruppe sichert nach der Korrektur zuverlässig.
- Zentrierung von Gruppen mit 2, 3, 5, 7 und 10 Mitgliedern.
- Drei Gruppen nehmen drei angrenzende Bastionen gleichzeitig ein; Teilfortschritt übersteht Speichern/Laden.
- Echte Mausauswahl zweier Soldaten und Rechtsklick auf Turm, Körper und Beschriftung bei Zoom 1, 1,65 und 0,7. Beide Zielpositionen liegen im Radius; Fortschritt und Besitzwechsel erfolgen im Browser.

[Browserverifikation](group-capture.png).

Abschluss: Build, 48 gezielte Node-Prüfungen und alle 25 Chrome-Fälle gegen die aktualisierte Docker-Version auf Port 8095 bestanden.
