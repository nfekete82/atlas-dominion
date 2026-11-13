# Sandforge Building Design System — 13.11.2026

Implementierter, lokal geprüfter Stand auf `feat/hq3-building-design-system-20261113`, abgeleitet von `9274482c` auf `feat/webgl-facilities-preview-smallarms-20261110` ([PR #280](https://github.com/nfekete82/sandforge/pull/280)). Die fachliche Abnahme ist wegen der unten genannten Grenzen noch offen. Keine Änderung an Simulation, KI, Einheitenwerten, Kollision, Spielständen oder originalen GLBs.

## Tatsächlich umgesetzt

- **HQ3 / Feldkommando:** Originalmodell, UV-Texturen, PBR, Türen, feste Schüsselhalterung, Radar, Zaun und Versorgung bleiben erhalten. Der Referenz-Hash ist durch einen Regressionstest gesichert. Gleiche neue Bau-Infrastruktur, bestehender HQ-Bauablauf unverändert.
- **Kaserne:** Originale geschlossene/betriebsbereite GLBs mit bestehender Silhouettenbereinigung. Zusätzlich wurden die verwaiste Kappe des entfernten Wachturms und zwei redundante Lüfterkästen entfernt; der mittlere Lüfter bleibt erhalten. Das zuvor im Build fehlende Silhouettenmodul wird jetzt ausgeliefert. Fassaden erhalten echte HQ3-Tarntexturen und Normaldetails; Dachflächen erhalten die echte dunkle Dachtextur. Türhöhe aus Soldatenmaßstab abgeleitet. Bereits offen exportierte Türblätter erhalten eine korrekte geschlossene Ruhelage. Zwei feste Rückflächen hinter der Tür werden ausschließlich im gemessenen Durchgang ausgeschnitten. Soldaten gehen waagerecht durch die Schwelle und anschließend zur Bodenhöhe hinunter.
- **Fahrzeugfabrik:** HQ3-Fassaden/Dach/Metall, vorhandenes reales Rolltor, Produktionsausfahrt und offener Reparaturbereich erhalten. Kompakte Versorgung statt einer zu breiten Palette am Zaun.
- **Flugfeld:** Vorhandener funktionaler Ingame-Hangar und seine Tore erhalten HQ3-Oberflächen und dunkle Dachbögen. Veraltete, im GLB zusammengefasste Airfield-Aufbauten werden mit dem alten Hangar ausgeblendet, statt über der aktuellen Anlage zu schweben. Terrainangepasste Pisten, Markierungen, Wartung und Flugbewegung bleiben erhalten. Das tatsächlich verwendete Hangar-/Service-Modul ist prozedural; es wird in der Galerie ebenso verwendet.
- **Forschung:** Beide originalen GLBs erhalten HQ3-Tarnung, Dach- und Metallprofile. Vorhandener Radar-Pivot bleibt erhalten. Versorgung passt in den Zaun.
- **Silo:** Beide originalen GLBs erhalten HQ3-Fassaden und dunkle Abdeckungen. Der Weg jeder Abdeckung wird aus den echten geschlossenen/offenen Modellteilen gemessen und über 1,2 Sekunden interpoliert. Die stationäre Rakete erscheint erst bei freier Abdeckung. Der bestehende autoritative Lade-/Startablauf und das Flugprojektil bleiben erhalten.
- **Bastion MK2, Generator, Geschützturm, Interceptor und Sperrmauer:** Dieselbe Materialklassifizierung auf ihren echten Ingame-Modellen; Optiken, Signale, Waffen und Fraktionsmarken bleiben geschützt. Interceptor und Mauer sind vorhandene prozedurale Spielmodelle. Interceptor bleibt im normalen Katalog deaktiviert.

Vorhandene Zäune, Lampen und Ausrüstung stammen weiterhin aus den gemeinsamen Yard-Modulen. HQ3s Versorgung bleibt unverändert. Andere umzäunte Standorte erhalten eine kompakte Kiste-/Fassgruppe; ein 43 Einheiten breites Palettenensemble passt dort nachweislich nicht zwischen Gebäude und Zaun. Ein neuer Test prüft den rechten Zaunabstand bei allen vier Ausrichtungen.

## Referenzmessung und Materialbibliothek

[Asset-Audit](asset-audit.json), [Pixel-/Tarnfleckenanalyse](texture-audit.json), [extrahierte Originaltexturen](../../src/assets/reborn/buildings-3d/hq3-materials/ORIGIN.md).

HQ3 enthält 32 Meshes, 15 Materialien und neun eingebettete Bilder: sieben JPEGs sowie zwei transparente PNGs für Insignie/Stencil. Es gibt keine Roughness-/Metalness-Texturen; diese Werte sind skalare PBR-Faktoren.

| Familie | Echtes HQ3-Material | Bildauflösung | Roughness | Metalness |
| --- | --- | --- | ---: | ---: |
| Wüstentarnung | Desert_Camouflage_Weathered | Albedo + Normal jeweils 1536² | 0,91 | 0,02 |
| Anthrazitdach | Dark_Weathered_Roof | Albedo + Normal jeweils 1536² | 0,84 | 0,06 |
| Beton | Sand_Concrete_PBR | Albedo 1024² | 0,95 | 0,01 |
| Verwittertes Metall / Zaunprofil | Graphite_Metal | Albedo 512² | 0,63 | 0,42 |
| Tür / Außenausrüstung | Olive_Painted_Steel | Albedo 768² | 0,71 | 0,32 |
| Glas | Bestehendes Glas des jeweiligen Modells | unverändert | unverändert | unverändert |

HQ3 besitzt dunkle Schießscharten, kein übertragbares Glasmaterial. Die Bibliothek bewahrt deshalb vorhandene Fenster statt erfundener Glaswerte. Alle 15 Originalmaterialien einschließlich Betonakzenten, Stahl, Tür-/Schüsselmaterialien und Emission sind im Asset-Audit aufgeführt.

Gemessene sRGB-Cluster der Tarntextur: `#676c53` 48,08 %, `#aea388` 16,59 %, `#baaf93` 35,32 %. Dachcluster: `#373834`, `#40413c`, `#484944`. Diese Werte sind **Auswertungen**, keine per Auge gewählten Ersatzfarben: gerendert werden die unveränderten Originalpixel. Methode: JPEG-Dekodierung im Browser, RGB-k-means mit drei aus Pixelquantilen initialisierten Clustern, 20 Iterationen auf 384² Pixeln. Abnutzung kann Clustergrenzen teilen; die Zahlen sind keine exakte Pigmentsegmentierung.

Zusammenhängende Olivflächen umfassen unter anderem 14,04 %, 13,90 %, 6,77 % und 6,15 % der Texturfläche. UV-Bounding-Boxes sämtlicher Flächen ab 0,5 % sind dokumentiert. Die größeren Flecken bleiben in der RTS-Ansicht sichtbar.

UV-Dichte wurde als `sqrt(Weltoberfläche / UV-Fläche)` am unveränderten HQ3 gemessen. Daraus folgen gemeinsame Kachellängen: Tarnung 63,991, Dach 28,853, Beton 20,403, Metall 6,964 und Tür 12,046 Render-Einheiten. Nominale Dichte: Tarnung ca. 24,0 Texel/Einheit, Dach ca. 53,2; Abweichungen einzelner HQ-Flächen bleiben in den UV-Area-Daten sichtbar.

`webgl-building-design.js` stellt acht Materialfamilien bereit. Die Oberflächen verwenden die echten Albedo-/Normalbilder und PBR-Werte. Normalenbasierte Projektion wählt eine Gebäudeseite; Koordinaten sind einmalig in Modellkoordinaten mit fertiger Render-Skalierung gespeichert. Tarnung bleibt deshalb bei Drehung und bewegten Toren am Modell. Bestehende Positionen, Normalen, UVs, Indizes und AO werden geteilt, nicht neu kopiert. Geometrievarianten werden nach Quellgeometrie und Transform gecacht. Gemeinsam verwendete Texturen gehören der Bibliothek, nicht einzelnen zerstörten Gebäuden.

Schnee und Dschungel verwenden weiterhin die vorhandenen Biombeschichtungen; die Serviceanlagen übernehmen dort denselben Biomeinstieg. HQ3 bleibt auf Wüstenkarten vollständig vom neuen Beschichtungsdurchlauf ausgenommen. Teammarken bleiben separate bestehende Materialien; Besitzwechsel färben keine HQ3-Texturen nachträglich ein.

## Maßstab und Renderabmessungen

Die Quelle und die fertigen Skalierungen stehen in `asset-audit.json`. Die Galerie misst zusätzlich **tatsächlich sichtbare Dreiecke**: `Box3.setFromObject()` allein berücksichtigt auch unsichtbare Altteile und unbenutzte Vertices des entfernten Wachturms und ist deshalb kein zuverlässiges Rendermaß.

Infanterie: 61 × 0,56 = **34,16** Einheiten Höhe. Die gemessene Kasernentür ist 2,255 Quelleinheiten hoch. Horizontalskalierung bleibt 189,6 / 20,20000076; die Y-Skalierung ergibt sich aus `34,16 × 1,10 / (2,255 × Horizontalskalierung)` = **1,77532**. Dadurch wächst die sichtbare Silhouette von ca. 86,0 auf 119,2 Einheiten und die Tür von 27,1 auf **37,576**. Breite, Tiefe, Geländeauflage, Yard-Skalierung und autoritative Spielfläche bleiben erhalten. Andere Proportionen wurden nicht neu skaliert.

Die Galerie zeigt Modell- und Arealmaße getrennt. Quelle/normalisierte GLB-Hülle und sichtbares Areal sind unterschiedliche Messgrößen, besonders beim Flugfeld und bei der Fabrik mit Ausfahrtrampe. Aktuelle Browsermessungen: [gallery-browser-result.json](qa/gallery-browser-result.json).

| Modell | Sichtbares B × H × T | Areal B × H × T |
| --- | --- | --- |
| Feldkommando HQ3 | 161,2 × 173,8 × 160,7 | 324,3 × 173,8 × 212,8 |
| Kaserne | 189,6 × 119,2 × 180,5 | 249,3 × 119,2 × 192,2 |
| Fahrzeugfabrik | 190,7 × 125,0 × 236,8 | 350,7 × 125,0 × 255,2 |
| Flugfeld / Serviceareal | 366,8 × 112,1 × 363,7 | 366,8 × 112,1 × 363,7 |
| Forschung | 150,3 × 121,7 × 150,8 | 198,5 × 121,7 × 156,5 |
| Silo | 184,8 × 97,6 × 188,7 | 247,7 × 97,6 × 195,5 |
| Bastion MK2 | 112,4 × 190,2 × 116,0 | 112,4 × 190,2 × 116,0 |
| Generator | 70,2 × 92,0 × 77,0 | 160,3 × 92,0 × 78,6 |
| Geschützturm | 50,9 × 71,1 × 72,0 | 50,9 × 71,1 × 72,0 |
| Interceptor | 170,0 × 150,5 × 150,0 | 225,9 × 150,5 × 167,3 |
| Sperrmauer | 114,0 × 67,8 × 30,0 | 114,0 × 67,8 × 30,0 |

## Galerie und Animationen

`http://127.0.0.1:8095/building-gallery.html`

Alle elf Typen sind in einer Galerie erreichbar. Jede Zelle verwendet gleiche orthografische Kamera, identische PBR-Sonne/Fülllicht, denselben Wüstenboden und relativen Zoom. Die Startausrichtung zeigt HQ/Kaserne jeweils von ihrem Eingang. Ein echter Soldat dient als Größenreferenz. Filter für alle/ein Gebäude/HQ-Paar, gemeinsamer Zoom, Orbit-Steuerung, 90°-Drehung, Inspektion, Baufortschritt, Biome, Animationsauslösung und Draw-/Dreiecks-/Texturwerte sind vorhanden. Ein WebGL-Kontext rendert sichtbare Zellen bei Bedarf; im Ruhezustand läuft keine dauernde Galerie-Render-Schleife.

Produktionsdarstellung und Galerie teilen die echte Türpose, die gemessene Kasernen-Austrittsbahn, die bestehenden Hangartore, die Silo-Abdeckungen und die Dreiecks-Bauanimation. Baufortschritt wird ausschließlich aus der Simulation gelesen. Bei 0 % zeigt kein fertiges Gebäudedreieck, Yard-Objekt oder Servicebau eine fertige Geometrie. Temporäre Montagegeometrie wird nach Fertigstellung freigegeben; die gecachte Originalgeometrie wird wieder eingesetzt. Alle vier Ausrichtungen bleiben mit alten `facing`-Werten kompatibel.

- [HQ3 und Kaserne](qa/hq3-barracks-desert.png)
- [Nahansicht der Kaserne](qa/barracks-close.png), [Türaustritt](qa/barracks-walkout.png)
- [Bau 0 %](qa/construction-zero.png), [Bau 50 %](qa/construction-half.png)
- [Schnee](qa/hq3-barracks-snow.png), [Dschungel](qa/hq3-barracks-jungle.png)
- [Verteidigungsfamilie](qa/defense-family.png), [offenes Silo](qa/silo-open.png)

## Prüfung und Performance

**Bestanden:** Build/TypeScript, 95 gezielte Node-Tests und zwei neue Chrome-/WebGL-Browsertests. Die Browsertests kompilieren alle elf Gebäude in drei Biomen, prüfen vier Ausrichtungen, echte Bauzustände bei 0 % einschließlich der Serviceanlagen und die unveränderte autoritative Infanterie während der Kasernen-Produktion. [Live-Spielnachweis](qa/live-game-result.json). Die Screenshots wurden zusätzlich visuell angesehen; die automatischen Assertions sind keine manuelle Rundumprüfung jedes Gebäudes in jedem Biom.

Die vollständige Node-Suite ist bereits auf dem unveränderten Ausgangsstand nicht grün. Ein isolierter Checkout von `9274482c` ergab 1617 Tests: 1577 bestanden, 39 fehlgeschlagen, einer übersprungen. Der finale Lauf ergab 1628 Tests: **1596 bestanden, 31 bestehende Fehler, einer übersprungen; keine zusätzlichen fehlgeschlagenen Testfälle gegenüber der Basis**. Der finale Vergleich steht in [test-comparison.json](qa/test-comparison.json). Zu den Altfehlern gehören KI-/Kampagnenannahmen, veraltete Maß-/Layout-Assertions und drei HTTP-Fälle, die in dieser Sandbox kein Loopback-Listen öffnen dürfen. Acht veraltete Produktionsassertions wurden an den bereits geforderten Ablauf angepasst: während der Türöffnung bleibt die Einheit verborgen, erst danach tritt sie aus. Gameplay wurde dafür nicht verändert. Die verbleibenden Altfehler wurden außerhalb des Auftrags nicht repariert.

[Isolierter Rendervergleich](qa/render-costs.json) gegen den Ausgangscode: bei allen neun GLB-Hüllen gleiche Draw Calls und Dreieckszahlen vor/nach Materialauftrag. Beispielsweise Kaserne 32 / 9728, Fabrik 51 / 31870, Silo 32 / 17436. Zusätzliche Projektionsdaten benötigen zwölf Byte pro betroffenem Vertex (hier zusammen ca. 5,42 MiB für die neun untersuchten Hüllen); die gemessenen Werte stehen je Modell im Bericht. Keine neuen dynamischen Meshes für die Beschichtung.

Sieben gemeinsam geladene JPEGs: **2.194.452 Byte** zusätzliche Quelldaten, konservativ ca. **57,7 MiB GPU-Texturspeicher** inklusive Mipmaps bei unkomprimiertem RGBA. Der HQ3-Originalsatz bleibt zusätzlich erhalten. Kein kostenpflichtiger Dienst und keine neue Laufzeitabhängigkeit.

Die gemessenen synchronisierten Renderzeiten liegen überwiegend an der Browser-Auflösung von 0,1 ms. Daraus lässt sich kein verlässliches GPU-Leistungsversprechen ableiten. Der Vergleich umfasst GLB-Hüllen mit gleicher Kamera/Beleuchtung und derselben bereinigten Geometrie auf beiden Seiten, ohne Schatten, Terrain, Service-Yards oder Simulation; er isoliert den Materialauftrag. **Langzeitmessungen einer großen echten Schlacht und Prüfungen auf schwachen GPUs bleiben offen.** Die Galerie-Performancewerte sind ebenfalls kein Schlachtenbenchmark.

## Offene Abnahme und Grenzen

- Vollständige Gesamtsuite bleibt wegen dokumentierter Altfehler rot; deshalb als Draft behandeln und nicht ungeprüft mergen.
- Neue Materialprojektion/Normalmaps benötigen zusätzlichen Speicher und Fragmentarbeit. Große Matches und schwache GPUs sind noch gesondert zu profilieren.
- Produktionsausgänge von HQ/Fabrik und Flugbewegungen verwenden ihre vorhandenen Systeme. Ihre Node-Verträge bleiben geprüft; der neue Live-Ausgangstest fokussiert die Kaserne. Eine vollständige manuelle Abnahme aller Fahrzeuge/Flugzeuge an jedem Gelände-/Ausrichtungskombinationspunkt ist nicht erfolgt.
- Bestehende Gebäudeidentitäten und funktionale GLB-Geometrie wurden erhalten. Dies ist keine komplette Neumodellierung aller Fenster, Betonmodule oder Versorgungsteile. Das prozedurale Flugfeld/Interceptor ist ausdrücklich als reales vorhandenes Spielmodell dokumentiert.
- Keine vollständige geometrische Kollisionsprüfung jedes dekorativen Bauteils. Nachgewiesene Kasernen-Tür-/Treppen-, Zaun-/Versorgungs- und veraltete Flugfeld-Überlagerungen wurden korrigiert; der restliche vorhandene Szenenaufbau blieb erhalten.

## Lokale Mac-Terminalbefehle

```sh
cd /Users/norbertfekete/Projects/sandforge-bastion-wars
git fetch origin
git switch feat/hq3-building-design-system-20261113
git pull --ff-only
npm ci
npm run build
npm run test:building-design
npm ci --prefix tests/browser
npm run test:building-design:browser
npm test
npm run preview
```

Galerie danach: `http://127.0.0.1:8095/building-gallery.html`.

Reproduzierbare Analysen, mit laufendem Preview für den Rendervergleich:

```sh
npm run assets:building-reference
npm run assets:building-reference:textures
SANDFORGE_BASE_URL=http://127.0.0.1:8095 npm run benchmark:building-design
```

Die Browserbefehle verwenden standardmäßig den installierten Google Chrome. Vorhandener Server alternativ: `SANDFORGE_BASE_URL=http://127.0.0.1:8095 npm run test:building-design:browser`.
