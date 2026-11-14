# Sandforge · GLB-PBR-Qualitätspipeline

Stand: 14. November 2026. Entwicklungsbasis: Feldkommando-MK2-Feature-Branch.

## Was sich ändert

- Extern importierte Meshy-GLBs behalten im Spiel **standardmäßig** Originalfarben, UV-Texturen, Normal Maps und Metallic/Roughness Maps. Sandforge überschreibt diese Materialien nicht mehr automatisch mit dem Desert-002-Shader.
- Beim Start erhält die WebGL-Szene eine subtile neutrale PMREM-Umgebung (RoomEnvironment, Intensity 0.38 in der Wüste). Die schwarze Außengrenze und das Wüstenterrain bleiben erhalten.
- GLB-Texturen erhalten höchstens 8x anisotrope Filterung, soweit der Browser/GPU dies unterstützen.
- Der GLTFLoader kann jetzt optional **EXT_meshopt_compression** und **KHR_texture_basisu/KTX2** dekodieren. Die notwendigen Decoder werden aus der gepinnten Three.js-Installation mitgebaut.
- Unveränderte Animationen, Geometrien, Team-Markierungen außerhalb des ursprünglichen GLB, Produktions- und Kollisionslogik bleiben erhalten.

## Schnelltest

Nach einem normalen `npm ci && npm run dev`:

- `/webgl-preview.html?models=meshy&glbAudit=1` — Meshy explizit aktivieren, tatsächlichen geladenen Assetpfad und Fallbacks kontrollieren.
- `/webgl-preview.html?glbMaterials=original&glbAudit=1` — Originalmaterialien auch für alle vorhandenen Sandforge-GLBs ansehen (QA-Modus, nicht Standard).
- `/webgl-preview.html?glbMaterials=sandforge&glbAudit=1` — die bisherige Färbung ausdrücklich anwenden, auch auf Meshy-Modelle.
- `/webgl-preview.html?pbrEnv=off&glbAudit=1` — neutralen PMREM-Effekt ausschalten, um dunkle PBR-Materialien zu vergleichen.
- `/glb-quality.html` — A/B-Viewer mit identischer Kamera und Beleuchtung. Links Original, rechts die neue Original-PBR-Pipeline oder der bisherige Sandforge-Farbpfad. Lokale, installierte Modelle unter `/src/assets/` sind zugelassen.

Das Audit zeigt `requested` und **tatsächlich geladenes Asset** (`actual`), inklusive Fallbacks. Es ist außerdem im Browser über `window.__sandforgeGLBAudit.entries` verfügbar.

## Lokale GLB-Prüfung

```bash
node scripts/audit-glb-file.mjs "$HOME/Downloads/mein-meshy-modell.glb"
```

Die Prüfung arbeitet nur mit den GLB-Metadaten und verändert keine Texturen. Sie nennt Geometrieanzahl, geschätzte Dreiecke, PBR-Texturen, Animationsnamen, Kompressions-Extensions und mögliche Probleme.

## Formate

**Empfohlen: GLB/glTF 2.0**. Erst Original-Materialien/Animationen validieren, anschließend optional eine zweite optimierte Variante mit KTX2-Texturen und/oder Meshopt-Geometrie erzeugen. Beides sind glTF-Erweiterungen, keine konkurrierenden 3D-Formate.

- KTX2: bei größeren Texturen sinnvoll; neue Decoder-Unterstützung im Spiel vorhanden. Farb- und Normal-Maps getrennt mit geeigneten Kompressionseinstellungen behandeln.
- Meshopt: Geometrie-Kompression für schnelle Downloads, Decoder im Spiel vorhanden.
- FBX: sinnvoll als *Arbeitsformat* für Rigging in Blender, **nicht** als bevorzugtes Browser-Laufzeitformat.
- Vor einem produktiven Austausch immer Sichtprobe bei echter RTS-Kameradistanz und Browser-FPS mit vielen Einheiten.
- Original-GLBs aufbewahren; komprimierte Varianten als neue Dateien testen, nicht blind ersetzen.

## Grenzen

Keine vollständige automatische Polygon-Reduktion oder dynamische LOD-Generierung: ein solches Verfahren könnte Türen, Bones und Turmpivots beschädigen. Die neuen Audits ermöglichen gezielte LOD-Entscheidungen, ohne bereits funktionierende Animationen zu gefährden.

Das Debug-Panel zeigt die URL tatsächlich geladener GLBs auch nach einem Fallback; optional installierte binäre Meshy-Dateien sind weiterhin nicht im Repository. Fehlen sie, bleibt der bewährte Ersatz aktiv.

## Referenzen

- https://threejs.org/docs/pages/GLTFLoader.html
- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
