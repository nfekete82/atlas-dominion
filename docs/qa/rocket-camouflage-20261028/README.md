# Raketenwerfer: Tarnlackierung wie beim Panzer

Der Raketenwerfer verwendet jetzt dieselbe originale Oliv-/Braun-/Sand-Tarntextur wie der bestehende Leopard-Panzer. Der Offline-Generator liest ausschließlich das eingebettete `tan`-Base-Color-Bild aus `tank-0.glb`, ergänzt deterministische feine Lackkratzer und Schmutzspuren und bettet die neue 2048²-Textur in beide Raketenwerfer-GLBs ein. Es gibt zur Laufzeit keine Abhängigkeit vom Panzer-Download.

Die flächenweise UV-Projektion verwendet wie der Panzer 0,42 Wiederholungen pro Meter. Kabine, Türen, Motorverkleidung und Werfer behalten dadurch einen gemeinsamen Mustermaßstab. Dezente Höhenpatina über Vertexfarben verschmutzt den unteren Aufbau zusätzlich. Normal- und ORM-Maps bleiben 1024². Die lackierten Flächen wurden auf weniger metallischen Glanz abgestimmt; Teammarkierungen, Glas, Reifen und Hydraulik behalten ihre eigenen Materialien.

Beide Team-GLBs und beide 16-Richtungs-Spriteatlanten wurden neu gebaut. Die Geometrie bleibt bei 46.770 Dreiecken und 33 Draw Calls; Animationen, Mündungen, Spielgröße, Balance und Saveformat sind unverändert. Panzer-, Bomber- und Helikopter-Assets sind per SHA-256 unverändert.

## Prüfung

- `npm test`: 702 bestanden, keine Fehler; ein bereits zuvor optional übersprungener Premium-Infanterie-Test.
- 19 gezielte Modell-/Regressionsprüfungen bestanden.
- Fünf Chrome-Prüfungen auf localhost:8095 bestanden, einschließlich echter Oliv-/Braun-/Sand-Farbanteile, 2048²-Auflösung, projizierter UVs, beider Teams, vollständigem Werferhub, aller Sprite-Richtungen, Fabrikproduktion und Raketenwirkung.
- Beide GLBs bestehen den offiziellen Khronos-Validator mit null Fehlern und null Warnungen.
- Die früher dokumentierten Browser-Altfehler wurden für diese reine Lackierungsänderung nicht erneut im Gesamtlauf ausgeführt.

`gallery-blue.png`, `gallery-detail.png`, `gallery-red.png`, `sprite-directions.png` und `game-firing.png` zeigen den tatsächlichen neuen Stand. Reproduzieren: `npm run assets:rocket-launcher`.
