# Bearbeitetes Hauptquartier

`headquarters-refined.glb` ist die vom Nutzer bereitgestellte Bearbeitung des vorhandenen Atlas-Hauptquartiers. Am 23. Oktober 2026 unverändert aus `/Users/norbertfekete/Downloads/headquarters-refined.glb` übernommen.

SHA-256: `b5c94f638d9357c4e2a33775b38724734040be946b84eaf3c187f26e67ddeab4`.

Die Quelldatei enthält 112 Mesh-Instanzen, 60.652 Dreiecke, zusätzliche Dach-, Rahmen-, Glas- und Zierdetails sowie eingebettete Keramiktexturen. Die beiden eingebetteten PNGs sind identisch. Sie enthält keine Animationsclips; die benannten Gruppen `RadarDish` und `Beacon` sind erhalten.

`scripts/animation/refined-headquarters.js` importiert diese Datei für den reproduzierbaren Gebäudeexport. Die ursprünglichen Oberflächen und alle Dreiecke bleiben erhalten. Acht neue Schüsseldetails und eine Leuchtlinse werden unter die erhaltenen beweglichen Gruppen eingehängt, ohne ihre Ruheposition zu ändern. Das Aufteilen der materialweise zusammengefassten Ergänzungen ergibt 115 Mesh-Instanzen im Spielmodell. Die Clips `RadarSpin` (48 s) und `BeaconPulse` (3,8 s) werden wieder hergestellt. Nur Fraktionslack, Fraktionslicht und das ursprüngliche blaue Glas erhalten für Team Rot eine Farbvariante. Die übrigen bearbeiteten Materialien bleiben erhalten.

Export: `node scripts/export-atlas-buildings.mjs headquarters`. Das unveränderte Nutzermodell ist die Quelle; die bisherigen prozeduralen Hauptquartierdaten dienen nicht mehr als Exportquelle.

# Bearbeitete Bastion

`bastion-refined.glb` ist die vom Nutzer bereitgestellte Überarbeitung der Bastion. Am 23. Oktober 2026 mit `/Users/norbertfekete/Downloads/bastion-refined.glb` abgeglichen; die archivierte Datei ist bytegleich.

SHA-256: `60ec7556931c211bbe4136be5872de12c626ce2a760facadd055e0e5f12eda59`.

Die Quelle enthält 47 Mesh-Instanzen, 34.380 Dreiecke, eingebettete Keramiktexturen und die Clips `RadarSpin` (48 s), `BeaconPulse` (3,8 s) und `CaptureSweep` (12 s). Die ergänzten Schüssel-, Leuchtfeuer- und Sockeldetails sind bereits ihren Animationsgruppen zugeordnet und bleiben dort erhalten.

`scripts/animation/refined-bastion.js` übernimmt Geometrie, Oberflächen, Hierarchie und Clips unverändert. Für rote und neutrale Bastionen wird nur das Fraktionslicht umgefärbt. Der Gebäudeexport erzeugt registrierte Radar-, Leuchtfeuer- und Sweep-Ebenen für die Canvas-Darstellung; die GLB-Varianten behalten alle drei Clips. Export: `node scripts/export-atlas-buildings.mjs bastion`. Alle übrigen Gebäudetypen verwenden weiterhin ihre vorhandene Projektgeometrie.
