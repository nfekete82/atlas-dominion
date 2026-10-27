# Atlas-Gebäudemodelle / Desert PBR Revision 4

Eigene Projektgeometrie: `scripts/animation/atlas-buildings.js`. Das aktive Feldkommando und die aktive Bastion übernehmen die bearbeiteten Originaldateien unter `tools/building-sources/`; diese Quellen sind unverändert erhalten. Import und Anbindung der bestehenden Animationshierarchie: `refined-headquarters.js` und `refined-bastion.js` im Verzeichnis `scripts/animation/`.

Das grafische Upgrade vom 27. Oktober 2026 ergänzt militärische Servicehardware über `scripts/animation/building-details.js` und ersetzt die flachen Oberflächen durch die deterministischen Wüsten-PBR-Atlanten aus `scripts/animation/building-pbr.js`. Kein externer Modell- oder Texturdownload, keine generierten 2D-Ersatzgebäude. Alle drei 2048px-Texturen (BaseColor, Tangent-Normal und gepackte Occlusion/Roughness/Metallic) sind in jeder GLB-Datei eingebettet; die zusätzlichen PNG-Quellen stehen unter `textures/`.

15 GLBs: sieben Typen in Blau und Rot, Bastion zusätzlich neutral. Echte `RadarSpin`-, `BeaconPulse`-, `CaptureSweep`- und `TurretTraverse`-Clips bleiben je nach Modell erhalten. Die sichtbare Teamkennzeichnung ist separat vom sandfarbenen Lack und der Tarnung angelegt.

Spielgrafik: Grundkörper mit festem Weltursprung und Bodenschatten, 64 registrierte Radar-/Sweep-/Waffenansichten und zugeschnittene Leuchtlayer. Das Spiel benötigt keine hochauflösenden PBR-Texturen oder externen Textur-URLs zur Laufzeit.

Export: `npm run assets:buildings`; CPU-Alternative ohne Browser: `npm run assets:buildings -- --cpu`. Die gespeicherten Dateien verwenden den CPU-PBR-Baker. Galerie und regulärer Export verwenden Three.js; der Lizenztext der lokalen Galerie liegt unter `/vendor/three/LICENSE`.

[Umfang, Reproduktion, Prüfergebnisse und bekannte Umgebungsgrenzen](../../../../docs/buildings-3d/README.md) · [Herkunft der bearbeiteten Quellen](../../../../tools/building-sources/ORIGIN.md).
