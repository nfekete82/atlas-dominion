#!/usr/bin/env python3
"""Audit a radio bank against the event definitions; only Python stdlib required."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bank', type=Path)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
bank = args.bank.resolve()
manifest = json.loads((bank / 'manifest.json').read_text())
definition = json.loads((ROOT / 'scripts/voices/lines.json').read_text())
expected = {c['id']: c for c in definition['clips']}
errors, rows = [], []
clips = manifest['clips']
if len(clips) != 47 or len({c['id'] for c in clips}) != 47:
    errors.append('Expected exactly 47 unique manifest clips')
if {c['id'] for c in clips} != set(expected):
    errors.append('Manifest event IDs differ from the game definition')
if {p.name for p in bank.glob('*.wav')} != {c['file'] for c in clips}:
    errors.append('WAV files and manifest do not match')
for clip in clips:
    if any(clip.get(k) != expected.get(clip['id'], {}).get(k) for k in ['text', 'profile', 'group']):
        errors.append(f"Event mapping changed: {clip['id']}")
    path = bank / clip['file']
    if path.parent != bank:
        raise ValueError('Manifest must contain plain filenames')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with wave.open(str(path), 'rb') as wav:
        rate, channels, width = wav.getframerate(), wav.getnchannels(), wav.getsampwidth()
        if (rate, channels, width, wav.getcomptype()) != (24000, 1, 2, 'NONE'):
            errors.append(f'Incompatible PCM format: {path.name}')
        pcm = array.array('h', wav.readframes(wav.getnframes()))
        if sys.byteorder != 'little':
            pcm.byteswap()
    duration = len(pcm) / rate
    peak = max(map(abs, pcm), default=0) / 32768
    rms = math.sqrt(sum(v * v for v in pcm) / max(1, len(pcm))) / 32768
    clipped = sum(abs(v) >= 32767 for v in pcm)
    if digest != clip['sha256']:
        errors.append(f'Checksum mismatch: {path.name}')
    if abs(duration - clip['duration']) > .002:
        errors.append(f'Duration mismatch: {path.name}')
    if not .3 <= duration <= 4.5 or not .03 <= rms <= .20 or peak >= .98 or clipped:
        errors.append(f'Invalid length, level or clipping: {path.name}')
    frames = [math.sqrt(sum(v*v for v in pcm[i:i+240]) / len(pcm[i:i+240])) / 32768
              for i in range(0, len(pcm), 240)]
    active = [i for i, value in enumerate(frames) if value > .01]
    rows.append({'id': clip['id'], 'sha256': digest, 'duration': round(duration, 4),
                 'rms': round(rms, 6), 'peak': round(peak, 6), 'clippedSamples': clipped,
                 'leadingBelowThresholdSeconds': round(active[0]*.01, 3) if active else duration,
                 'trailingBelowThresholdSeconds': round(max(0, duration-(active[-1]+1)*.01), 3) if active else duration})
report = {'bank': bank.relative_to(ROOT).as_posix() if bank.is_relative_to(ROOT) else bank.name,
          'format': '24000 Hz, mono, signed PCM 16-bit', 'count': len(rows),
          'passed': not errors, 'errors': errors, 'clips': rows}
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'clips'}, ensure_ascii=False))
sys.exit(1 if errors else 0)
