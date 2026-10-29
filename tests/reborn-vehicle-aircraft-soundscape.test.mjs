import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENGINE_KINDS,ENGINE_PROFILES,vehicleSoundMix} from '../dist/src/reborn/vehicle-soundscape.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const at=(kind,x,y,moving=true,owner=0)=>({
  id:11+Math.floor(x),kind,x,y,moving,owner,hp:200,driveSpeed:moving?65:0
});
test('five distinct vehicle and aircraft synth families have their own safe profiles',()=>{
 assert.deepEqual(ENGINE_KINDS,['rover','tank','artillery','scout','bomber']);
 for(const kind of ENGINE_KINDS){
  const p=ENGINE_PROFILES[kind];
  assert.ok(p.low>20&&p.high>p.low);
  assert.ok(p.volume>0&&p.volume<=.10);
  assert.ok(p.texture>=0&&p.texture<=.5);
  assert.ok(p.cutoff>p.high);
 }
 assert.ok(ENGINE_PROFILES.bomber.noiseHz>ENGINE_PROFILES.rover.noiseHz);
 assert.ok(ENGINE_PROFILES.tank.pulse>0);
 assert.ok(ENGINE_PROFILES.scout.pulse>0);
});
test('a nearby moving Jeep, tank, rocket truck, helicopter and bomber get audible independent channels',()=>{
 const units=[at('rover',120,100),at('tank',140,100),at('artillery',130,100),at('scout',100,140),at('bomber',100,120)];
 const g={units},position={x:100,y:100};
 const a=vehicleSoundMix(g,position,()=>true),b=vehicleSoundMix(g,position,()=>true);
 assert.deepEqual(a,b,'deterministic; audio never changes the simulation');
 for(const kind of ENGINE_KINDS){
  assert.ok(a[kind].level>.7,kind+' must be clearly heard at close distance');
  assert.ok(a[kind].throttle>.05);
  assert.equal(a[kind].count,1);
 }
 assert.ok(a.rover.pan>0);
 assert.ok(a.scout.pan<=.01);
});
test('driving starts louder than idle and vehicles fade with distance and stop at the audible boundary',()=>{
 const origin={x:0,y:0};
 const kind='tank';
 const moving=vehicleSoundMix({units:[at(kind,30,0,true)]},origin,()=>true)[kind];
 const parked=vehicleSoundMix({units:[at(kind,30,0,false)]},origin,()=>true)[kind];
 const far=vehicleSoundMix({units:[at(kind,600,0,true)]},origin,()=>true)[kind];
 const beyond=vehicleSoundMix({units:[at(kind,900,0,true)]},origin,()=>true)[kind];
 assert.ok(moving.level>parked.level);
 assert.ok(moving.level>far.level);
 assert.equal(beyond.level,0);
 assert.equal(beyond.count,0);
 assert.equal(parked.moving,0);
 assert.ok(parked.level>0,'quiet idling should remain present');
});
test('helicopter rotor keeps its quiet hover, bomber turbines keep an audible flight idle',()=>{
 const cam={x:100,y:100};
 for(const kind of ['scout','bomber']){
  const parked=vehicleSoundMix({units:[at(kind,100,100,false)]},cam,()=>true)[kind];
  const moving=vehicleSoundMix({units:[at(kind,100,100,true)]},cam,()=>true)[kind];
  assert.ok(parked.level>.3);
  assert.ok(moving.level>=parked.level);
 }
});
test('no enemy sound leaks through unexplored terrain, and carried/destroyed units are silent',()=>{
 const units=[at('rover',120,100,true,1),at('tank',120,100,true,1),at('artillery',120,100,true,1),
  at('scout',120,100,true,1),at('bomber',120,100,true,1)];
 const hidden=vehicleSoundMix({units},{x:100,y:100},()=>false);
 assert.ok(ENGINE_KINDS.every(kind=>hidden[kind].level===0));
 const friend=[{...units[0],owner:0},...units.map(u=>({...u,owner:1}))];
 const onlyFriend=vehicleSoundMix({units:friend},{x:100,y:100},u=>u.owner===0);
 assert.ok(onlyFriend.rover.level>0);
 assert.ok(onlyFriend.tank.level===0&&onlyFriend.bomber.level===0);
 const invalid=vehicleSoundMix({units:[{...units[0],carrier:17},{...units[1],hp:0}]},{x:100,y:100},()=>true);
 assert.ok(ENGINE_KINDS.every(kind=>invalid[kind].level===0));
});
test('audio is presentation-only: listening creates no saved state, and the player controls retain mute, pause and speech ducking',()=>{
 const g=new Simulation(2026,14),before=g.save(),camera=g.bases[0];
 vehicleSoundMix(g,camera,p=>g.canSee(0,p));
 assert.deepEqual(g.save(),before);
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(audio,/vehicleSoundMix\(g,r\.camera/);
 assert.match(audio,/g\.canSee\(0,p\)/);
 assert.match(audio,/this\.ambience/);
 assert.match(audio,/g\.paused/);
 assert.match(audio,/document\.hidden/);
 assert.match(audio,/this\.effects\)/,'engine voices duck with the existing radio and effect bus');
 assert.match(audio,/this\.engineVoices/);
 assert.match(audio,/level\*profile\.volume/);
});
