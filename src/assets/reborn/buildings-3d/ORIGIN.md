# Atlas-Gebäudemodelle

Originale Projektgeometrie unter `scripts/animation/atlas-buildings.js`: Feldkommando, Bastion, Kaserne, Fahrzeugfabrik, Flugfeld, Energiekern und Geschützturm. Keramiklack, Bronze, dunkle Mechanik, Fraktionslack und Emission verwenden die Materialpalette des vom Nutzer freigegebenen Legionärs. Keine externen Gebäudemodelle oder Bildgenerator-Frames.

15 vollständige GLB-Dateien: sieben Typen in Blau und Rot, dazu eine neutral weiß leuchtende Bastion. Die GLB-Dateien enthalten reale `BeaconPulse`-Animationen; Feldkommando und Bastion zusätzlich `RadarSpin` mit 48 Sekunden Umlaufdauer. Modell und Animationen lassen sich in der lokalen Modellgalerie ansehen und herunterladen.

Spielgrafik: fest gerenderter transparenter Grundkörper mit integriertem Bodenschatten. Bewegliche Schüsseln sind als 64 tatsächlich gerenderte Ansichten mit fester Registrierung separat gespeichert. Diese zugeschnittenen Layer besitzen denselben projizierten Weltursprung wie der Grundkörper. Der Bodenschatten bleibt während der Schüsseldrehung unverändert. Leuchtpunkte verwenden ebenfalls registrierte Ausschnitte.

Reproduzierbarer Export: `npm run assets:buildings`, optional `-- headquarters bastion`. Three.js und dessen GLTFExporter sind Entwicklungswerkzeuge unter MIT; der Lizenztext für den separaten lokalen 3D-Inspektor liegt unter `/vendor/three/LICENSE`.
