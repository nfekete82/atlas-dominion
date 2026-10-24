# Asset-Umfang des Release-Entwurfs 1.9.0

Der bereits umfangreiche lokale Entwicklungsstand wurde erhalten. Diese Übersicht beschreibt den vorgesehenen Gesamtumfang und unterscheidet ihn vom abschließenden Qualitätsdurchgang am 24.10.2026. Keine HQ-/Bastion-Quelle wurde bei diesem Qualitätsdurchgang neu exportiert oder überschrieben.

| Verzeichnis | Enthaltene Änderungen / Nachweis |
| --- | --- |
| `src/assets/reborn/prototype/` | Eigene Infanterie- und Rollen-GLBs/Atlanten/Metadaten für beide Fraktionen; Sanitäter, Bauarbeiter und schwere Infanterie |
| `src/assets/reborn/animation/` | Sechs eigene Fahrzeug-/Flugmodelle, Fraktionsatlanten und laufende Rad-/Ketten-/Rotorphasen; Raketenwerfer und Transportheli |
| `src/assets/reborn/buildings-3d/` | Kleinere unabhängige Turmköpfe und zwei Mündungen; überarbeitete Bastion mit Fraktionsfarben, Radar, Beacon und CaptureSweep; übrige Gebäudeexporte des bestehenden Arbeitsstands |
| `tools/building-sources/` | Originale Nutzermodelle und [Herkunfts-/Prüfsummenprotokoll](../../tools/building-sources/ORIGIN.md); Quelldateien erhalten |
| `scripts/animation/`, `scripts/export-*.mjs` | Reproduzierbare Geometrie, Animation und registrierter Atlasexport; kein neuer Komplett-Export im Qualitätsdurchgang |
| `src/assets/reborn/voices/` | Nach Hörfreigabe alle 47 WAVs durch deutsche VoiceDesign-/Base-Aufnahmen ersetzt; Mapping erhalten, Manifest und Herkunft aktualisiert, alte Bank gesichert |
| `docs/audio-review/2026-10-24/` | Neu: drei synthetische Referenzen, 21 trockene/gefilterte Vergleichsproben, 47 trockene/gefilterte freigegebene Aufnahmen (gefilterte Dateien identisch mit der aktiven Bank), sieben alte Vergleichstakes samt ursprünglichem Herkunfts-/Manifestnachweis, HTML-Abspielseite, Manifeste, ASR und Dateiaudits; circa 11 MiB, nur Review-/Autorenmaterial |
| `scripts/generate-german-radio-candidates.py`, `scripts/audit-radio-bank.py` | Neu: lokale Kandidatengenerierung ohne Überschreiben der aktiven Bank sowie unabhängiger WAV-/Mapping-Audit |
| `docs/reborn/`, `docs/buildings-3d/`, `docs/detailed-models/` | Browserprüfungen erneuern vorhandene Belegbilder und benannte Demonstrationsvideos; keine Laufzeitabhängigkeit. Zufällig benannte Rohvideos in versteckten Aufnahmeordnern sind gitignoriert |

Die Entstehung früherer Grafikvorstufen und Drittmodelle bleibt in [ART_ASSETS](../reborn/ART_ASSETS.md) und im [Animationsquellenmanifest](../../tools/animation-sources/manifest.json) dokumentiert. Dortige historische Aussagen zum damaligen aktiven Stand gelten nicht automatisch für dieses Release.

Gewichte des zusätzlich geladenen VoiceDesign-Modells liegen ausschließlich im lokalen temporären Modellcache. WAV-Backup, Release-Archive, Buildausgabe, Abhängigkeiten, Logs und Python-Caches sind gitignoriert. Kein Modellcheckpoint und keine neue Abhängigkeit werden mit dem Spiel veröffentlicht. Der normale Build kopiert die 47 aktiven WAVs aus `src/assets/reborn/voices/`; separate Reviewkopien, trockene Proben und synthetische Referenzen unter `docs/audio-review/` werden nicht mitkopiert.

Der Dateiaudit fand keine nichtignorierten temporären Archive, Schlüsseldateien oder Dateien über 100 MiB. Die größten einzelnen Modelle sind knapp 8 MB. Mehrere GLBs enthalten eingebettete Keramiktexturen; sie wurden aus Rücksicht auf die vorhandenen Modelle nicht nachträglich umgepackt oder dedupliziert. Die Quellen verbleiben als bearbeitbare Projektassets im Repository.
