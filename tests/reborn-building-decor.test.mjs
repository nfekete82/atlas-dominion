import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BuildingDecor,buildingProps,DECOR_PROP_COUNTS} from '../dist/src/reborn/building-decor.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

const kinds=['headquarters','barracks','factory','airfield','generator','turret','bastion'];
const center={x:1850,y:2000};
test('base decor: every structure gets restrained military supply props, not repetitive random scattering',()=>{
 const expected={headquarters:8,barracks:6,factory:8,airfield:9,generator:3,turret:2,bastion:2};
 assert.deepEqual(DECOR_PROP_COUNTS,expected);
 const propKinds=new Set();
 for(const kind of kinds){
  const r=kind==='bastion'?42:BUILDINGS[kind].radius;
  const props=buildingProps(kind,center,r,1003,2026);
  assert.equal(props.length,expected[kind]);
  assert.ok(props.every(p=>p.kind&&p.size>20&&p.size<100&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(props.some(p=>p.layer==='behind'));
  assert.ok(props.every(p=>Math.abs(p.x-center.x)>.80*r),'never cover the doorway or unit spawn corridor');
  props.forEach(p=>propKinds.add(p.kind));
 }
 for(const key of ['crate','stack','lamp','barrel','terminal','pallet','sandbags','bollard','fuel','groundlight'])
  assert.ok(propKinds.has(key),'missing themed prop '+key);
});
test('base decor: deterministic seed per building ID, never mutates positions or any game save',()=>{
 const g=new Simulation(2026,14),original=g.save();
 const b=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0),radius=BUILDINGS.headquarters.radius;
 const a=buildingProps(b.kind,b,radius,b.id,g.seed),identical=buildingProps(b.kind,b,radius,b.id,g.seed);
 assert.deepEqual(a,identical);
 const varied=buildingProps(b.kind,b,radius,b.id+123,g.seed);
 assert.notDeepEqual(a,varied);
 assert.notDeepEqual(a,buildingProps(b.kind,b,radius,b.id,g.seed+1));
 assert.ok(a.every(p=>p.layer==='front'||p.layer==='behind'));
 assert.deepEqual(g.save(),original);
 assert.ok(!Object.hasOwn(g.save(),'buildingDecor'));
 const art=new BuildingDecor();
 assert.equal(art.spriteCount,0,'sprite creation must be lazy and not access DOM on Node');
});
test('base decor: both factions share the exact footprint; unfinished construction and units remain untouched',()=>{
 const a=buildingProps('factory',center,70,1100,2026);
 const b=buildingProps('factory',center,70,1100,2026);
 assert.deepEqual(a,b);
 const original=readFileSync('src/reborn/renderer.ts','utf8');
 assert.match(original,/this\.decor\.draw\(c,b\.kind,anchor,spec\.radius,b\.id,this\.game\.seed,b\.owner,'behind'/);
 assert.match(original,/this\.decor\.draw\(c,b\.kind,anchor,spec\.radius,b\.id,this\.game\.seed,b\.owner,'front'/);
 assert.match(original,/this\.decor\.draw\(c,'bastion',p,42,t\.id,g\.seed,t\.owner,'behind'/);
 assert.ok(original.indexOf("this.decor.draw(c,b.kind,anchor")>original.indexOf("if(b.buildRemaining>0)"),
  'props belong to completed buildings, not unfinished building previews');
 assert.match(original,/entities\.sort\(\(a,b\)=>a\.y-b\.y\)/,'existing depth sorting kept');
});
test('base decor: no gameplay implementation has a dependency on visual props',()=>{
 for(const file of ['src/reborn/simulation.ts','src/reborn/world.ts','src/reborn/tactical-ai.ts','src/reborn/input.ts']){
  assert.doesNotMatch(readFileSync(file,'utf8'),/building-decor|buildingProps\(/,file);
 }
 assert.deepEqual(buildingProps('barracks',center,0,1,0),[]);
 assert.deepEqual(buildingProps('barracks',center,NaN,1,0),[]);
});

test('base decor V2: doors and southeast vehicle exits remain empty, including mirrored buildings',()=>{
 for(const kind of kinds){
  const radius=kind==='bastion'?42:BUILDINGS[kind].radius;
  const props=buildingProps(kind,center,radius,1003,2026);
  const within=props.filter(p=>Math.abs(p.x-center.x)<radius*1.40);
  assert.equal(within.length,0,kind+' props must be OUTSIDE the full building facade, not just collider');
  const entrance=props.filter(p=>p.x>center.x+radius*.50&&p.y>center.y-radius*.20);
  assert.equal(entrance.length,0,kind+' props may never obstruct the southeast/front-right doorway');
  for(const p of props){
   const mirrored={x:2*center.x-p.x,y:p.y};
   const mirroredEntry=mirrored.x<center.x-radius*.50&&mirrored.y>center.y-radius*.20;
   assert.equal(mirroredEntry,false,kind+' rotated entrance must also be open');
  }
 }
});
test('base decor V2: substantial shade, directional shadows and bevels replace flat icon art',()=>{
 const code=readFileSync('src/reborn/building-decor.ts','utf8');
 assert.match(code,/createLinearGradient/);
 assert.match(code,/createRadialGradient/);
 assert.match(code,/Heavy sand-colored NATO supply chest/);
 assert.match(code,/Reinforcing steel bands/);
 assert.match(code,/Real mast: ground flange/);
 assert.match(code,/subtle|grain|wear\(/i);
 assert.match(code,/this\.sprites\.set\(key,canvas\)/);
});
