# Modellstudie 01 / animierter Legionär

Ein konkret nutzbarer erster Modellprototyp zur Frage, ob detailliertere zusammenhängende Modelle mit Animationen erstellt werden können. Das ist **eine Figur in zwei Teamfarben**, keine bereits fertige neue Einheitenfamilie.

- [Echtes 3D-Modell drehen und animieren](http://127.0.0.1:8095/model-3d.html)
- [Sprite-Vergleich bei Vergrößerung und tatsächlicher Spielgröße](http://127.0.0.1:8095/model-preview.html)
- [Standbild](infantry-3d.png), [Lauf-/Posevergleich](infantry-walk.png), [Browseraufnahme](infantry-3d.webm)

## Tatsächlich erstellt

151 geometrische Teile, 78.780 Dreiecke: geschichtete Brust-/Beinpanzerung, geschlossener Helm mit leuchtendem Visier, Schulterplatten, Gelenkverbindungen, Handschuhe mit Knöchelplatten, Stiefelprofil, Kühlrippen, Verschlüsse, Rucksack und Gewehr. Dasselbe Materialsystem verwendet sandfarbenen Keramiklack, Bronze, dunkle flexible Verbindungen und Blau beziehungsweise Rot. Prozedurales Lackrauschen ist im GLB eingebettet; es gibt keine externen Texturdownloads.

Die fünf exportierten Bewegungsclips basieren auf dem vorhandenen CC0-Skelett und den Körperbewegungen von Quaternius. Für Stehen, Laufen und Schießen werden **beide Arme** offline auf die Gewehrgriffe gelöst und als normale Quaternion-Keyframes mit 30 Samples pro Sekunde gebacken. Der Gewehrrückstoß wird als echter Node-Positionskanal exportiert. Der maximale gemessene Gelenkfehler an den Samples beträgt rund 0,0000002 Modellmeter. Eine unabhängige Browserprüfung misst zusätzlich die Griffabstände im wieder geladenen GLB zwischen den Samples.

Die Spriteausgabe enthält acht Ansichten, sechs Stand-, acht Lauf-, sechs Schuss-, fünf Treffer- und zwölf Todesphasen je Richtung: 296 Frames pro Team. Feste 192-Pixel-Zellen mit Pivot (96,156), nativer Spielmaßstab 0,5. Kontakt-/Bodenschatten entstehen beim 3D-Rendern und sind im Atlas enthalten. Die Modellansicht verwendet normales WebGL mit Mausdrehung; der Spritevergleich verwendet Canvas 2D. Das Hauptspiel lädt weiterhin seine bisherigen Atlanten.

## Gestalterische Grenzen dieser Arbeitsprobe

Die Rüstung wurde aus prozedural erzeugten technischen Körpern aufgebaut. Sie hat mehr echte Geometrie und zusammenhängende Animationen als die einfache Ausgangsfigur, wirkt aber noch blockig und stilisiert. **78.780 Dreiecke allein bedeuten keine ausmodellierte realistische Figur.** Die organische Anatomie, feinere Oberflächen, Übergänge zwischen Rüstungsteilen und die genaue Gestaltung der Nutzervorlage sind noch nicht vollständig ausgearbeitet.

Die Lauf-/Körperbewegungen sind abgeleitete vorhandene Clips. Die neue Ausrüstung benötigt weitere individuelle Anpassungen; insbesondere Armplatten können sich bei engen Posen überschneiden. Treffer und Tod verwenden die vorhandenen Körperbewegungen ohne eigene Fall-/Waffenablage-Choreografie. Mündungsfeuer, Audiosignale und Fahrzeugmodelle sind nicht Gegenstand dieser Modellstudie. Vor einem Austausch der gesamten Spielgrafik ist weitere gestalterische Arbeit nötig.

## Dateien und Prüfung

Modelle, Atlanten und Herkunftshinweis: `src/assets/reborn/prototype/`. Reproduzierbarer Modellbau: `scripts/animation/detailed-infantry.js`; Skelettanpassung: `detailed-clips.js`; Export: `detailed-export.js` und `scripts/export-detailed-infantry.mjs`.

```sh
npm run assets:detailed-infantry
npm run build
ATLAS_BASE_URL=http://127.0.0.1:8095 npm --prefix tests/browser test -- --grep 'model study|complete browser loop'
```

**Drei gezielte Chrome-Prüfungen bestanden:** echte Geometrie-/Clipdaten im GLB, sich verändernde Beinrotationen, beidhändige Registrierung zwischen Samples, alle fünf Zustände, Teamwechsel, Mausdrehung, gültiger GLB-Download, acht verschiedene Laufrichtungen, Spritevergleich und unveränderter Kampagnenablauf. Beide Modellprüfungen bestanden zusätzlich gegen die fertig neu gebaute Docker-Auslieferung auf `127.0.0.1:8095`; die unabhängige Griffprüfung verwendet eine Toleranz von 0,015 Modellmetern zwischen den Keyframes. Aufnahmen wurden im tatsächlichen Browser erstellt. Die vollständige Archivtestsuite wurde für diese separate Arbeitsprobe nicht wiederholt.

Quellrig: [Quaternius Toon Shooter Game Kit, CC0](https://quaternius.com/packs/toonshootergamekit.html). Die Ursprungsgeometrie wird im neuen GLB nicht angezeigt. Eigene Rüstung/Materialien sind im Projektcode nachvollziehbar; keine Imagegen-Bilder und keine behauptete automatische Erzeugung eines fertigen realistischen Figurenpakets.
