# Neues Meshy-Feldkommando – 14.11.2026

Das bestätigte Modell `Meshy_AI_LowPoly_Military_HQ_1113224548_texture(2).glb`
wird standardmäßig für `headquarters` geladen. Nur die Darstellung wird
ersetzt. ID, Baumenü, Lebenspunkte, Bauvorgang, Kollision, Pionierproduktion,
KI, Savegames sowie Soldaten bleiben unverändert.

## Dateien

- Original: 7.258.044 Bytes, SHA-256 `3cd32f7845dcf64707d71c682a0a3985e929ab18a42d76684ba5937153f63bf3`
- Optimiert: 1.432.064 Bytes, SHA-256 `d3fb94bd20cbf695c53c3b0de9d77d0d3c7c8c2704beb94c8c5666468a5fac00`
- Beide: 13.766 Dreiecke, 20.899 Vertices, identische Geometrie/UVs.
- Optimierung: Farbalbedo auf 1536 Pixel; weitgehend konstante
  Metallic/Roughness- und Normal-Maps durch PBR-Werte ersetzt.

## Einbindung

```sh
node scripts/install-meshy-headquarters.mjs ~/Downloads/sandforge-meshy-hq/headquarters.glb
npm run build:3d
PORT=8107 npm run preview
```

Anschließend `src/assets/meshy/headquarters.glb` im Feature-Branch committen,
damit der Binär-Asset-Upload auch wirklich in Git enthalten ist. Der GitHub-
Connector kann die hochgeladene Chat-Datei nicht als Binärblob weiterreichen.

Die URL `/src/assets/meshy/headquarters.glb` ist der Spiel-Asset-Pfad.
Wenn die GLB noch fehlt, lädt das Spiel das bisherige originalgetreue HQ3
als Fallback, nicht das stilisierte Spielzeug-HQ. Mit `?hq=hq3` wird
das HQ3 dauerhaft erzwungen; `?hq=stylized` bleibt als Alternative möglich.

## Einschränkungen

Das Meshy-Modell besteht aus einem einzigen Mesh ohne Animation oder Rig.
Die Schüssel ist statisch in die Geometrie gebacken. Eine zweite,
prozedurale Schüssel wird bewusst **nicht** eingeblendet. Für echte
Tür-/Radaranimation müssen die beweglichen Meshes zuvor getrennt werden.

Prüfen: Bauvorschau, Bodenkontakt, Rotation, Tür/Spawn-Position, Porträt,
Schatten, Baufortschritt und FPS. Keine Änderung an den Soldaten.
