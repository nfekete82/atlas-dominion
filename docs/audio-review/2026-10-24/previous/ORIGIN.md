# Locally generated unit radio speech

These 47 German speech recordings were synthesized specifically for ATLAS DOMINION REBORN from the phrases in `scripts/voices/lines.json`. No speech recordings, sound effects, reference speakers or cloned voices from another game were used.

- Engine: the already installed MLX Audio implementation of Qwen3-TTS.
- Existing local model: `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit`.
- Model snapshot: `1c6c0ff58c43afa8df571facde2efa077efd85e2`.
- Built-in speaker presets: Ryan (soldier/pilot), Aiden (heavy infantry/vehicle crew), Serena (medic/engineer).
- Language: German. Voice identity is generated from the model presets; no reference audio was supplied.
- Export: mono WAV, signed 16-bit PCM, 24 kHz. The manifest records text, preset, duration and SHA-256 for every shipped clip.
- Processing: trim only outer silence, 170 Hz high-pass, 4.6 kHz low-pass, gentle 2:1 compression, soft saturation, matched speech level, small fades and two quiet isolated radio switch clicks. No continuous noise bed, echo or pitch shifting.
- Pilots receive an additional mild 260 Hz–3.7 kHz radio band in the browser.

`scripts/generate-unit-voices.py` uses only an existing local model snapshot and explicitly enables Hugging Face/Transformers offline mode. It requires the existing Python environment providing `mlx_audio`, `numpy`, `soundfile`, and the existing `ffmpeg` binary. These are authoring tools, not browser or npm runtime dependencies. Regeneration is optional; all playback assets are committed alongside the game source when the project is committed by its owner.

```sh
python scripts/generate-unit-voices.py --model /path/to/existing/CustomVoice/snapshot
```

The first 38 clips used the default per-line seed. A continuation run used `--only soldier-unload-01 --seed-offset 13` to replace the long unload take and generate the remaining eight clips; these final nine clips therefore use a seed offset of 13. No generation or external TTS request happens while playing. Speech assets and their processing were also checked with the already installed local Whisper model; automatic transcription is a useful intelligibility check, not a substitute for a listening review.
