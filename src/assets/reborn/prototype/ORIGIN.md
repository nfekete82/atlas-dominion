# Atlas Legion Infantry / Modellstudie 01

Originale geometrische Rüstung, Helm, Rucksack, Gewehr und prozedurales Lackmaterial: `scripts/animation/detailed-infantry.js` im Atlas-Dominion-Projekt. Erstellt als technische Arbeitsprobe; kein gekauftes oder bildgeneriertes fertiges Charakterpaket.

Skelett und zugrunde liegende Körperbewegungen: **Quaternius**, [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html), **CC0-1.0**. Originaldatei `tools/animation-sources/soldier.gltf`; Originalhinweis unter `tools/animation-sources/CC0-License.txt`. Die Körperclips wurden übernommen und in `detailed-clips.js` durch echte IK-Keyframes für beide Arme sowie modellierten Gewehrrückstoß angepasst. Die alte Figurengeometrie ist im Export ausgeblendet.

Export: `npm run assets:detailed-infantry`. Ausgabe: zwei animierte GLB-Dateien und zwei PNG-/JSON-Atlanten. Die fünf Clips sind `Idle`, `Run_Gun`, `Idle_Shoot`, `HitReact`, `Death`. Nach Freigabe durch den Nutzer ist diese Modellfamilie im Spiel aktiv: Infanterie, Pionier und schwerer Schütze teilen die Grundrüstung; Rolle, Werte und Größenunterschiede bleiben erhalten. Die Pfade unter `prototype/` bleiben für bestehende Modell-Links stabil. Mündungspositionen sind aus der tatsächlichen 3D-Waffe in jedem Frame registriert.

Exportwerkzeug und isolierter 3D-Inspektor: Three.js 0.180.0, MIT. Der Lizenztext wird nach `/vendor/three/LICENSE` kopiert. Das Hauptspiel bleibt Canvas 2D.
