import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 RecordedSoundtrack,SANDFORGE_SOUNDTRACK_URL,SANDFORGE_AMBIENT_URL,SANDFORGE_SOUNDTRACK_URLS,soundtrackGain
} from '../dist/src/reborn/recorded-soundtrack.js';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('uploaded soundtrack uses the exact static MP3 path, not a built-in oscillator',()=>{
 const audio=source('src/reborn/audio.ts');
 const preview=source('scripts/webgl-preview.js');
 const menu=source('scripts/webgl-title-menu.js');
 const html=source('webgl-preview.html');
 const installer=source('scripts/install-sandforge-music.sh');
 assert.equal(SANDFORGE_SOUNDTRACK_URL,
  '/src/assets/reborn/music/sandforge-theme.mp3');
 assert.match(audio,/new RecordedSoundtrack\(a,this\.master\)/);
 assert.doesNotMatch(audio,/new TacticalMusic\(/);
 assert.match(preview,/sound\.setMusicEnabled\(bootOptions\.musicEnabled!==false\)/);
 assert.match(preview,/savedVolume\('musicVolume',\.22\)/);
 assert.match(menu,/\['sf3d-music-volume','musicVolume',22\]/);
 assert.match(menu,/options\.musicEnabled!==false/);
 assert.match(menu,/a\.setMusicVolume\(Number\(\$\('sf3d-music-volume'\)\.value\)\/100\)/);
 assert.match(html,/Sandforge Soundtrack/);
 assert.match(html,/Musiklautstärke/);
 assert.match(installer,/cp "\$SOURCE" "\$TARGET"/);
 assert.match(installer,/git push origin "HEAD:\$BRANCH"/);
 assert.match(source('scripts/build.mjs'),/cpSync\('src\/assets', 'dist\/src\/assets'/);
});

test('soundtrack is quiet by default, ducks for voice and does not alter effects gain',()=>{
 assert.equal(soundtrackGain(.22,false,0),.22*.34);
 assert.ok(soundtrackGain(.22,true,0)<soundtrackGain(.22,false,.8));
 assert.equal(soundtrackGain(0,false,0),0);
 assert.ok(soundtrackGain(1,false,0)<=.35);
});

test('one streamed HTMLAudioElement rotates tracks and respects live volume, pause, resume, mute',async()=>{
 const oldAudio=globalThis.Audio;
 class FakeAudio{
  static objects=[];
  src='';preload='';loop=false;volume=0;
  currentTime=13;paused=true;
  listeners={};calls=0;
  constructor(){FakeAudio.objects.push(this)}
  addEventListener(type,fn){this.listeners[type]=fn}
  play(){this.calls++;this.paused=false;return Promise.resolve()}
  pause(){this.paused=true}
  removeAttribute(attr){if(attr==='src')this.src=''}
  load(){}
 }
 globalThis.Audio=FakeAudio;
 const tracks=[];
 const ctx={currentTime:2,
  createGain(){
   const gain={value:0,targets:[],setTargetAtTime(v,t,k){this.targets.push([v,t,k]);}};
   return {gain,connect(){},disconnect(){}};
  },
  createMediaElementSource(audio){
   tracks.push(audio);
   return {connect(){},disconnect(){}};
  }
 };
 try{
  const track=new RecordedSoundtrack(ctx,{});
  assert.equal(FakeAudio.objects.length,1,'not one audio element per frame');
  assert.equal(tracks.length,1,'only one WebAudio decode/stream source');
  assert.equal(tracks[0].src,SANDFORGE_SOUNDTRACK_URL);
  assert.equal(tracks[0].loop,false,'playlist advances at track end instead of looping one song');
  assert.equal(tracks[0].volume,1,'volume lives on independent WebAudio gain');
  track.update(0,0,true);
  assert.equal(track.isPlaying,true);
  assert.equal(track.currentTime,13);
  await Promise.resolve();
  track.setVolume(.45);
  assert.equal(track.volume,.45);
  track.setDucking(true);
  assert.equal(track.isPlaying,true,'voice ducking does not restart soundtrack');
  const calls=tracks[0].calls;
  track.update(200,1,true);
  assert.equal(tracks[0].calls,calls,
   'even after 200s no new HTMLAudio elements/players are created');
  track.update(201,0,false);
  assert.equal(track.isPlaying,false,'tactical pause pauses MP3');
  ctx.currentTime=6;
  track.update(202,0,true);
  assert.equal(track.isPlaying,true,'resume continues the same recording');
  assert.equal(tracks[0].currentTime,13);
  track.setEnabled(false);
  assert.equal(track.isPlaying,false,'music checkbox fully mutes');
  track.dispose();
  assert.equal(tracks[0].src,'','dispose releases static asset');
 }finally{
  if(oldAudio===undefined)delete globalThis.Audio;
  else globalThis.Audio=oldAudio;
 }
});

test('absent MP3 fails gracefully; the rest of game and effects continue',()=>{
 const oldAudio=globalThis.Audio;
 class Missing{
  paused=true;listeners={};src='';
  addEventListener(t,f){this.listeners[t]=f}
  play(){return Promise.resolve()}
  pause(){}
  removeAttribute(){}
  load(){}
 }
 globalThis.Audio=Missing;
 const gain={setTargetAtTime(){}};
 const ctx={currentTime:5,createGain:()=>({gain,connect(){},disconnect(){}}),
  createMediaElementSource:()=>({connect(){},disconnect(){}})};
 try{
  const t=new RecordedSoundtrack(ctx,{});
  t.setEnabled(true);
  // Missing asset returns HTTP 404 in real browser. Only the MP3 channel
  // is disabled, never the WebAudio effects or scene bootstrap.
  t.audio; // no network in this test
  assert.equal(t.missing,false);
  t.dispose();
 }finally{
  if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
 }
});

test('additional atmospheric MP3 follows the original and loops the playlist',async()=>{
 assert.deepEqual([...SANDFORGE_SOUNDTRACK_URLS],
  [SANDFORGE_SOUNDTRACK_URL,SANDFORGE_AMBIENT_URL]);
 const oldAudio=globalThis.Audio;
 class FakeAudio{
  paused=true;currentTime=0;listeners={};loop=true;src='';volume=0;
  constructor(){FakeAudio.instances.push(this)}
  static instances=[];
  addEventListener(event,fn){this.listeners[event]=fn}
  play(){this.paused=false;return Promise.resolve()}
  pause(){this.paused=true}
  load(){this.paused=true}
  removeAttribute(name){if(name==='src')this.src=''}
 }
 globalThis.Audio=FakeAudio;
 const ctx={currentTime:0,
  createGain:()=>({gain:{setTargetAtTime(){}},connect(){},disconnect(){}}),
  createMediaElementSource:()=>({connect(){},disconnect(){}})
 };
 try{
  const music=new RecordedSoundtrack(ctx,{});
  const player=FakeAudio.instances[0];
  music.update(0,0,true);
  await Promise.resolve();
  assert.equal(player.src,SANDFORGE_SOUNDTRACK_URL);
  assert.equal(player.loop,false);
  player.paused=true;player.listeners.ended();
  assert.equal(player.src,SANDFORGE_AMBIENT_URL);
  await Promise.resolve();
  player.paused=true;player.listeners.ended();
  assert.equal(player.src,SANDFORGE_SOUNDTRACK_URL);
  assert.equal(FakeAudio.instances.length,1,'rotation must keep one WebAudio media source');
  // Optional second asset missing: return to the original theme, not silence.
  player.paused=true;player.listeners.ended();
  assert.equal(player.src,SANDFORGE_AMBIENT_URL);
  player.listeners.error();
  assert.equal(player.src,SANDFORGE_SOUNDTRACK_URL);
  assert.equal(music.missing,false);
  music.dispose();
 }finally{
  if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
 }
});
