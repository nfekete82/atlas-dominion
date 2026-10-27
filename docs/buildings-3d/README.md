# Militärische Wüstengebäude / 27. Oktober 2026

Alle sieben Gebäudetypen verwenden aktualisierte echte GLBs und daraus gerenderte Spiel-Sprites: Feldkommando, Fahrzeugfabrik, Kaserne, Flugfeld, Energiekern, Geschützturm und Bastion. Blau und Rot besitzen vollständige Fassungen; die Bastion zusätzlich eine neutrale Fassung mit weißer Beleuchtung und eigener `NEUTRAL / N / 00`-Kennzeichnung.

[Visuell geprüfte Sprite-Übersicht aller 15 Varianten](pbr-sprite-overview.png) · [Automatischer Asset-Prüfbericht](pbr-validation.json) · [QA-Status einschließlich Umgebungsgrenzen](pbr-qa.json)

Die Übersicht ist eine Offline-Montage der ausgelieferten Sprites einschließlich Radar, Sweep, Leuchten und Geschütz. Sie zeigt die bestehenden relativen Spielgrößen. Sie ist **kein Playwright-Screenshot**.

## Geometrie und Materialien

Die bearbeiteten Originalmodelle von HQ und Bastion unter `tools/building-sources/` bleiben unverändert. Ihre gesamten ursprünglichen Dreiecke, benannten Baugruppen, lokalen Transformationen und Animationsgruppen werden weiterverwendet. Die anderen fünf Gebäudetypen bauen auf `scripts/animation/atlas-buildings.js` auf.

`scripts/animation/building-details.js` ergänzt tatsächliche Geometrie:

- HQ: geschützte Lüfter, Luftkanäle, Leiter, austauschbare Seitenpanzerung, Versorgungsgehäuse und Beschriftung.
- Fabrik: beidseitige Panzerkassetten, Torführungen, Sicherheitsmarkierungen, Dachlüfter, Absaugung, Wartungsreling, Leiter und Ausrüstung.
- Kaserne: Fenster, Feldfunk, Lüfter, Leiter, Ausrüstungskisten und Teamtafel.
- Flugfeld: gerippter Hangar mit geneigtem Dach, segmentierten Stahltoren, Torführung, Wartungstür, Lüfter und markiertem Vorfeld; ursprünglicher Kontrollturm und Fundament bleiben erhalten.
- Energiekern: Kühlkörper mit einzelnen Lamellen, Kühlleitungen, Ventil, armierten Kabeln und Schaltkasten.
- Geschützturm: vorhandene detaillierte Lafette und Zwillingswaffe, zusätzliche Hydraulik, Nebelwerfer und Kennzeichnung an der beweglichen Baugruppe.
- Bastion: Verstärkungen, Ankerbolzen, Wartungsgehäuse, Kabel und eigene Team-/Neutraltafel.

Neue statische Kleinteile werden je Oberfläche zusammengefasst; pro Modell kommen höchstens sechs Meshes hinzu. Die Originalhierarchie bleibt erhalten.

`scripts/animation/building-pbr.js` erzeugt einen deterministischen **2048 × 2048**-Atlas mit sandfarbenem CARC-Lack, Wüstentarnung, abgenutztem Stahl, Gummi, Glas, Sicherheitsstreifen und drei Kennzeichnungen. Oberflächendetails umfassen Staub, unregelmäßigen Schmutz, Lackabplatzer, Kratzer, vertiefte Fugen und erhöhte Schweißnähte. Der Atlas enthält 1024px-Flächen für Sandlack und Tarnlack und 512px-Flächen für die übrigen Werkstoffe.

Drei gemeinsam verwendete Texturen werden vollständig in **jedes GLB eingebettet**:

- `textures/desert-basecolor.png`: sRGB-Albedo.
- `textures/desert-normal.png`: aus den Oberflächenhöhen abgeleitete Tangent-Normalen.
- `textures/desert-orm.png`: lineare Occlusion in R, Roughness in G und Metallic in B.

Die separaten PNGs liegen zusätzlich neben den Modellen als Authoring-Ressourcen. Die GLBs benötigen sie nicht als externe Dateien. Untexturierte Metallteile der importierten Quellen erhalten UV-Projektionen und fehlende Normalen. Alle PBR-Kanäle teilen `TEXCOORD_0`; ein zweiter UV-Puffer entfällt. Echte Fraktionsleuchten bleiben emissiv. Die Galerie besitzt eine lokal erzeugte PMREM-Umgebung für Metallreflexionen und verwendet identische eingebettete Texturen über die Modell-/Teamwechsel hinweg gemeinsam, statt je Variante drei weitere 2K-GPU-Texturen zu behalten.

## Registrierung und Laufzeit

Der RTS bleibt Canvas 2D und lädt ausschließlich die PNG/JSON-Spielgrafiken, keine 2K-Materialatlanten oder GLBs. Alle Gebäude-Spiel-PNGs zusammen belegen rund 4,60 MB gegenüber zuvor 4,35 MB. Grundkörper bleiben 512px groß, mit festem Pivot `[256, 382]` und gebackenem Bodenschatten. Radar und CaptureSweep behalten 64 eng zugeschnittene Ansichten; die Geschütztürme behalten 64 registrierte Waffenansichten samt beiden Mündungspositionen.

`RadarSpin` dauert weiterhin 48 Sekunden, `BeaconPulse` 3,8 Sekunden, `CaptureSweep` 12 Sekunden und `TurretTraverse` 2 Sekunden. Die Animationshierarchien der bearbeiteten Quellen sind erhalten. Die bestehenden Definitionen für Gebäude-/Einheitenskalierung, Kollision, Bauflächen, Simulation, Spielstände, KI und Kampfwerte wurden nicht geändert. Der generierte Geschütz-Mündungsrig bleibt gegenüber dem vorherigen Stand unverändert.

## Reproduzieren

```sh
# Gewohnter Three.js-/Playwright-WebGL-Export:
npm run assets:buildings
# Optional nur einzelne Gebäudetypen:
npm run assets:buildings -- headquarters factory

# Vollständiger Offline-Export ohne Browser, Server oder zusätzliche Pakete:
npm run assets:buildings -- --cpu

npm run typecheck
npm run build
npm run assets:buildings:validate -- --report
npm run test:animation
node scripts/audit-animation-assets.mjs --buildings
node scripts/preview-building-assets.mjs
ATLAS_BROWSER_CHANNEL=chromium npm --prefix tests/browser test -- --grep 'buildings PBR'
```

Der optionale CPU-PBR-Baker rendert dieselben echten Meshes, UVs, Animationsclips und registrierten Layer über den gemeinsamen Exporter. Er verwendet Tangent-Normalen, ORM, GGX-Beleuchtung, Schatten und zweifaches Supersampling. Seine Umgebungsreflexion ist eine analytische Näherung; die Galerie verwendet Three.js PMREM. Die aktuell gespeicherten Sprites wurden mit `--cpu` erzeugt; ihre Metadaten weisen `baker: cpu-pbr` aus.

## Technische und visuelle Prüfung

- TypeScript und vollständiger Build: erfolgreich.
- Vollständige Node-Suite: **668 bestanden von 669**. Der einzige nicht ausführbare Test ist `tests/http.test.mjs`: Die Umgebung verweigert lokale Server mit `listen EPERM`.
- Animation/Gebäude/PBR: **16 Tests bestanden**, einschließlich tatsächlichem glTF-Roundtrip und `AnimationMixer`-Ausführung aller exportierten Clips bei festen Fundamenten und Drehpunktpositionen.
- Asset-Audit: **15 GLBs bestanden**, einschließlich Buffer/Indices, aller UVs und Normalen, tatsächlicher eingebetteter Albedo-/Normal-/ORM-Pixel, Materialkontraste, Clip-Zeiten, Drehpunkte, Mündungen und jedes Sprite-Frames. Kein Gebäudekörper enthält weiße oder leere Ersatzflächen.
- Die Sprite-Übersicht und einzelne Modelle wurden als gerenderte Bilder geöffnet und visuell geprüft. Seitliche Panzerung an HQ und Fabrik wurde nach dieser Kontrolle nachgebessert.
- Playwright-Galerie- und Laufzeittests sind implementiert und in der regulären Browser-Suite registriert. Ihre Ausführung wurde versucht, scheitert hier am gesperrten lokalen Server (`127.0.0.1:8097`, `EPERM`). Auch ein separater Chromium-Start wird von der Umgebung beendet. **Browserdarstellung und Browser-Screenshots konnten hier deshalb nicht abschließend verifiziert werden.**
- Vier bereits vorhandene Regressionserwartungen verwendeten noch den früheren Roverpreis von 300 statt des unveränderten Katalogpreises von 350. Diese Tests referenzieren jetzt den Katalog; das Notfall-Budgetfixture finanziert den Rover vor dem separaten Infanterieauftrag. Spielbalance und Produktionscode bleiben unverändert.

## Git

Es wurde ausschließlich auf `feat/pbr-buildings-overhaul-20261027-144413` gearbeitet. **Kein neuer Commit**: Schreibzugriffe auf `.git/index.lock` sind in dieser Umgebung verboten; außerdem sind HTTP-/Browser-QA noch nicht vollständig ausführbar. Kein Push, Reset, Rebase oder Überschreiben vorhandener Commits.
