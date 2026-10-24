import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {RadioPolicy,radioChoices,radioProfile} from '../dist/src/reborn/unit-radio.js';
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
 assert.equal(radioChoices(clips,'move','infantry').length,8);assert.equal(radioChoices(clips,'attack','infantry').length,6);
 for(const kind of ['infantry','heavy','medic','engineer','rover','tank','artillery','scout','gunship','bomber'])for(const action of ['move','attack','stop','hold'])assert.ok(radioChoices(clips,action,kind).length>=2,`${kind}/${action}`);
 assert.ok(radioChoices(clips,'heal','medic').every(c=>c.group==='medic'));assert.ok(radioChoices(clips,'repair','engineer').some(c=>c.text==='Reparatur wird durchgeführt!'));assert.ok(radioChoices(clips,'build','engineer').some(c=>c.text==='Baustelle wird angefahren!'));
 assert.ok(radioChoices(clips,'move','engineer').every(c=>!['repair','build'].includes(c.group)));assert.ok(radioChoices(clips,'move','tank').every(c=>c.profile==='crew'));assert.ok(radioChoices(clips,'move','heavy').every(c=>!c.text.includes('Besatzung')));
 assert.ok(radioChoices(clips,'move','gunship').every(c=>c.group==='air'));assert.equal(radioChoices(clips,'load','scout').length,2);assert.ok(radioChoices(clips,'unload','scout').some(c=>c.text==='Truppen werden abgesetzt!'));
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
