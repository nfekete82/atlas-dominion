# Quellen für den Offline-Spriteexport

Diese acht unveränderten Modelldateien sind öffentlich als CC0 veröffentlicht. Autor, primäre Lizenzseite, ursprünglicher Download und SHA-256 stehen pro Datei in [manifest.json](manifest.json).

- soldier.gltf, engineer.gltf, heavy.gltf: Quaternius, Toon Shooter Game Kit.
- tank.fbx, artillery.fbx: Quaternius, Animated Tanks.
- rover.gltf, bomber.gltf: Quaternius, Ultimate Space Kit.
- helicopter.glb: kazuma, Helicopter auf Poly Pizza.

`CC0-License.txt` ist der originale mitgelieferte Quaternius-Hinweis. Die Lizenz des Hubschraubers ist auf seiner im Manifest verlinkten Veröffentlichungsseite als CC0 ausgewiesen. Änderungen an Materialfarben, Beleuchtung, festen Pivots und Exportansichten erfolgen reproduzierbar in `scripts/animation/`; die Quellmodelle selbst bleiben unverändert.

Export: `npm run assets:animations`. Quellen, tatsächliche Clips, Nutzungsgrenzen und Prüfungen sind in [ANIMATION_SYSTEM.md](../../docs/reborn/ANIMATION_SYSTEM.md) dokumentiert. Die Modelldateien und Three.js werden zur Spielzeit nicht geladen.
