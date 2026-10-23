# Zufallskarten und einheitliche Fahrzeuge

Stand: 23. Oktober 2026.

Jeder reguläre Seitenstart und jede neue Kampagne verwenden einen frischen 32-Bit-Seed aus `crypto.getRandomValues`. Laden setzt die gespeicherte Karte fort. Die 30 Sektoren und ihre Nachbarschaft bleiben als bestehende Einnahmeregel erhalten; Bastionspositionen, Sektorgrenzen sowie Form und Verteilung der Mesas wechseln mit dem Seed.

`world-generation.ts` verteilt Bastionen durch geschichtete Zufallsauswahl mit mindestens **440 Welteinheiten** Abstand. Um jede Bastion bleiben 155 Einheiten frei, um die beiden Startpunkte 335. Zwischen benachbarten Bastionen wird vor der Felsplatzierung ein Weg mit 85 Einheiten Halbbreite reserviert. Zusammen mit den freien Startflächen bilden diese Wege ein zusammenhängendes Wegenetz, auch um die Hauptquartier-Fußabdrücke herum. Die Felsen halten zusätzlich Abstand voneinander. Navigations- und Sichtmasken entstehen aus denselben facettierten Konturen, die der Renderer verwendet. Die Bodenskalierung bleibt fein; Felskanten sind native Vektorflächen statt vergrößerter Landschaftsausschnitte. Kristalle sind reine Dekoration.

Neue Spielstände ergänzen das bestehende Version-2-Format um `mapVersion: 1`. Geometrie wird reproduzierbar aus Seed und Kartenversion erzeugt. Fehlt dieses Feld oder ist es 0, wird weiterhin die bisherige statische Karte geladen. Unbekannte Kartenversionen werden abgelehnt. Terrain und Minimap werden bei Neustart und Laden neu aufgebaut. `/?debug&seed=2026` öffnet eine reproduzierbare neue Karte; `/?debug&legacy` dient den bisherigen Kampagnen- und Migrationsprüfungen.

Einheiten erfassen Gegner mit direkter Sichtprüfung im nächsten festen Simulationstakt (50 ms), unabhängig vom 200-ms-Rhythmus des Nebelrasters. Waffen behalten ihre bisherigen Nachladezeiten. Ein gültiger Gegner bleibt als `combatTarget` gebunden; Treffer eines zweiten Angreifers überschreiben ihn nicht. Tod, Verlust von Sicht/Schusslinie oder Verlassen der Waffenreichweite lösen den Fokus. Explizite Angriffsbefehle haben Vorrang. Marsch- und Shift-Aufträge bleiben während automatischer Gefechte erhalten. Die Zielbindung wird mitgespeichert.

## Fahrzeugmodelle

Die alten grauen Quellmodelle samt aufhellendem Luminanzshader sind für Fahrzeuge ersetzt. `scripts/animation/atlas-vehicles.js` erstellt sechs eigene Modelle in beiden Teamfarben: sandfarbene Keramik, Bronzekanten, dunkler Stahl, schwarze Reifen, blaue oder rote Emaille und passende Leuchtstreifen. Beleuchtung und ACES-Farbdarstellung entsprechen der freigegebenen Modellfamilie. Radnaben, Kettenglieder, Kabinen, Lüftungen, Luken und Waffen sind echte Geometrie. Schatten sind in die Körperframes gerendert. Turm und Kanonenrohr besitzen eigene registrierte Layer; ihre Mündung wird aus dem 3D-Modell projiziert. Katalogbilder setzen dieselben Layer zusammen.

Alle sechs Typen haben 16 Richtungen. Rover-Räder, echte Kettenglieder und Rotoren besitzen jeweils vier unterschiedliche gerenderte Phasen je Richtung. Beim Wenden laufen die beiden Ketten gegenläufig. Der Bomber hat starre Richtungsansichten und keine behaupteten zusätzlichen Gelenkanimationen. Treffer- und Zerstörungsclips für Fahrzeuge fehlen weiterhin; hierfür bleiben die vorhandenen Partikel und Wracks erhalten. Die GLBs unter `src/assets/reborn/animation/` enthalten die eigenen starren Modellteile; die Bewegungsphasen werden vom Exportskript gesetzt und sind in den PNG-/JSON-Atlanten enthalten. Die GLBs enthalten keine Skelettclips.

Reproduzieren:

```sh
node scripts/render-unit-atlases.mjs rover tank artillery scout gunship bomber
npm run assets:animation-audit
npm run test:reborn
npm run test:animation
npm --prefix tests/browser test
```

Die bisherigen acht CC0-Quellmodelle bleiben als Archiv erhalten; sie sind keine zusätzlich aktiven Fahrzeugmodelle. Die neue Fahrzeuggeometrie und die prozedurale Landschaft sind projekteigener Code und benötigen keine externen Grafikressourcen.

## Prüfung

- 100 deterministische Zufallskarten: Mindestabstand jedes Bastionspaars; freie Einnahmeflächen; exakte Laufpfade von beiden Starttruppen zu allen 30 Bastionen; jedes Pfadsegment frei von Felsen und Gebäuden.
- Reproduzierbare Seeds, neue Seeds pro Kampagne, unveränderte Karten nach Speichern/Laden, Migration alter Karten und Ablehnung unbekannter Kartenversionen.
- Sofortige Zielerfassung, Fokus bei zwei Angreifern, Wechsel nach dem ersten Abschuss, explizite Zielvorgabe, Sichtblockaden und erhaltene Befehlswarteschlangen.
- Chrome prüft echte Menü-Neustarts, Karten- und Minimap-Pixel, Speichern/Laden, Gefechte, Fahrzeuglayer und die vorhandenen Animationsszenen. Aufnahmen: [Neue Kampagne](random-campaign.png), [Zielbindung](target-focus.png), [Animationslabor](animation-lab-walk.png).

Abschluss: Build, Asset-Inventar, 44 gezielte Node-Prüfungen und alle 22 Chrome-Prüfungen gegen die aktualisierte Docker-Version auf Port 8095 bestanden. Die historische breite Archivsuite wurde für diesen Auftrag nicht erneut ausgeführt.
