#!/usr/bin/env python3
"""Author offline German RTS speech with an existing local MLX CustomVoice model.

Run with the Python environment that already provides mlx_audio, numpy and soundfile.
Never downloads weights, calls an online API, or clones a reference speaker.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--model', type=Path, required=True, help='Existing local CustomVoice snapshot')
parser.add_argument('--only', nargs='*', help='Regenerate selected clip IDs')
parser.add_argument('--seed-offset', type=int, default=0, help='Alternate local take for selected clips')
args = parser.parse_args()
if not (args.model / 'model.safetensors').is_file():
    raise SystemExit('A complete local model snapshot is required; no automatic download.')

import numpy as np
import soundfile as sf
import mlx.core as mx
from mlx_audio.tts.utils import load_model

definition = json.loads((ROOT / 'scripts/voices/lines.json').read_text())
out = ROOT / 'src/assets/reborn/voices'
out.mkdir(parents=True, exist_ok=True)
model = load_model(args.model)
records = []
for index, line in enumerate(definition['clips']):
    path = out / (line['id'] + '.wav')
    if not path.exists() or (args.only and line['id'] in args.only):
        profile = definition['profiles'][line['profile']]
        instruction = profile['instruction']
        if line['group'] == 'attack':
            instruction += ' A little more energetic and urgent, still controlled and intelligible.'
        mx.random.seed(20261024 + index + args.seed_offset)
        chunks = [np.asarray(r.audio) for r in model.generate(
            text=line['text'], voice=profile['speaker'], lang_code='German',
            instruct=instruction, temperature=.6, top_p=.9, max_tokens=150,
            repetition_penalty=1.1, verbose=False)]
        audio = np.concatenate(chunks).reshape(-1)
        # Trim silence with a safety margin: preserve quiet consonants and all internal pauses.
        threshold = max(.001, float(np.max(np.abs(audio))) * .008)
        active = np.flatnonzero(np.abs(audio) > threshold)
        if not len(active):
            raise RuntimeError(f'Empty speech: {line["id"]}')
        rate = model.sample_rate
        audio = audio[max(0, active[0]-int(.035*rate)):min(len(audio), active[-1]+int(.07*rate))]
        with tempfile.TemporaryDirectory(prefix='atlas-radio-') as folder:
            raw, filtered = Path(folder)/'raw.wav', Path(folder)/'filtered.wav'
            sf.write(raw, audio, rate, subtype='PCM_16')
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af',
                'highpass=f=170,lowpass=f=4600,acompressor=threshold=0.16:ratio=2:attack=3:release=70:makeup=1.3,asoftclip=type=tanh:threshold=0.85',
                '-ar','24000','-ac','1',str(filtered)], check=True)
            audio, rate = sf.read(filtered, dtype='float32')
        rms = float(np.sqrt(np.mean(audio**2)))
        audio *= min(.14/max(rms, 1e-6), .82/max(float(np.max(np.abs(audio))), 1e-6))
        fade = min(144, len(audio)//4)
        audio[:fade] *= np.linspace(0,1,fade)
        audio[-fade:] *= np.linspace(1,0,fade)
        # Tiny isolated radio switch clicks; no background hiss or delay/echo.
        pad = np.zeros(480, dtype='float32')
        audio = np.concatenate([pad, audio, pad])
        rng = np.random.default_rng(72)
        click = rng.uniform(-1,1,240) * np.exp(-np.arange(240)/40) * .014
        audio[:240] += click
        audio[-240:] += click[::-1] * .6
        sf.write(path, audio, rate, subtype='PCM_16')
        mx.clear_cache()
    info = sf.info(path)
    if not .3 <= info.duration <= 4.5:
        raise RuntimeError(f'Unexpected duration for {path.name}: {info.duration}')
    records.append({**line, 'file':path.name,'duration':round(info.duration,4),
        'speaker':definition['profiles'][line['profile']]['speaker'],
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    print(f'{index+1}/{len(definition["clips"])} {path.name}: {info.duration:.2f}s', flush=True)

manifest = {'version':1,'language':'de-DE','format':'PCM signed 16-bit, mono, 24000 Hz',
    'engine':'Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit / MLX Audio',
    'modelSnapshot':args.model.name,'profiles':definition['profiles'],'clips':records}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Local voice bank complete.', flush=True)
