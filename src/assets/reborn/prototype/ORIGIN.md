# Atlas Legion Infantry / Modellstudie 01

Originale geometrische Rüstung, Helm, Rucksack, Gewehr und prozedurales Lackmaterial: `scripts/animation/detailed-infantry.js` im Atlas-Dominion-Projekt. Erstellt als technische Arbeitsprobe; kein gekauftes oder bildgeneriertes fertiges Charakterpaket.

Skelett und zugrunde liegende Körperbewegungen: **Quaternius**, [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html), **CC0-1.0**. Originaldatei `tools/animation-sources/soldier.gltf`; Originalhinweis unter `tools/animation-sources/CC0-License.txt`. Die Körperclips wurden übernommen und in `detailed-clips.js` durch echte IK-Keyframes für beide Arme sowie modellierten Gewehrrückstoß angepasst. Die alte Figurengeometrie ist im Export ausgeblendet.

Export: `npm run assets:detailed-infantry`. Ausgabe: zwei animierte GLB-Dateien und zwei PNG-/JSON-Atlanten. Die fünf Clips sind `Idle`, `Run_Gun`, `Idle_Shoot`, `HitReact`, `Death`. Nach Freigabe durch den Nutzer ist diese Modellfamilie im Spiel aktiv: Infanterie, Pionier und schwerer Schütze teilen die Grundrüstung; Rolle, Werte und Größenunterschiede bleiben erhalten. Die Pfade unter `prototype/` bleiben für bestehende Modell-Links stabil. Mündungspositionen sind aus der tatsächlichen 3D-Waffe in jedem Frame registriert.

Exportwerkzeug und isolierter 3D-Inspektor: Three.js 0.180.0, MIT. Der Lizenztext wird nach `/vendor/three/LICENSE` kopiert. Das Hauptspiel bleibt Canvas 2D.

## Wüsteninfanterie, Revision 2

Drei dezente Tarnfarben auf Ärmeln und Hosen, sandfarbene Keramik, dunkles Gewebe und Stahl. Farb-, Normal- und Roughness-Maps werden lokal mit festem Seed (74) bei 256 × 256 Pixeln erzeugt und zwischen Bauteilen geteilt. Vereinfachte Rundungen kleiner Details halten das Modell trotz 246 Teilen bei 61.088 Dreiecken (vorher 78.780).

`Atlas_Rifle` bleibt unter `Atlas_WeaponSocket` an `Index1R`. Die benannten Griffrahmen `Atlas_GripR` und `Atlas_GripL` bestimmen Handposition und Handgelenkausrichtung. Alle fünf Clips erhalten bei 60 Hz gebackene Zweiarm-IK; die Körperbewegungen bleiben erhalten. Low-Ready, angelegtes Feuer mit 18 mm Rückstoß sowie Treffer und Tod nutzen dieselbe Bindung. Der Mündungsknoten `Atlas_MuzzleBore` behält seine lokalen Koordinaten `[0, 0.018, 0.552]`; die Spritekoordinaten werden je Frame aus diesem Knoten projiziert.

Beide Fraktionen: jeweils `infantry-{0,1}.glb`, `.png` und `.json`, mit 296 Frames, acht Richtungen, unverändertem Fußpunkt `[96,156]` und allen fünf Zuständen. Die vorhandene Spielregistrierung `src/reborn/asset-paths.ts` lädt diese Atlanten für Infanterie, Pioniere und schwere Schützen.

Prüfbelege und Ergebnisse: [Mehransichten und Griffkontrolle](../../../../docs/detailed-models/desert-infantry/README.md).
