#!/usr/bin/env python3
"""Create fictional native-German voice candidates, without replacing game audio.

First synthesize original reference identities with VoiceDesign. Only those
synthetic references are passed to the existing Base model for consistent takes.
Existing CustomVoice presets and real-person recordings are never referenced.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
os.environ['TOKENIZERS_PARALLELISM']='false'
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--design-model',type=Path,required=True)
parser.add_argument('--base-model',type=Path,required=True)
parser.add_argument('--out',type=Path,default=ROOT/'docs/audio-review/2026-10-24')
parser.add_argument('--phase',choices=['samples','bank'],default='samples')
args=parser.parse_args()
out=args.out.resolve()
if out.is_relative_to((ROOT/'src/assets/reborn/voices').resolve()):
    raise SystemExit('Candidate output must be separate from active game assets.')
for model in [args.design_model,args.base_model]:
    if not (model/'model.safetensors').is_file():raise SystemExit('Complete local model snapshots are required.')

import numpy as np
import soundfile as sf
import mlx.core as mx
from mlx_audio.tts.utils import load_model

PHRASES=['Verstanden!','Bin unterwegs!','Jawohl, Kommandant!','Angriff bestätigt!','Sanitäter unterwegs!','Reparatur wird durchgeführt!','Truppen werden abgesetzt!']
REFERENCE=' '.join(PHRASES)
COMMON='Ein muttersprachlicher Sprecher aus Deutschland mit akzentfreiem, natürlichem Hochdeutsch. Deutsche Vokale, klare deutsche Konsonanten und deutsche Satzmelodie. Kein englischer oder anderer fremdsprachiger Akzent. Knapp, bestimmt und glaubwürdig wie eine professionelle militärische Funkbestätigung. Kein Schreien, kein übertriebenes Schauspiel, keine künstliche Ansagerstimme.'
PROFILES={
 'soldier':{'name':'Atlas DE A – Infanterie','seed':240101,'description':COMMON+' Ein erwachsener Mann Mitte dreißig, mittlere Stimmlage, leicht rauer Charakter, präzise und energisch.'},
 'crew':{'name':'Atlas DE B – Besatzung','seed':240202,'description':COMMON+' Ein erwachsener Mann Mitte vierzig, natürlich tiefe kräftige Baritonstimme, ruhig autoritär. Keine übertrieben tiefe Monsterstimme.'},
 'support':{'name':'Atlas DE C – Unterstützung','seed':240303,'description':COMMON+' Eine erwachsene Frau Mitte dreißig, ruhige freundliche und professionelle Stimme. Sehr gut verständlich, gelassen und zugewandt.'},
}
for folder in ['references','samples','dry','candidate-bank']:(out/folder).mkdir(parents=True,exist_ok=True)

def checksum(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def trim(audio,rate):
    audio=np.asarray(audio).reshape(-1).astype('float32')
    frame=max(1,int(rate*.01));rms=np.array([np.sqrt(np.mean(audio[i:i+frame]**2)) for i in range(0,len(audio),frame)])
    active=np.flatnonzero(rms>max(.002,float(np.max(rms))*.04))
    if not len(active):raise ValueError('Silent synthesized voice')
    return audio[max(0,int(active[0]*frame-.045*rate)):min(len(audio),int((active[-1]+1)*frame+.085*rate))]
def level(audio):
    rms=float(np.sqrt(np.mean(audio**2)));peak=float(np.max(np.abs(audio)))
    return audio*min(.14/max(rms,1e-6),.82/max(peak,1e-6))
def save_clip(audio,rate,dry,radio):
    audio=level(trim(audio,rate));sf.write(dry,audio,rate,subtype='PCM_16')
    with tempfile.TemporaryDirectory(prefix='atlas-german-radio-') as temp:
        filtered=Path(temp)/'filtered.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(dry),'-af','highpass=f=170,lowpass=f=4600,acompressor=threshold=0.16:ratio=2:attack=3:release=70:makeup=1.3,asoftclip=type=tanh:threshold=0.85','-ac','1','-ar','24000',str(filtered)],check=True)
        audio,rate=sf.read(filtered,dtype='float32')
    audio=level(audio);fade=min(144,len(audio)//4);audio[:fade]*=np.linspace(0,1,fade);audio[-fade:]*=np.linspace(1,0,fade)
    audio=np.concatenate([np.zeros(480),audio,np.zeros(480)])
    click=np.random.default_rng(72).uniform(-1,1,240)*np.exp(-np.arange(240)/40)*.014
    audio[:240]+=click;audio[-240:]+=click[::-1]*.6;sf.write(radio,audio,24000,subtype='PCM_16')

if args.phase=='samples':
    design=load_model(args.design_model)
    for key,profile in PROFILES.items():
        path=out/'references'/f'{key}.wav'
        if not path.exists():
            mx.random.seed(profile['seed'])
            chunks=[np.asarray(r.audio) for r in design.generate(text=REFERENCE,instruct=profile['description'],lang_code='German',temperature=.65,top_p=.9,max_tokens=420,verbose=False)]
            sf.write(path,trim(np.concatenate(chunks),design.sample_rate),design.sample_rate,subtype='PCM_16')
        print('Original synthetic reference:',key,sf.info(path).duration,flush=True)
    del design;mx.clear_cache()

base=load_model(args.base_model)
def synthesize(text,profile,seed,dry,radio):
    if radio.exists():return
    for take in range(2):
        mx.random.seed(seed+take*1000)
        chunks=[np.asarray(r.audio) for r in base.generate(text=text,ref_audio=str(out/'references'/f'{profile}.wav'),ref_text=REFERENCE,lang_code='German',temperature=.6,top_p=.9,max_tokens=140,verbose=False)]
        save_clip(np.concatenate(chunks),base.sample_rate,dry,radio)
        if .3<=sf.info(radio).duration<=4.5:return
    raise RuntimeError(f'Take needs review: {radio.name}, {sf.info(radio).duration}s')

if args.phase=='samples':
    samples=[]
    for pi,(profile,settings) in enumerate(PROFILES.items()):
        for i,text in enumerate(PHRASES):
            name=f'{profile}-{i+1:02d}.wav';dry=out/'dry'/name;radio=out/'samples'/name
            synthesize(text,profile,settings['seed']+i+10,dry,radio)
            samples.append({'profile':profile,'name':settings['name'],'text':text,'dry':'dry/'+name,'file':'samples/'+name,'duration':sf.info(radio).duration,'sha256':checksum(radio)})
            print('Sample:',profile,text,sf.info(radio).duration,flush=True)
    manifest={'version':1,'status':'human-listening-review-required','designModel':{'repo':'mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit','revision':args.design_model.name},'baseModel':{'repo':'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit','revision':args.base_model.name},'referenceText':REFERENCE,'profiles':PROFILES,'samples':samples}
    (out/'comparison.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
else:
    samples=json.loads((out/'comparison.json').read_text())['samples'];rows=[]
    definition=json.loads((ROOT/'scripts/voices/lines.json').read_text())
    for i,line in enumerate(definition['clips']):
        profile=line['profile'];dry=out/'dry'/(line['id']+'.wav');path=out/'candidate-bank'/(line['id']+'.wav')
        matching=next((s for s in samples if s['profile']==profile and s['text']==line['text']),None)
        if matching and not path.exists():
            import shutil
            shutil.copy2(out/matching['file'],path);shutil.copy2(out/matching['dry'],dry)
        else:synthesize(line['text'],profile,PROFILES[profile]['seed']+100+i,dry,path)
        rows.append({**line,'file':path.name,'duration':round(sf.info(path).duration,4),'speaker':PROFILES[profile]['name'],'sha256':checksum(path)})
        print('Candidate:',i+1,'/',len(definition['clips']),path.name,flush=True)
    original=json.loads((ROOT/'src/assets/reborn/voices/manifest.json').read_text())
    # A fresh generation must never inherit the active bank's listening approval.
    original.pop('listeningReview',None)
    original.update({'engine':'Qwen3-TTS VoiceDesign + Base / MLX Audio','modelSnapshot':args.base_model.name,'designModel':{'repo':'mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit','revision':args.design_model.name},'baseModel':{'repo':'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit','revision':args.base_model.name},'profiles':PROFILES,'clips':rows,'reviewStatus':'not-activated-human-listening-review-required'})
    (out/'candidate-bank/manifest.json').write_text(json.dumps(original,ensure_ascii=False,indent=2)+'\n')
print('Candidate generation complete; active game audio is unchanged.',flush=True)
