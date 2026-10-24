# Drittanbieter, Modelle und Asset-Herkunft

Stand: 24.10.2026. Diese Übersicht dokumentiert vorhandene Rechteangaben; sie vergibt keine neue Lizenz für das Spiel oder vom Nutzer bereitgestellte Assets. Im Projektstamm gibt es derzeit keine allgemeine `LICENSE`. Die gewünschte Lizenz für eigene Quellen und Spielassets legt der Eigentümer vor einer entsprechenden öffentlichen Lizenzzusage fest.

| Bestandteil | Herkunft / Lizenz | Veröffentlichung |
| --- | --- | --- |
| Three.js 0.180.0 | MIT, [Projektlizenz](https://github.com/mrdoob/three.js/blob/r180/LICENSE) | Lokale Module für Modellgalerie; der Build kopiert die Lizenz nach `dist/vendor/three/LICENSE` |
| TypeScript | Apache-2.0, [Projektlizenz](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) | Entwicklungswerkzeug; kein Compiler im Spielpaket |
| Archivierte Animationsquellen | Quellenmanifest und Einzeldateilizenzen unter [tools/animation-sources](tools/animation-sources/README.md) / [manifest.json](tools/animation-sources/manifest.json), CC0-1.0 gemäß dortigen Angaben | Herkunft und Nachweise erhalten; diese Angabe nicht pauschal auf alle Spielgrafiken übertragen |
| Prozedurale Legionär-, Rollen-, Fahrzeug- und Gebäudemodelle | Projektgeometrie aus den Exportskripten; Herkunft in GLB/JSON und Asset-Dokumenten | Keine neue Fremdmodell- oder Sprecheraufnahme in diesem Qualitätsdurchgang übernommen |
| Vom Nutzer überarbeitetes HQ / Bastion | Unveränderte Quellen unter [tools/building-sources](tools/building-sources/ORIGIN.md), inklusive SHA-256 | Bereitstellung und Bearbeitung dokumentiert; keine separate öffentliche Assetlizenz daraus abgeleitet |
| Generierte Terrain-/Menü-/Grafikvorstufen | [Imagegen-Herkunft, Referenzen und Prompts](docs/reborn/ART_ASSETS.md) | Vor öffentlicher/kommerzieller Verteilung Rechte an verwendeten Nutzervorlagen und gewünschte Assetlizenz bestätigen; kein pauschales CC0 behauptet |
| Bisherige 47 Funkaufnahmen | Qwen3-TTS CustomVoice, Ryan/Aiden/Serena; [archivierte Herkunft und Revision](docs/audio-review/2026-10-24/previous/ORIGIN.md) | Durch freigegebene deutsche Bank ersetzt; vollständige lokale Sicherung und sieben alte Vergleichstakes vorhanden |
| Aktive deutsche Funkstimmen | Qwen3-TTS VoiceDesign + Base, eigene synthetische Referenzen; [Dokumentation](docs/audio-review/2026-10-24/README.md) | A/B/C vom Eigentümer anhand der Vergleichsproben freigegeben; alle 47 Clips aktiv |

## Audiomodell und Ausgaben

Der [Qwen3-TTS-Code](https://github.com/QwenLM/Qwen3-TTS/blob/main/LICENSE) und die verwendeten [VoiceDesign-](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) / [Base-Gewichte](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base) werden unter Apache-2.0 angeboten. Die genutzten MLX-Konvertierungen weisen dieselbe Lizenz aus: [VoiceDesign 6bit](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit), [Base 6bit](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit), [bisheriges CustomVoice 6bit](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit). [MLX Audio](https://github.com/Blaizzy/mlx-audio/blob/main/LICENSE) ist MIT-lizenziert. Die Modellkarten sind Lizenznachweise der Modelle; daraus folgt keine gesonderte Garantie für alle Rechte an erzeugten Inhalten.

Alle neuen Referenzen sind fiktive, im Auftrag synthetisierte Stimmen. Es wurden keine realen Personen, fremden Spielclips oder Drittaufnahmen als Vorlage verwendet. Daher fällt keine zusätzliche Sprecheraufnahme-Lizenz an. Ob und wie die fertigen WAVs öffentlich lizenziert werden, bestimmt der Eigentümer. Modelle, Python-Laufzeit und ASR werden nicht mit dem Browser-Spiel ausgeliefert. FFmpeg war ein vorhandenes Offline-Werkzeug und wird ebenfalls nicht mitgeliefert; eine spätere Bündelung dieser Werkzeuge oder Gewichte würde deren jeweilige Weitergabepflichten auslösen.

Apple-Systemstimmen wurden ausgeschlossen: die geprüfte [macOS-Sequoia-Lizenz §2F](https://www.apple.com/legal/sla/docs/macOSSequoia.pdf) erlaubt keine entsprechende öffentliche oder kommerzielle Weitergabe. Es werden keine Apple-Sprachaufnahmen in das Spiel oder diese Hörprobe aufgenommen.

Diese Angaben erlauben keine uneingeschränkte Zusage „alle Inhalte kommerziell freigegeben“. Modell-/Code-Lizenzen sind dokumentiert; die Hörfreigabe für die drei deutschen Stimmtypen liegt vor. Die Eigentümerentscheidung zu Projekt-/Referenzrechten wird daraus nicht abgeleitet.
