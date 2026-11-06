# Freigegebene deutsche Funkstimmen

Alle 47 aktiven Funkaufnahmen wurden für ATLAS DOMINION REBORN mit lokalem Qwen3-TTS VoiceDesign und Base synthetisiert. Die sieben Vergleichssätze pro Stimme wurden dem Projekteigentümer ungefiltert und mit Funkfilter bereitgestellt. Am 24.10.2026 bestätigte er: **„A, B und C überzeugen“**. Daraufhin wurden alle 47 vorbereiteten Clips übernommen. Die vollständigen Herkunfts-, Lizenz-, Generierungs- und ASR-Nachweise liegen unter `docs/audio-review/2026-10-24/`.

- VoiceDesign: `mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit`, Revision `ffc6545dc9cb086950aa46c6cd3db490e6ece3e1`.
- Base: `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit`, Revision `34ff5318365b59cba9c03ff729f2eee0814caf72`.
- Offline-Engine: MLX Audio 0.5.1 auf Apple Silicon. Keine TTS-Anfrage im Spiel.
- A / `soldier`: **Atlas DE A – Infanterie**, fiktiver männlicher Sprecher, bestimmt und leicht rau; auch Pilotenmeldungen.
- B / `crew`: **Atlas DE B – Besatzung**, fiktiver männlicher Bariton, tiefer und ruhig autoritär; schwere Infanterie und Fahrzeugbesatzungen.
- C / `support`: **Atlas DE C – Unterstützung**, fiktive ruhige professionelle Frauenstimme; Sanitäter und Bauarbeiter.
- Sämtliche Referenzaufnahmen stammen aus eigener VoiceDesign-Synthese aus Beschreibungen. Keine Aufnahme einer realen Person, kein fremder Spielclip, kein Ryan-/Aiden-/Serena-Preset und keine macOS-Systemstimme wurde für diese aktive Bank verwendet.
- Dateinamen, Texte, Ereignisgruppen und Rollen entsprechen weiterhin `scripts/voices/lines.json`. Das Manifest enthält Modellrevisionen, Profile, Hörfreigabe, Dauer und SHA-256 jeder Aufnahme.
- Format: WAV, mono, 24 kHz, signed PCM16; 0,605–2,135 Sekunden.
- Verarbeitung: äußere Stille mit Reserve kürzen, 170–4600 Hz Bandpass, sanfte 2:1-Kompression, geringe Sättigung, Pegelangleichung, Fades und zwei sehr leise isolierte Funkklicks. Keine Tonhöhenänderung oder Hallüberdeckung. Das vorhandene zusätzliche Pilotenband im Browser bleibt erhalten.

Qwen-Code und verwendete Gewichte sind mit Apache-2.0 ausgewiesen; MLX Audio verwendet MIT. Diese Lizenzen betreffen die Modelle und Software und sind keine pauschale Garantie für sämtliche Rechte an generierten Inhalten. Links und Einordnung: `THIRD_PARTY_NOTICES.md` sowie die Audio-Review-Dokumentation im Projekt. Modellgewichte und Autorenwerkzeuge werden nicht mit dem Browser-Spiel ausgeliefert.

Reproduzieren mit `scripts/generate-german-radio-candidates.py`: zuerst `--phase samples`, dann `--phase bank`, jeweils mit vollständigen lokalen `--design-model`- und `--base-model`-Snapshots. Ein neues `--out`-Verzeichnis verwenden, um vorhandene Dateien zu erhalten. Der Generator schreibt absichtlich nicht in die aktive Spielbank; neue Generierungen erfordern ein eigenes Hörurteil. Beschreibungen, Seeds, Referenztext und Softwareversionen sind unter `docs/audio-review/2026-10-24/` festgehalten.

Die vorige Ryan-/Aiden-/Serena-Bank ist vollständig im lokalen, gitignorierten Archiv `backups/audio/voices-before-german-design-20261024.tar.gz` gesichert. SHA-256: `d5b16c25a4128cd95f16ed1344b04a70291b0fae96e803c4f1d0dfbfdb5d7919`. Vor der Übernahme wurden alle 49 alten Dateien bytegleich gegen dieses Archiv geprüft. Alte Herkunft und das ursprüngliche Bankmanifest liegen zusätzlich unter `docs/audio-review/2026-10-24/previous/`; die dortigen sieben Vergleichstakes bleiben als Vorher-Nachher-Hörprobe erhalten.
