# Sandforge – reproduzierbare KI-Testarena

Die Arena nutzt die bestehende echte headless-Simulation mit dem bewährten Benchmark-Instrumentarium.
Alle roten Einheiten und Bauwerke entstehen über reguläre bezahlte Befehle.
Blau ist ein festes, budgetbeschränktes Verteidigungsskript (kein menschlicher Spieler).

## Start

    npm run benchmark:arena

Standard: 48 Gefechte = Karten 3, 4 und 5 × Seeds 2026–2033 × Modi baseline/director.
Jeder Durchlauf läuft maximal 240 simulierte Sekunden.

Kurzer Funktionstest:

    npm run benchmark:arena -- --maps 3 --seeds 2026 --seconds 60 --modes baseline,director

Angepasster Lauf:

    npm run benchmark:arena -- --maps 3,4,5 --seeds 2026,2027,2028 --seconds 300 --modes baseline,director --label iteration-1 --output ai-arena-results/iteration-1.json

Ergebnisse werden **nach jedem Match** atomar geschrieben:
- ai-arena-results/latest.json: volle Telemetrie inkl. Missionen, Produktion, Verluste und Timeline
- ai-arena-results/latest.md: Auswertung, Modus-Paarvergleich, Warnsignale und Prüfschritte

Die Rohdaten werden nicht in Git eingecheckt. Die GitHub-Actions-Testarena archiviert sie als Artefakte.

## Messregeln und Grenzen

- Rot ist die zu prüfende KI, Blau ein festes, budgetbeschränktes Verteidigungsskript.
- Siege, Niederlagen und Zeitlimits bleiben strikt getrennt.
- Die Siegquote zählt Siege / **alle** Matches, zusätzlich wird die Quote unter entschiedenen Gefechten angezeigt.
- Baseline und Director werden ausschließlich bei identischer Startwelt, Karte und Seed gepaart.
- Score und HQ-Schaden sind Sekundärmetriken, nicht das Ergebnis eines gewonnenen Spiels.
- Warnsignale sind beobachtete Korrelationen, keine nachgewiesenen Ursachen. Einzelne Seeds reproduzieren!
- Grafik-FPS, menschliche Bedienung und echter Mensch-vs.-KI-Schwierigkeitsgrad sind nicht gemessen.
- Ein Vergleich baseline/director ist ein **Modusvergleich auf demselben Code**, kein Vergleich zweier Commits.

## Versionsvergleich

Erzeuge mit derselben Testkonfiguration einen Bericht auf der alten und einen auf der neuen Git-Revision.

    npm run benchmark:arena:compare -- /pfad/vorher.json /pfad/nachher.json ai-arena-results/vergleich.md

Der Vergleich bricht ab bei abweichenden spielbaren Startwelten, Einheitenkatalogen,
Gegnerskripten, Testdauern oder Modusbelegungen. Die eigentliche KI-Implementierung darf sich unterscheiden.

## Entwicklungsschleife

1. Drei häufigste Warnsignale auswählen.
2. Betroffene Karte/Seed mit JSON-Timeline und Spielbefehlen reproduzieren und echte Ursache feststellen.
3. Für bestätigte Fehler Regressionstest ergänzen und KI gezielt verbessern.
4. Gleiche Arena erneut ausführen und vorher/nachher vergleichen.
