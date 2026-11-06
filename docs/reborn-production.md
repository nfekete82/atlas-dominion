# Produktionsgebäude und Startaufstellung

Stand: 24.10.2026.

Jede neue Partie startet für beide Fraktionen mit einem Infanteriesoldaten und einem Bauarbeiter sowie den bisherigen 500 Credits. Das gilt auch beim bewussten Start auf einer alten Kartenversion. Beim Laden bestehender Spielstände werden keine Einheiten hinzugefügt.

| Gebäude | Ausbildung nach Fertigstellung |
|---|---|
| Hauptquartier / Feldkommando | Bauarbeiter |
| Kaserne | Infanteriesoldaten, Sanitäter, schwere Infanterie |
| Fahrzeugfabrik | Spähwagen, Kampfpanzer, Raketenwerfer |
| Flugfeld | Transportheli, Kampfheli, Bomber |

Der rechte Katalog ist nach diesen Produktionsgebäuden gegliedert. Er zeigt nur die Gruppen, für die eine eigene, lebende und fertiggestellte Anlage vorhanden ist. Eine Baustelle schaltet noch keine Einheiten frei. Nach Verlust der letzten passenden Anlage verschwindet die Gruppe wieder. Eine volle Warteschlange oder fehlende Credits deaktivieren die Karten, ohne die Gruppe auszublenden. Der kleine Produktionsknopf verwendet den ersten passenden Einheitentyp des angezeigten Gebäudes; im Hauptquartier also den Bauarbeiter.

Die Regeln werden von der Simulation durchgesetzt, nicht nur durch ausgeblendete Menüpunkte. Ein Hauptquartier kann deshalb auch über direkte Befehle keine Soldaten, Fahrzeuge oder Fluggeräte mehr produzieren. Die Kosten und Ausbildungszeiten bleiben gleich. Bauarbeiter können weiterhin die vorhandenen Gebäude direkt errichten; eine zusätzliche Abhängigkeit wie „Kaserne vor Fabrik“ wurde nicht eingeführt.

Die KI nutzt dieselbe Kette. Ihr Startarbeiter errichtet zuerst eine regulär bezahlte Kaserne; ohne Arbeiter bildet das Hauptquartier einen Ersatz aus. Sie berücksichtigt bei der Typwahl nur einsatzfähige Produktionsgebäude. Damit die neue Aufbauphase nicht zu dauerhaftem Sammeln führt, können drei bereitstehende Kämpfer nach begrenzter Wartezeit einen unbewachten Sektor angehen. Gegen bekannte Verteidigungen bleiben die höheren Stärkeanforderungen erhalten.

Neue Speicherstände tragen die optionale Produktionskennung `productionVersion: 1`; das bestehende Speicherformat bleibt Version 2. Beim Laden älterer Spielstände werden bereits bezahlte, inzwischen unzulässige Aufträge zum tatsächlich gebuchten Preis einmalig erstattet. Zulässige Aufträge und vorhandene Truppen bleiben erhalten. War der laufende Auftrag unzulässig, startet der nächste zulässige Auftrag bei null. Ein erneutes Speichern/Laden erstattet nichts doppelt. Der Spieler erhält bei einer Erstattung eine kurze Meldung.

Geänderte Laufzeitdateien: `src/reborn/catalog.ts`, `simulation.ts`, `army-economy.ts`, `tactical-ai.ts`, `main.ts`, `style.css` sowie die Hinweise in `index.html` und `README.md`. Modelle, Grafikqualität, Waffenwerte, Karten und Gelände bleiben erhalten.

Validiert wurden Build und `git diff --check`, neun neue Produktionsprüfungen, sechs KI-Aktivitätsprüfungen sowie fokussierte bestehende Regressionsläufe. Die Browserfälle prüfen echte Bauarbeiter-Baubefehle, Fertigstellung aller Produktionsgebäude, Freischaltung und Verlust der Menüs, volle Warteschlangen, HQ-Ausbildung, beide alten Kartenformate, echte IndexedDB-Migration ohne doppelte Erstattung sowie einen vollständigen Kampagnenablauf mit Kasernenproduktion und Kampf. Alte Tests mit der inzwischen ungültigen Annahme „alle Einheiten im Hauptquartier“ verwenden jetzt passende fertige Infrastruktur; die eigentliche Baukette wird separat ohne solche Abkürzungen geprüft.

Keine Stashes verändert, keine lokalen Änderungen zurückgesetzt, keine automatischen Commits oder Pushes.
