import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,unitKinds,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {preferredRole} from '../dist/src/reborn/ai-director.js';
import {addProducer} from './fixtures/reborn-production.mjs';
const dir='src/assets/reborn/animation/';
function glb(team){const b=fs.readFileSync(`${dir}scout-${team}.glb`),length=b.readUInt32LE(12);assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);return {data:JSON.parse(b.subarray(20,20+length)),bin:b.subarray(28+length)};}
function accessor(data,bin,index){const a=data.accessors[index],v=data.bufferViews[a.bufferView];assert.equal(a.componentType,5126);const count=a.count*({SCALAR:1,VEC3:3,VEC4:4}[a.type]);return Array.from({length:count},(_,i)=>bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));}
test('transport GLBs: real UV meshes, embedded PBR, team enamel and efficient geometry',()=>{
 for(const team of [0,1]){const {data:d,bin}=glb(team);assert.equal(d.images.length,3);for(const im of d.images){assert.ok(im.bufferView>=0);assert.equal(im.mimeType,'image/png');}
 const paint=d.materials.find(m=>m.name==='Weathered desert camouflage PBR');assert.ok(paint.pbrMetallicRoughness.baseColorTexture);assert.ok(paint.pbrMetallicRoughness.metallicRoughnessTexture);assert.ok(paint.normalTexture);assert.ok(paint.occlusionTexture);
 const enamel=d.materials.find(m=>m.name===(team?'Red team enamel':'Blue team enamel')).pbrMetallicRoughness.baseColorFactor;assert.ok(team?enamel[0]>enamel[2]*2:enamel[2]>enamel[0]*2);
 let triangles=0;for(const m of d.meshes)for(const p of m.primitives){assert.ok(p.attributes.TEXCOORD_0>=0);assert.ok(p.attributes.NORMAL>=0);triangles+=d.accessors[p.indices??p.attributes.POSITION].count/3;assert.ok(accessor(d,bin,p.attributes.POSITION).every(Number.isFinite));}assert.ok(triangles>10000&&triangles<40000);assert.ok(d.meshes.length<=16);
 const design=d.nodes.find(n=>n.extras?.atlasDesign)?.extras.atlasDesign;assert.equal(design.mainBlades,5);assert.equal(design.seats,10);
 }
});
test('transport rotors: independent Y/X pivots, normalized continuous quaternion loop',()=>{
 for(const team of [0,1]){const {data:d,bin}=glb(team),clip=d.animations.find(a=>a.name==='Rotors_Continuous');assert.equal(clip.channels.length,2);
 for(const [name,axis] of [['MainRotor_Spin',1],['TailRotor_Spin',0]]){const channel=clip.channels.find(c=>d.nodes[c.target.node].name===name);assert.equal(channel.target.path,'rotation');const sampler=clip.samplers[channel.sampler],times=accessor(d,bin,sampler.input),q=accessor(d,bin,sampler.output);assert.ok(times.length>=64);assert.ok(times.every((t,i)=>!i||t>times[i-1]));assert.ok(q.every(Number.isFinite));for(let i=0;i<q.length;i+=4){assert.ok(Math.abs(Math.hypot(...q.slice(i,i+4))-1)<1e-5);for(let j=0;j<3;j++)if(j!==axis)assert.ok(Math.abs(q[i+j])<1e-6);if(i){const dot=q.slice(i,i+4).reduce((n,v,j)=>n+v*q[i-4+j],0);assert.ok(dot>.9,'no sudden quaternion jumps');}}assert.ok(Math.abs(q.slice(0,4).reduce((n,v,j)=>n+v*q[q.length-4+j],0))>.9999);}
 }
});
test('transport atlas: 192px, 16 directions, 8 distinct rotor phases in idle and flight',()=>{
 for(const team of [0,1]){const d=JSON.parse(fs.readFileSync(`${dir}scout-${team}.json`));assert.deepEqual(d.cell,[192,192]);assert.equal(d.directions,16);assert.equal(d.timeBasedLocomotion,true);assert.equal(d.design.seats,10);assert.equal(d.design.source,'Sandforge authored original transport helicopter GLB');for(const tag of ['idle','walk']){assert.equal(d.clips[tag].sourceClip,'Rotors_Continuous');assert.equal(d.clips[tag].frames.length,16);assert.ok(d.clips[tag].frames.every(row=>row.length===8));assert.ok(d.clips[tag].uniquePhases.every(n=>n===8));}assert.ok(d.frames.every(f=>f.pivot[0]===96&&f.pivot[1]===156));}
});
test('active roster: transport name, ten seats, airfield and AI never offer gunship',()=>{
 assert.equal(UNITS.scout.name,'Transporthelikopter');assert.equal(UNITS.gunship,undefined);assert.ok(!unitKinds.includes('gunship'));assert.ok(!BUILDINGS.airfield.description.includes('Kampfhelikopter'));
 for(const air of [0,1,5])assert.ok(!preferredRole('airfield',{scout:0,bomber:0},0,air).includes('gunship'));
 const g=new Simulation(2026,4),b=addProducer(g,'airfield',0);g.credits[0]=2000;assert.equal(g.recruit(b.id,'gunship'),false);assert.equal(g.recruit(b.id,'scout'),true);assert.equal(g.recruit(b.id,'bomber'),true);
});
test('legacy migration preserves IDs, other troops, mixed paid queues, progress and AI counters once',()=>{
 const g=new Simulation(2026,4),h=g.spawn(0,{x:1900,y:2100},'scout'),troop=g.spawn(0,{x:1850,y:2100},'heavy'),b=addProducer(g,'airfield',0);g.credits[0]=3000;g.recruit(b.id,'scout');g.recruit(b.id,'bomber');
 const save=g.save(),old=save.units.find(u=>u.id===h.id),queue=save.bases.find(v=>v.id===b.id);old.kind='gunship';old.hp=190;queue.queueTypes[0]='gunship';queue.queue[0]=18;queue.queueCosts[0]=750;queue.production=9;save.ai.savingFor='gunship';save.ai.economy={goal:null,since:0,attemptAt:-9,produced:{gunship:2,scout:1},built:{}};
 const loaded=Simulation.load(save);assert.equal(save.units.find(u=>u.id===h.id).kind,'gunship','input untouched');assert.equal(loaded.units.find(u=>u.id===h.id).hp,180);assert.equal(loaded.units.find(u=>u.id===troop.id).kind,'heavy');assert.equal(loaded.units.length,g.units.length);assert.equal(loaded.tactical.state.economy.produced.scout,3);const q=loaded.bases.find(v=>v.id===b.id);assert.deepEqual(q.queueTypes,['scout','bomber']);assert.deepEqual(q.queueCosts,[750,1000]);assert.equal(q.production,7);assert.deepEqual(Simulation.load(loaded.save()).save().units,loaded.save().units);
 const credits=loaded.credits[0];loaded.cancel(b.id,0);assert.equal(loaded.credits[0],credits+750);
 delete queue.queueCosts;assert.deepEqual(Simulation.load(save).bases.find(v=>v.id===b.id).queueCosts,[750,1000]);
 const badQueue=structuredClone(save);badQueue.bases.find(v=>v.id===b.id).queue[0]=14;assert.throws(()=>Simulation.load(badQueue));
 const badCounter=structuredClone(save);badCounter.ai.economy.produced.gunship=-1;assert.throws(()=>Simulation.load(badCounter));
 old.hp=381;assert.throws(()=>Simulation.load(save),'invalid legacy data is still rejected');
});
test('transport arrival: a carrier stopped at the 14 m braking margin still lands and unloads',()=>{
 for(const dt of [.05,.1]){const g=new Simulation(2026,4);g.aiClock=-1e8;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);const h=g.spawn(0,{x:1900,y:2100},'scout'),u=g.spawn(0,{x:1850,y:2100});g.transports.board(h.id,[u.id]);for(let i=0;i<10/dt;i++)g.step(dt);assert.equal(h.transport.cargo.length,1);h.driveSpeed=0;assert.equal(g.transports.unload(h.id,{x:h.x+14,y:h.y}),true);for(let i=0;i<10/dt;i++)g.step(dt);assert.equal(h.transport.cargo.length,0);assert.equal(u.carrier,undefined);assert.equal(h.transport.phase,'cruise');}
});
test('transport atlas shares identical hover/flight rotor pixels rather than doubling decoded memory',()=>{
 for(const team of [0,1]){const d=JSON.parse(fs.readFileSync(`${dir}scout-${team}.json`));assert.equal(d.frames.length,128);assert.deepEqual(d.clips.idle.frames,d.clips.walk.frames);const png=fs.readFileSync(`${dir}scout-${team}.png`);assert.equal(png.readUInt32BE(16),3072);assert.equal(png.readUInt32BE(20),1536);}
});
test('authored transport GLB repacking is canonical and never changes model bytes twice',async()=>{
 const {canonicalizeGlb}=await import('../scripts/animation/canonical-glb.mjs');for(const team of [0,1]){const b=fs.readFileSync(`${dir}scout-${team}.glb`);assert.deepEqual(canonicalizeGlb(b),b);}
});
test('rotor/propeller phase stays continuous across movement starts and stops',async()=>{
 const {SpriteAnimator}=await import('../dist/src/reborn/sprite-animator.js');for(const kind of ['scout','bomber']){const atlas=JSON.parse(fs.readFileSync(`${dir}${kind}-0.json`)),a=new SpriteAnimator(atlas),intent={moving:false,distance:0,angle:0,attack:false,hit:false,dead:false};a.update(0,intent);a.update(atlas.clips.idle.duration*3/8,intent);const before=a.frame(),phase=atlas.clips.idle.frames[0].indexOf(atlas.frames.indexOf(before));const walking=a.update(0,{...intent,moving:true});assert.equal(walking,atlas.frames[atlas.clips.walk.frames[0][phase]]);const stopped=a.update(0,intent);assert.deepEqual([stopped.x,stopped.y],[before.x,before.y]);}
});
