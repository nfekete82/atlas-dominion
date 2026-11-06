# Deutsche Funkstimmen — A/B/C freigegeben und aktiv

Am 24.10.2026 wurden drei fiktive Stimmidentitäten mit lokalem Qwen3-TTS VoiceDesign entworfen. Das vorhandene Base-Modell erzeugte daraus konsistente Einzelmeldungen. Die eingebauten englischen bzw. chinesischen Sprecher Ryan, Aiden und Serena wurden dafür nicht verwendet. Ein deutscher Sprachcode allein beseitigt ihren Akzent nicht; die [offizielle Sprecherübersicht](https://github.com/QwenLM/Qwen3-TTS#custom-voice-generation) nennt ihre ursprünglichen Sprachen.

**Status:** Der Eigentümer hat die drei Stimmtypen anhand der Vergleichsproben mit „A, B und C überzeugen“ freigegeben. Alle 47 neuen Clips wurden daraufhin unter `src/assets/reborn/voices/` aktiviert; die Zuordnung blieb erhalten. Die 21 Vergleichsaufnahmen und die vollständige Bank bleiben zusätzlich hier verfügbar. Keine Person wurde als Stimmvorlage aufgenommen oder geklont; die Referenzaufnahmen wurden aus Textbeschreibungen synthetisiert.

[Vergleichsseite öffnen](index.html): sieben Sätze je Stimme, jeweils trocken und mit dezentem Funkfilter, die alte Fassung sowie alle 47 neuen Einzelmeldungen. Direktes Öffnen als lokale HTML-Datei funktioniert ohne Server oder Internet. Zuerst ungefiltert auf Akzent, Satzmelodie, Wortenden und Stimmkonsistenz achten.

| Profil | Kandidat | Beschreibung |
| --- | --- | --- |
| `soldier` | Atlas DE A – Infanterie | Männlich, mittlere Lage, leicht rau, bestimmt; auch Pilotenmeldungen |
| `crew` | Atlas DE B – Besatzung | Männlicher Bariton, tiefer, ruhig autoritär; schwere Infanterie und Fahrzeuge |
| `support` | Atlas DE C – Unterstützung | Ruhige professionelle Frauenstimme; Sanitäter und Bauarbeiter |

Die Beschreibungen sind Gestaltungsziele; das akzeptierende Hörurteil zu allen drei Stimmtypen stammt vom Eigentümer. Eine individuelle menschliche Abnahme jedes der 47 Clips wird daraus nicht behauptet. Alle 47 Texte sind zusätzlich mit ASR geprüft. „Aye, aye, Sir!“ und „Roger!“ sind bewusst erhaltene Texte der bisherigen Zuordnung, keine neu hinzugefügten Übersetzungsfehler.

## Modelle und lokale Auswahl

Vor der Installation wurden die vorhandenen Qwen-CustomVoice-/Base-Snapshots, Whisper-ASR, MLX Audio, FFmpeg und die deutschen `say`-Stimmen geprüft. Nur VoiceDesign wurde zusätzlich als Modell heruntergeladen; keine neue npm- oder Python-Abhängigkeit und keine Modellgewichte im Repository.

| Kandidat | Ergebnis der Auswahl |
| --- | --- |
| Vorhandenes Qwen CustomVoice | Bisheriger Akzent beanstandet; Ryan/Aiden/Serena nicht als neue deutsche Stimmen übernommen |
| Qwen VoiceDesign + Base | Lokal erzeugte eigene deutsche Referenzidentitäten; 21 Proben und 47 Ersatzclips stabil erstellt; alle drei Stimmtypen vom Eigentümer akzeptiert und aktiviert |
| macOS Anna und weitere deutsche `say`-Stimmen | Vorhanden, aber nicht als veröffentlichbare Spielaufnahmen übernommen: die geprüfte [Apple-Lizenz, §2F](https://www.apple.com/legal/sla/docs/macOSSequoia.pdf), beschränkt die Erstellung und Veröffentlichung mit Systemstimmen |
| Chatterbox Multilingual | Nicht lokal installiert; keine freigegebene reale deutsche Vorlage vorhanden. Keine fremde Referenz verwendet; Qualität deshalb nicht behauptet |
| Piper Deutsch | Kein lokales Modell gefunden; als Fallback betrachtet, aber nicht heruntergeladen oder klanglich bewertet. Lizenz wäre je konkreter Stimme zu prüfen |

Verwendete Modelle:

- `mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit`, Revision `ffc6545dc9cb086950aa46c6cd3db490e6ece3e1`.
- `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit`, Revision `34ff5318365b59cba9c03ff729f2eee0814caf72`.
- MLX Audio 0.5.1; weitere lokale Versionen und Referenzprüfsummen in [environment.json](environment.json).

[VoiceDesign-Modellkarte](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit), [offizielles Ausgangsmodell](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign), [Base-Modellkarte](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit) und [Qwen-Code-Lizenz](https://github.com/QwenLM/Qwen3-TTS/blob/main/LICENSE) weisen Apache-2.0 aus. [MLX Audio](https://github.com/Blaizzy/mlx-audio/blob/main/LICENSE) verwendet MIT. Diese Lizenzen sind für kommerzielle Modell-/Softwarenutzung grundsätzlich geeignet, vorbehaltlich ihrer Bedingungen. Sie sind keine pauschale Rechtegarantie für generierte Inhalte. Es gibt keine fremden Sprecheraufnahmen oder zusätzliche Referenzlizenzen; eine Weiterveröffentlichung erfolgt unter der vom Projekteigentümer festzulegenden Asset-/Projektregelung. Siehe [Rechteübersicht](../../../THIRD_PARTY_NOTICES.md).

## Reproduzieren

Die lokalen Modellpfade müssen vollständige Snapshots der oben genannten Revisionen enthalten. Keine Netzwerkabfrage erfolgt in den Generatoren oder im Spiel.

```sh
python scripts/generate-german-radio-candidates.py \
  --design-model /path/to/VoiceDesign/snapshot \
  --base-model /path/to/Base/snapshot --phase samples
python scripts/generate-german-radio-candidates.py \
  --design-model /path/to/VoiceDesign/snapshot \
  --base-model /path/to/Base/snapshot --phase bank
python3 scripts/audit-radio-bank.py docs/audio-review/2026-10-24/candidate-bank
```

Der Generator überspringt vorhandene WAVs. Für eine vollständige Neugenerierung `--out` auf ein neues separates Verzeichnis setzen und dort zuerst `samples`, dann `bank` ausführen. Die drei synthetischen Originalreferenzen liegen unter `references/`. [comparison.json](comparison.json) enthält Beschreibungen, Referenztext, Seeds, Modellrevisionen und Probenprüfsummen; die [Bankmanifest-Datei](candidate-bank/manifest.json) dokumentiert alle 47 Zuordnungen.

Referenz-Seeds: 240101/240202/240303. VoiceDesign: Temperatur 0,65, Top-p 0,9, maximal 420 Tokens. Base: Temperatur 0,6, Top-p 0,9, maximal 140 Tokens; Proben-Seed = Profilseed + 10 + Satzindex, Bank-Seed = Profilseed + 100 + Bankindex, jeweils nullbasiert. Identische Proben werden für passende Banktexte wiederverwendet. Bei unzulässiger Dauer ist genau eine Wiederholung mit Seed +1000 erlaubt. Gleiche Software, Modelle und Seeds machen das Verfahren nachvollziehbar; Bitidentität über verschiedene MLX-/Hardwareversionen wird nicht zugesichert.

Export: WAV, mono, 24 kHz, PCM16. Nur äußere Stille wird gekürzt, mit 45/85 ms Reserve. Bandpass 170–4600 Hz, sanfte 2:1-Kompression und Softclip, angeglichener RMS-Pegel mit Spitzenbegrenzung, kurze Fades und leise isolierte Funkklicks. Keine Tonhöhenänderung oder Hallüberdeckung.

## Prüfung und Rücksicherung

- [Aktive Bank: 47/47 bestanden](audit-active.json) und [Kandidaten: 47/47 bestanden](audit-candidates.json): Ereignis-/Textzuordnung, WAV-Format, SHA-256, Dauer, RMS, Spitzen und keine geclippten Samples. Technische Prüfung ersetzt keine Hörkontrolle abgeschnittener Laute.
- Lokales Whisper large-v3-turbo erkennt alle Wörter der 21 Proben und aller 47 Kandidaten in kurzen Batches, abgesehen von Großschreibung/Interpunktion: [Proben-ASR](asr-samples.json), [Bank-ASR](asr-bank.json). Das belegt weder einen muttersprachlichen Akzent noch jede individuelle Clipgrenze oder Stimmkonsistenz.
- Die aktive Bank wurde vor jeder möglichen Übernahme vollständig gesichert: `backups/audio/voices-before-german-design-20261024.tar.gz`, SHA-256 `d5b16c25a4128cd95f16ed1344b04a70291b0fae96e803c4f1d0dfbfdb5d7919`. Das Archiv ist lokal und gitignoriert. Vor der Übernahme wurden alle 49 alten Dateien bytegleich gegen das Archiv geprüft. Alte Herkunft und das ursprüngliche Manifest bleiben unter `previous/`; der frühere Dateiaudit steht in [audit-previous.json](audit-previous.json).

Übernahme abgeschlossen: die 47 freigegebenen WAVs und das geprüfte Manifest sind aktiv, Herkunft und Sprechererwartungen aktualisiert. Ereignisse, Gruppenlogik, Lautstärkeregelung und Simulation blieben erhalten. Die gezielten Radio-Datei-/Node-/Browserprüfungen sind im [Prüfbericht](../../qa/release-2026-10-24.md) dokumentiert. Künftige Neugenerierungen erhalten keine automatische Hörfreigabe.
