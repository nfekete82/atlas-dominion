import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_SETTINGS_KEY,DEFAULT_AUDIO_SETTINGS,normalizeAudioSettings,soundNotes,
  Soundscape,
} from '../dist/src/audio/soundscape.js';

test('audio preferences have intentionally quiet defaults and independently bounded controls',()=>{
  assert.equal(AUDIO_SETTINGS_KEY,'atlas-dominion-audio-v1');
  assert.equal(normalizeAudioSettings(null).music,false,'music must opt in');
  assert.equal(DEFAULT_AUDIO_SETTINGS.effects,true);
  const prefs=normalizeAudioSettings({music:true,effects:false,master:900,
    musicVolume:-3,effectsVolume:45.6});
  assert.deepEqual(prefs,{music:true,effects:false,master:100,musicVolume:0,effectsVolume:46});
  const corrupted=normalizeAudioSettings({music:'yes',effects:42,master:NaN,
    musicVolume:Infinity,effectsVolume:'90'});
  assert.deepEqual(corrupted,DEFAULT_AUDIO_SETTINGS);
});

test('all UI and battlefield events produce safe short sound presets with no external assets',()=>{
  for(const kind of ['attack','conquest','alert','build','alliance','retreat',
    'reinforce','victory','defeat','ui']){
    const notes=soundNotes(kind);
    assert.ok(notes.length>=1&&notes.length<=4);
    assert.ok(notes.every(n=>n.freq>=70&&n.freq<1100&&n.duration>.04&&
      n.duration<=.8&&n.delay>=0&&n.delay<.6&&n.gain>0&&n.gain<=.7));
    assert.deepEqual(soundNotes(kind),notes);
  }
});

test('creating audio on page load never opens an AudioContext or starts music',()=>{
  const sound=new Soundscape({music:true,effects:true,master:42,musicVolume:15,effectsVolume:17});
  assert.deepEqual(sound.debug(),{contextCreated:false,musicPlaying:false,musicGesture:false});
  sound.update({musicVolume:11,effects:false});
  assert.deepEqual(sound.debug(),{contextCreated:false,musicPlaying:false,musicGesture:false});
  assert.equal(sound.snapshot().effects,false);
  const other=sound.snapshot();other.master=0;
  assert.equal(sound.snapshot().master,42,'callers cannot mutate saved preferences');
  sound.dispose();
});
