# Sandforge 3D Prop Pack V1 · 30.10.2026

Aktuelle Materialveredelung: [PBR-Revision 2 mit Vorher-/Nachher-Vergleich und neuen Prüfungen](../props-pbr-polish/README.md). Die folgende Beschreibung dokumentiert den ursprünglichen Pack-Stand.

[Browser-Sichtung: Gebäude, gespiegelte Versorgungsplätze, Fahrzeuge, Palmen und Schädel](runtime-review.png) · [Transparenter 3D-Atlas](../../src/assets/reborn/props-3d/props.png)

Acht originale Masterassets in `src/assets/reborn/props-3d/`:

- `military-crate.glb`: verstärkte Transportkiste mit Deckeldichtung, Verschlüssen, Griff, Serienplatte und Eckschutz.
- `military-crate-stack.glb`: drei Kisten unterschiedlicher Ausrichtung auf einer Palette.
- `service-lamp.glb`: konischer Mast, verschraubte Bodenflansche, Wartungsklappe, gebogener Ausleger und LED-Gehäuse mit Kühlrippen.
- `service-terminal.glb`: wetterfester Wartungsschrank, Sockel, Schutzglas, Lüftungslamellen und Versorgungskabel.
- `fuel-barrels.glb`: zwei Fässer mit verstärkten Ringen, Füllverschlüssen und Bestandsplatten.
- `sandbags.glb`: fünf unregelmäßig gefüllte Jutesäcke mit Nähten und gebundenen Enden.
- `desert-skull.glb`: kleiner ausgebleichter Tierschädel mit echten Orbital-/Nasenöffnungen, Hornkernen, Kieferfragmenten und zwei Langknochen.
- `palm-tree.glb`: gebogener Stamm, Blattnarben, Wurzelansatz, 20 gebogene Wedel mit einzeln modellierten Fiederblättern und trockenen unteren Wedeln.

Alle GLBs sind eigenständig: Geometrie, UVs, Normalen und Albedo-/Normal-/ORM-Texturen sind eingebettet. Militärprops verwenden dieselben CARC-Sand-/Tarn-/Stahloberflächen wie die Gebäude, auf 1024px-Mastermaps; Knochen, Jute, Rinde und Blätter haben eigene deterministische PBR-Oberflächen. Keine Fremdmodelle oder externen Bildquellen.

## Export und Laufzeit

```sh
npm run assets:props
npm run assets:props -- --check
npm run build
node --test tests/reborn-building-decor.test.mjs tests/reborn-prop-pack.test.mjs tests/reborn-palm-knockdown.test.mjs
npm --prefix tests/browser test -- --grep 'construction: R|3D prop pack|Atmosphere 1.0'
```

Der bestehende `CPUBuildingRenderer` rendert dieselben Meshes, die als GLB exportiert werden: GGX-PBR, Normalen/ORM, Shadowmap und 2× Supersampling. Gebäude und Props teilen `isometricStage`: Kamera `[0,8,12]`, 45°-Modellrotation, Ausgangspivot `[256,382]`, Wüstensonne und transparente Schattenfläche. Pro Prop werden vier echte 3D-Ausrichtungen gebacken; Zoom und Zuschnitt variieren, Kamerawinkel und Beleuchtung bleiben gleich. `props.json` enthält Pivots, Frames, Maßstab und SHA-256 jedes Masters und des PNG. `--check` hat sämtliche Dateien bytegleich reproduziert.

Das Spiel lädt ausschließlich den gemeinsamen PNG/JSON-Atlas (32 Frames, rund 1,72 MiB PNG), keine GLBs oder PBR-Texturen. `BuildingDecor` enthält keinerlei Form-, Symbol- oder Glow-Zeichnung mehr. Die frühere illustrierte Palme und deren Canvas-Verformungen sind aus dem Live-Pfad entfernt. Palmen verwenden vier feste 3D-Ansichten mit unveränderter Bodenverankerung und Schattenrichtung.

Feste Slots: HQ 5, Kaserne 3, Fabrik 4, Flugfeld 3, Generator/Geschützturm/Bastion jeweils 1. Vollständige Fassaden und der südöstliche Ausgang bleiben frei. Gespiegelte Gebäude spiegeln die Slotkoordinaten; die Sonne der Props wird nicht gespiegelt. Bei überlappenden neu gebauten oder unfertigen Gebäuden werden Props nur in der Darstellung unterdrückt. Bewegliche Einheiten dagegen blenden Palmen, Schädel, Kisten und Lampen nicht mehr aus.

Palmen und Schädel belegen jeweils etwa 3 % der möglichen Atmosphärendetails, mit zusätzlichem Abstand zu HQs, Startgebieten und Bastionen. Schädel bleiben etwa 15–23 Welteinheiten breit. Positionen und Ausrichtung entstehen rein aus dem Seed; dynamische Belegung kann nur die Sichtbarkeit ändern. Keine neuen Hindernisse, Sichtquellen, Simulationswerte oder gespeicherten Felder. Bestehende Spielstände benötigen keine Migration für diese Props.

## Prüfung

- `npm run build`: erfolgreich.
- 57 relevante Node-Tests: Asset-/GLB-/PNG-Prüfung, deterministische Slots, Fassaden-/Ausgangsabstände, tatsächliche opake Atlaspixel bei beiden Gebäudeausrichtungen, Umweltdichte/Belegung, alte Spielstände, Fertigmeldungen, 3D-Bauphasen, Gebäuderigs und Animationen.
- Drei gezielte Playwright-Tests bestanden: R-Hinweis und Tastatur-/HUD-Rotation, tatsächliche Platzierung und Save/Load, Laufzeitdarstellung aller Prop-Arten und Atmosphärenzustand. Der Browser lädt keine GLBs und keine alte `battlefield/palm.png`.
- Erweiterte Browserauswahl: 11/13 bestanden. Zwei vorhandene Fehler reproduzieren sich identisch mit den unveränderten Präsentationsmodulen aus dem Ausgangs-HEAD: `old paid HQ queues` erwartet 600 Credits/1 Einheit/Engineer-Queue und erhält 500/2/leere Queue; `production catalog shows three units per row` misst versteckte Karten mit Breite 0. Simulation, Migration und Katalog bleiben in diesem Art-Feature unverändert.
- Atlas und Browserbild wurden visuell geöffnet und kontrolliert. Das Browserbild ist eine pausierte, explizite Review-Aufstellung mit normalen und gespiegelten Gebäuden durch den tatsächlichen Spielrenderer.
