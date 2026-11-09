import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TacticalMusic,MUSIC_SCORE,MUSIC_CHORD_SECONDS,musicChordAt,musicCombatLevel}
 from '../dist/src/reborn/tactical-music.js';

test('music is an original deterministic four-chord ambient score',()=>{
 assert.equal(MUSIC_SCORE.length,4);
 assert.equal(MUSIC_SCORE.every(c=>c.length===4),true);
 assert.deepEqual(musicChordAt(0),MUSIC_SCORE[0]);
 assert.deepEqual(musicChordAt(MUSIC_CHORD_SECONDS+1),MUSIC_SCORE[1]);
 assert.deepEqual(musicChordAt(MUSIC_CHORD_SECONDS*4+.1),MUSIC_SCORE[0]);
 assert.deepEqual(musicChordAt(-100),MUSIC_SCORE[0]);
 assert.ok(musicCombatLevel(0,false)<musicCombatLevel(6,true));
 assert.ok(musicCombatLevel(600,true)<=1);
});

test('ambient music has no sustained diesel-frequency bass after infantry unlocks audio',()=>{
 const notes=MUSIC_SCORE.flat();
 assert.ok(Math.min(...notes)>=190,'the soundtrack must not drone in the 40-150 Hz engine band');
 const score=readFileSync('src/reborn/tactical-music.ts','utf8');
 assert.match(score,/this\.rumbleCut\.type='highpass'/);
 assert.match(score,/this\.rumbleCut\.frequency\.value=250/);
 assert.match(score,/gain\.connect\(this\.rumbleCut\)/);
 assert.match(score,/this\.rumbleCut\.disconnect\(\)/);
});

function mockAudio(){
 const calls={oscillators:0,stops:0,targets:[],connections:0};
 const param=()=>({
  value:0,setTargetAtTime(value,time,smoothed){calls.targets.push({value,time,smoothed});}
 });
 const node=()=>({
  gain:param(),frequency:param(),Q:param(),type:'sine',
  connect(){calls.connections++;},disconnect(){},start(){},
  stop(){calls.stops++;}
 });
 const context={
  currentTime:10,
  createOscillator(){calls.oscillators++;return node();},
  createGain(){return node();},
  createBiquadFilter(){return node();}
 };
 return {context,output:node(),calls};
}
test('web audio music only allocates four long-lived synthesizer voices, no per-frame allocations',()=>{
 const {context,output,calls}=mockAudio();
 const music=new TacticalMusic(context,output);
 assert.equal(calls.oscillators,4);
 assert.equal(music.oscillatorCount,4);
 music.update(0,0,true);
 const first=calls.targets.length;
 music.update(.05,.3,true);
 music.update(.10,.6,true);
 music.update(1,.3,true);
 assert.equal(calls.oscillators,4);
 assert.ok(calls.targets.length>first,'filter modulation only, no new voices');
 music.setVolume(.2);
 music.setDucking(true);
 music.update(MUSIC_CHORD_SECONDS+1,.75,true);
 assert.equal(calls.oscillators,4);
 music.pause();
 const tail=calls.targets.at(-1);
 assert.ok(calls.targets.some(t=>t.value===0));
 assert.equal(music.enabled,true);
 music.setEnabled(false);
 music.dispose();
 assert.equal(calls.stops,4,'dispose stops and disconnects all audio voices');
});

test('fresh WebGL starts without sustained synth music; saved explicit opt-in still works',()=>{
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const html=readFileSync('webgl-preview.html','utf8');
 assert.match(menu,/\$\('sf3d-music-enabled'\)\.checked=options\.musicEnabled===true/);
 assert.match(preview,/sound\.setMusicEnabled\(bootOptions\.musicEnabled===true\)/);
 assert.match(html,/<input id="sf3d-music-enabled" type="checkbox">/);
 assert.doesNotMatch(html,/<input id="sf3d-music-enabled" type="checkbox" checked>/);
 assert.match(preview,/sound\.setEngineSoundsEnabled\(bootOptions\.engineSoundsEnabled!==false\)/);
 assert.match(preview,/sound\.setEffectsVolume\(savedVolume\('effectsVolume',\.85\)\)/);
});

test('WebGL wind noise starts gated and is independently opt-in',()=>{
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const html=readFileSync('webgl-preview.html','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(audio,/this\\.wind\\.gain\\.value=0/);
 assert.match(audio,/setWindEnabled\\(value:boolean\\):void/);
 assert.match(audio,/ambientSounding&&this\\.windEnabled\\?/);
 assert.match(audio,/const mix=ambientSounding&&this\\.engineSoundsEnabled\\?/);
 assert.match(preview,/sound\\.setWindEnabled\\(bootOptions\\.windEnabled===true\\)/);
 assert.match(menu,/options\\.windEnabled===true/);
 assert.match(menu,/windEnabled:\\$\\('sf3d-wind-enabled'\\)\\.checked/);
 assert.match(menu,/a\\.setWindEnabled\\(\\$\\('sf3d-wind-enabled'\\)\\.checked\\)/);
 assert.match(html,/<input id="sf3d-wind-enabled" type="checkbox">/);
});

test('music and effects have independent persistent sliders and are silent when paused',()=>{
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const html=readFileSync('webgl-preview.html','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(audio,/private music:TacticalMusic\|null=null/);
 assert.match(audio,/musicCombatLevel\(g\.shots\.length/);
 assert.match(audio,/this\.music\?\.pause\(\)/);
 assert.match(audio,/setEffectsVolume\(value:number\)/);
 assert.match(audio,/setMusicVolume\(value:number\)/);
 assert.match(audio,/setMusicEnabled\(value:boolean\)/);
 assert.match(audio,/this\.music\?\.setDucking\(Boolean\(active\)\)/);
 assert.match(menu,/musicVolume:Number\(\$\('sf3d-music-volume'\)\.value\)/);
 assert.match(menu,/effectsVolume:Number\(\$\('sf3d-effects-volume'\)\.value\)/);
 assert.match(menu,/masterVolume:Number\(\$\('sf3d-master-volume'\)\.value\)/);
 for(const id of ['sf3d-music-volume','sf3d-master-volume','sf3d-effects-volume','sf3d-music-enabled'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.match(preview,/sound\.setMusicVolume\(savedVolume\('musicVolume',\.30\)\)/);
 assert.match(preview,/sound\.setEffectsVolume\(savedVolume\('effectsVolume',\.85\)\)/);
});
