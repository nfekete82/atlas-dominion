# Sandforge Prop-PBR-Veredelung · 30.10.2026

[Vorher/Nachher bei Spielzoom 1,0](comparison-normal-zoom.png) · [Vorher](before-normal-zoom.png) · [Nachher](after-normal-zoom.png) · [Prüfergebnis](validation.json)

Der Vergleich zeigt denselben pausierten Aufbau im echten Spielrenderer, dieselbe Kamera, Gebäudeausrichtungen und Prop-Größen. Beide Weltansichten sind im Vergleichsbild pixelgetreu zugeschnitten, nicht vergrößert. Erkennbar sind insbesondere Tarnlackierung und Gebrauchsspuren der Kisten, gealterte Technikboxen, staubige Metallteile und die stärkere natürliche Materialvariation. Feine Poren, Kratzer und Gewebefasern liegen zusätzlich in den Mastertexturen; ihre Lesbarkeit hängt bei den kleinen Spielgrößen von der Pixeldichte ab.

## Materialien

`scripts/animation/prop-pbr.js` erzeugt deterministische Albedo-, Tangent-Normal- und gepackte Occlusion-/Roughness-/Metallic-Maps. Oberflächenrevision 2 verwendet 1024px für Metall, Lack, Knochen, Rinde und Gewebe; Blatt- und Trockenwedelmaterialien verwenden 512px. Die Auflösung steht jeweils vollständig pro Oberfläche zur Verfügung, statt einen kleinen Ausschnitt des bisherigen Gebäudeatlanten zu belegen.

- **Kisten/Stacks:** verwaschene Wüstentarnung, unregelmäßig freigelegte Metallkanten, Lackkratzer, dunklere Fugen, Schweißnahtrelief und staubige untere Flächen. Bestehende Schrauben, Verschlüsse und Griffe bleiben dieselben Meshes und erhalten passende Oberflächen.
- **Lampen:** gebürstetes, stumpfes Metall, schwache Oxidation, rauer dielektrischer Staub auf Flansch und Sockel, leichte Abnutzung und zurückhaltende warme Leuchtflächen.
- **Technikbox:** gealterter graugrüner Lack, Ablaufspuren, gebrauchte Metallkanten, staubiger Betonsockel, differenziertes Schutzglas und Gummidichtungen.
- **Fässer:** gealterter Tarn-/Sandlack, Abrieb, zurückhaltende Oxidation an Metallteilen, Staub und unterschiedliche Materialrauheit.
- **Sandsäcke:** Jute-Kreuzgewebe mit aus Oberflächenhöhen abgeleiteten Normalen, dunkleren Verschmutzungen und unterschiedlichen Sacktönungen.
- **Schädel:** poröses, mineralisch verfärbtes Knochenmaterial, feine Brüche und dunklere/sandfarbene Ablagerungen an Materialvertiefungen.
- **Palme:** faserige Rinde mit Blattnarben und Furchen; variierende natürliche Grüntöne, Blattadern, Mittelrippen, ausgetrocknete Spitzen und braune untere Wedel.

Albedo, Normalen und ORM beziehen sich auf dieselben Abnutzungs-/Höhenfelder: freigelegtes Metall ist weniger rau/metallischer, Staub rauer und nicht metallisch, Vertiefungen besitzen passende Occlusion. Neue Canvas-Objekte im Spiel gibt es nicht; Texturerzeugung findet ausschließlich beim Offline-Export statt.

## Unveränderte Geometrie und Darstellung

Referenz ist `cbe0d1d` auf `feat/sandforge-3d-prop-pack-palm-skull-20261030`. Die Testreferenz `tests/fixtures-prop-pack-v1.json` enthält Material-unabhängige SHA-256-Werte aller ursprünglichen Positions-, Normalen-, UV- und Indexpuffer sowie aller Knotentransformationen.

Alle acht GLBs bestehen den Vergleich unverändert. Mesh-/Dreieckzahlen, Größen, Kamerawinkel, Beleuchtung, Schatten, Supersampling, Atlaszuschnitte, Pivots und `solidWidth` stimmen weiterhin exakt. Sogar der gesamte Alphakanal des gerenderten Atlas ist bytegleich: Silhouetten und Schattenabdeckung bleiben erhalten.

Die vorhandenen UV-Puffer bleiben bestehen. Materialseitige `KHR_texture_transform`-Registrierung erschließt die höher aufgelösten Oberflächen. Der bestehende CPU-PBR-Baker wertet dafür jetzt dieselbe Texturmatrix aus wie Three.js. Ein gezielter Test vergleicht das Ergebnis mit äquivalenten direkt registrierten UVs. Standardmaterialien mit Identitätsmatrix behalten ihre bisherige Abbildung. Der Browser lädt alle acht fertigen GLBs mit Three.js und prüft eingebettete Maps und identische Registrierung aller PBR-Kanäle.

Keine Änderungen unter `src/reborn/`: Slotlogik, freie Eingänge, Bauvorschau, R-Hinweis, Ausrichtung, Umweltplatzierung, Simulation, KI und Savegames bleiben unverändert. Die Laufzeit lädt weiterhin nur PNG/JSON. Der Atlas bleibt 1896 × 2080 mit 32 Ansichten und wächst von 1.714 auf 1.792 MiB, also rund 80 KiB. Die größeren GLB-Master und Materialmaps werden nicht im Spiel geladen.

## Reproduktion und Prüfung

```sh
npm run assets:props
npm run assets:props -- --check
npm run build
node --test tests/reborn-prop-pbr-polish.test.mjs tests/reborn-building-decor.test.mjs tests/reborn-prop-pack.test.mjs tests/reborn-building-orientation.test.mjs tests/reborn-palm-knockdown.test.mjs tests/reborn-atmosphere-v1.test.mjs tests/reborn-battlefield-atmosphere.test.mjs tests/reborn-construction-assembly.test.mjs tests/reborn-production-ready-notifications.test.mjs tests/reborn-building-pbr.test.mjs tests/reborn-building-rigs.test.mjs tests/reborn-animation.test.mjs tests/savegame.test.mjs
npm --prefix tests/browser test -- --grep 'construction: R|3D prop pack|Atmosphere 1.0|prop PBR polish'
```

- [Asset-Export](asset-export.txt): alle acht GLBs und Atlas neu erzeugt.
- [Bytegleicher Neu-Export](asset-check.txt): erfolgreich für sämtliche GLBs, PNG und JSON.
- `npm run build`: erfolgreich.
- [Node-Tests](node-tests.txt): **60 bestanden, 0 fehlgeschlagen**. Einschließlich Geometrie-/UV-Identität, Materialdaten, unveränderter Atlasregistrierung, freien Eingängen bei beiden Ausrichtungen, Determinismus, Savegames, Fertigmeldungen, Bauphasen und bestehender Gebäudeanimationen.
- [Browser-Tests](browser-tests.txt): **5 bestanden, 0 fehlgeschlagen**. R-/HUD-Rotation mit echter Platzierung und Save/Load; alle Prop-Arten; Atmosphärenzustand; tatsächliche Spielansicht bei Zoom 1,0; vollständiger GLB-/PBR-Roundtrip in Three.js.
- Atlas und Vorher-/Nachher-Spielansicht visuell geöffnet und geprüft. Im unvergrößerten 1600 × 1000-Vergleich ändern sich 12.291 Pixel um mehr als sechs summierte RGB-Stufen.

Unabhängige Altfehler wurden nicht bearbeitet.
