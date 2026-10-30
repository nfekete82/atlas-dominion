import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {RadioPolicy,radioChoices,radioProfile,militaryVoicePreset,radioSaturationCurve,UnitRadio} from '../dist/src/reborn/unit-radio.js';
const root='src/assets/reborn/voices/',manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));

test('radio assets: all 47 authored German lines are real, short, non-silent mono PCM files with matching integrity',()=>{
 assert.equal(manifest.clips.length,47);assert.deepEqual(new Set(manifest.clips.map(c=>c.speaker)),new Set(['Atlas DE A – Infanterie','Atlas DE B – Besatzung','Atlas DE C – Unterstützung']));
 assert.equal(manifest.reviewStatus,'approved');assert.deepEqual(manifest.listeningReview.profiles,['soldier','crew','support']);
 for(const clip of manifest.clips)assert.equal(clip.speaker,manifest.profiles[clip.profile].name);
 for(const clip of manifest.clips){
  const wav=fs.readFileSync(root+clip.file);assert.equal(crypto.createHash('sha256').update(wav).digest('hex'),clip.sha256);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
  let data,rate,bits,channels,format;for(let i=12;i+8<=wav.length;){const size=wav.readUInt32LE(i+4),tag=wav.toString('ascii',i,i+4);if(tag==='fmt '){format=wav.readUInt16LE(i+8);channels=wav.readUInt16LE(i+10);rate=wav.readUInt32LE(i+12);bits=wav.readUInt16LE(i+22);}if(tag==='data')data=wav.subarray(i+8,i+8+size);i+=8+size+(size%2);}
  assert.equal(format,1);assert.equal(channels,1);assert.equal(rate,24000);assert.equal(bits,16);assert.ok(data?.length>12000,clip.id);const duration=data.length/2/rate;assert.ok(duration>=.3&&duration<=4.5,clip.id);assert.ok(Math.abs(duration-clip.duration)<.001);
  let energy=0,peak=0;for(let i=0;i<data.length;i+=2){const n=data.readInt16LE(i)/32768;energy+=n*n;peak=Math.max(peak,Math.abs(n));}assert.ok(Math.sqrt(energy/(data.length/2))>.03,clip.id);assert.ok(peak<.91,clip.id);
 }
});
test('radio catalog: requested movement and attack variants are present; every roster role has an appropriate response',()=>{
 const clips=manifest.clips;
 assert.equal(radioChoices(clips,'move','infantry').length,7);assert.equal(radioChoices(clips,'attack','infantry').length,6);
 for(const kind of ['infantry','heavy','medic','engineer','rover','tank','artillery','scout','bomber'])for(const action of ['move','attack','stop','hold'])assert.ok(radioChoices(clips,action,kind).length>=2,`${kind}/${action}`);
 assert.ok(radioChoices(clips,'heal','medic').every(c=>c.group==='medic'));assert.ok(radioChoices(clips,'repair','engineer').some(c=>c.text==='Reparatur wird durchgeführt!'));assert.ok(radioChoices(clips,'build','engineer').some(c=>c.text==='Baustelle wird angefahren!'));
 assert.ok(radioChoices(clips,'move','engineer').every(c=>!['repair','build'].includes(c.group)));assert.ok(radioChoices(clips,'move','tank').every(c=>c.profile==='crew'));assert.ok(radioChoices(clips,'move','heavy').every(c=>!c.text.includes('Besatzung')));
 assert.ok(radioChoices(clips,'move','bomber').every(c=>c.group==='air'));assert.equal(radioChoices(clips,'load','scout').length,2);assert.ok(radioChoices(clips,'unload','scout').some(c=>c.text==='Truppen werden abgesetzt!'));
 assert.notEqual(radioProfile('heavy'),radioProfile('infantry'));assert.notEqual(radioProfile('medic'),radioProfile('infantry'));
});
test('radio policy: one busy global channel suppresses rapid groups; only a higher priority can replace a message',()=>{
 const p=new RadioPolicy(manifest.clips,()=>0);assert.ok(p.choose('move','infantry',0,false));for(let i=1;i<20;i++)assert.equal(p.choose('move','infantry',i*.01,true),null);
 assert.equal(p.choose('attack','infantry',.1,true),null);assert.equal(p.choose('attack','infantry',.2,true).group,'attack');assert.equal(p.choose('attack','infantry',.5,true),null);assert.equal(p.choose('move','infantry',1.4,true),null);assert.ok(p.choose('stop','infantry',1.5,true));
 assert.equal(p.choose('move','infantry',1.8,false),null);assert.ok(p.choose('move','infantry',2.5,false));
});
test('radio policy: random variation never immediately repeats a clip or text, including shared crew/infantry wording',()=>{
 let seed=19;const p=new RadioPolicy(manifest.clips,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;});let last=null;const seen=new Set();
 for(let i=0;i<80;i++){const clip=p.choose('move',i%3===0?'tank':'infantry',i*3,false);assert.ok(clip);assert.notEqual(clip.id,last?.id);assert.notEqual(clip.text,last?.text);seen.add(clip.id);last=clip;}
 assert.ok(seen.size>=10);p.reset();assert.ok(p.choose('move','infantry',0,false));
});

test('military radio: all roles use intelligible bandpass, restrained speed change and bounded presence',()=>{
 const plans=new Set();
 for(const kind of ['infantry','heavy','medic','engineer','rover','tank','artillery','scout','bomber']){
  const p=militaryVoicePreset(kind);
  assert.ok(p.rate>=.95&&p.rate<=1,'no slow or cartoonish voices');
  assert.ok(p.highpass>=180&&p.highpass<=320&&p.lowpass>=3000&&p.lowpass<=3600);
  assert.ok(p.presenceDb>=4&&p.presenceDb<=6);
  assert.ok(p.drive>1&&p.drive<2);
  plans.add([p.rate,p.highpass,p.lowpass,p.presenceHz].join(':'));
 }
 assert.ok(plans.size>=4,'crew, infantry, aircrew and support have individual radio profiles');
});
test('military radio: saturation transfer is finite, monotonic, symmetrical and never clips',()=>{
 for(const drive of [1.55,1.6,1.75,1.85]){
  const curve=radioSaturationCurve(drive);
  assert.equal(curve.length,1024);
  assert.ok(Math.abs(curve[0]+1)<1e-5&&Math.abs(curve.at(-1)-1)<1e-5);
  assert.ok(curve.every((v,i)=>Number.isFinite(v)&&Math.abs(v)<=1.00001&&(i===0||v>=curve[i-1])));
 }
});
test('military radio: safe default, exact legacy fallback and disabling a clip on style change',()=>{
 const radio=new UnitRadio(()=>true);
 assert.equal(radio.style,'military');
 radio.setStyle('original');assert.equal(radio.style,'original');
 radio.setStyle('military');assert.equal(radio.style,'military');
 assert.equal(radio.stats.started,0,'switching does not synthesize voice or eagerly open audio');
});

test('infantry never says vehicle-only driving phrase, even when the forbidden recording is still available in the approved bank',()=>{
 const forbidden=manifest.clips.find(c=>c.text==='Position wird angefahren!');
 assert.ok(forbidden,'keep the original recording and metadata intact');
 assert.equal(forbidden.profile,'soldier');
 for(const action of ['move','attack','heal','repair','build','load','unload','stop','hold']){
  const clips=radioChoices(manifest.clips,action,'infantry');
  assert.ok(clips.length>0,action+' should still have valid infantry speech');
  assert.ok(clips.every(c=>!(/angefahren/i).test(c.text)),action+' offered a vehicle phrase');
  assert.ok(clips.every(c=>c.id!==forbidden.id));
 }
 // Exercise real policy selection over a long sequence including deterministic tail values.
 const policy=new RadioPolicy(manifest.clips,()=>.999999);
 for(let n=0;n<45;n++){
  const clip=policy.choose('move','infantry',n*2,false);
  assert.ok(clip);
  assert.notEqual(clip.id,forbidden.id);
  assert.doesNotMatch(clip.text,/angefahren/i);
 }
 assert.ok(radioChoices(manifest.clips,'build','engineer').some(c=>c.text==='Baustelle wird angefahren!'),
   'specialized engineer construction announcements are unaffected');
});
