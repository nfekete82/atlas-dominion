import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {BASTION_SPACING,seededRandom} from '../dist/src/reborn/world-generation.js';

test('campaign: 100 different maps space every bastion and connect all of them by real footpaths from both starts',()=>{
 const random=seededRandom(0x7ab2c908),layouts=new Set();
 for(let sample=0;sample<100;sample++){
  const seed=sample===0?0:sample===1?4294967295:Math.floor(random()*4294967296),g=Simulation.campaign(seed),w=g.world;
  assert.equal(w.mapVersion,1);assert.ok(w.generated.mesas.length>=20,`sparse map ${seed}`);
  layouts.add(JSON.stringify({sites:g.territories.map(t=>t.point),rocks:w.rocks}));
  for(const t of g.territories){
   for(const other of g.territories)if(t.id!==other.id)assert.ok(distance(t.point,other.point)>=BASTION_SPACING,`crowded ${seed}/${t.id}/${other.id}`);
   assert.deepEqual(w.clearSite(t.point,RULES.captureRadius),t.point,`blocked capture zone ${seed}/${t.id}`);
   for(const start of g.units){
    const path=w.path(start,t.point,g.obstacles());assert.ok(path.length,`unreachable ${seed}/${start.owner}/${t.id}`);
    let p=start;for(const q of path){assert.ok(w.line(p,q,g.obstacles()),`cliff/building clipping ${seed}/${t.id}`);p=q;}
    assert.ok(distance(path.at(-1),t.point)<.001,`substituted unreachable destination ${seed}/${t.id}`);
   }
  }
  for(const b of g.bases)assert.deepEqual(w.clearSite({x:b.x,y:b.y},b.radius+20),{x:b.x,y:b.y});
 }
 assert.equal(layouts.size,100);
});

test('campaign: new campaigns roll fresh seeds; seeds reproduce terrain and save/load restores its exact geometry',()=>{
 const a=Simulation.campaign(),b=Simulation.campaign();assert.notEqual(a.seed,b.seed);assert.notDeepEqual(a.world.blocked,b.world.blocked);
 const g=Simulation.campaign(184902),copy=Simulation.campaign(184902);assert.deepEqual(g.save(),copy.save());
 g.command([g.units[0].id],{...g.territories[20].point,kind:'move'});g.aiClock=-1e8;for(let i=0;i<80;i++)g.step();
 const saved=g.save(),loaded=Simulation.load(saved);assert.equal(saved.mapVersion,1);
 assert.deepEqual(loaded.world.generated,g.world.generated);assert.deepEqual(loaded.world.blocked,g.world.blocked);
 assert.deepEqual(loaded.territories,g.territories);assert.deepEqual(loaded.credits,g.credits);assert.deepEqual(loaded.units[0].orders,g.units[0].orders);
 const old=new Simulation().save();delete old.mapVersion;assert.equal(Simulation.load(old).world.mapVersion,0);
 const invalid=g.save();invalid.mapVersion=2;assert.throws(()=>Simulation.load(invalid));
});

test('combat: a newly approaching enemy is fired on in one tick without waiting for the fog raster',()=>{
 for(const owner of [0,1]){
  const g=new Simulation();g.aiClock=-1e8;g.units=[];
  const a=g.spawn(owner,{x:1900,y:2100}),b=g.spawn(1-owner,{x:2050,y:2100});
  g.visible[owner].fill(0);assert.equal(g.canSee(owner,b),false);
  g.step();assert.equal(b.hp,83);assert.equal(a.combatTarget,b.id);assert.equal(g.time,RULES.tick);
 }
});

test('combat: two attackers cannot steal focus; the survivor is acquired immediately after the first target dies',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.units=[];
 const blue=g.spawn(0,{x:1900,y:2100},'heavy'),first=g.spawn(1,{x:2020,y:2100}),second=g.spawn(1,{x:2055,y:2100});
 g.command([blue.id],{x:2350,y:2100,kind:'move'});g.command([blue.id],{x:2400,y:2250,kind:'move'},true);
 g.step();assert.equal(blue.combatTarget,first.id);assert.equal(blue.lastAttacker,second.id);assert.equal(first.hp,66);assert.equal(second.hp,100);
 for(let i=0;i<53;i++)g.step();
 assert.equal(g.units.some(u=>u.id===first.id),false);assert.equal(second.hp,100);assert.ok(blue.hp>0);
 g.step();assert.equal(blue.combatTarget,second.id);assert.equal(blue.orders.length,2);
 for(let i=0;i<27;i++)g.step();assert.ok(second.hp<100);
});

test('combat: locks survive save/load but explicit attack commands override them and cliffs still block fire',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.units=[];
 const blue=g.spawn(0,{x:1900,y:2100}),a=g.spawn(1,{x:2020,y:2100}),b=g.spawn(1,{x:2055,y:2100});g.step();
 const loaded=Simulation.load(g.save());assert.equal(loaded.units[0].combatTarget,a.id);
 g.command([blue.id],{...b,kind:'attack',target:b.id});blue.cooldown=0;g.step();assert.equal(blue.combatTarget,b.id);assert.equal(b.hp,83);
 const wall=g.world.index({x:1980,y:2100});g.world.blocked[wall]=1;g.world.opaque[wall]=1;g.updateVision();blue.cooldown=0;
 const hp=b.hp;g.step();assert.equal(b.hp,hp);assert.notEqual(blue.combatTarget,b.id);
});

const advanceCombat=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step();};

test('combat: guards approach enemies within sight before weapon range and open fire promptly',()=>{
 for(const owner of [0,1]){
  const g=new Simulation();g.aiClock=-1e8;g.units=[];
  const guard=g.spawn(owner,{x:1900,y:2100}),enemy=g.spawn(1-owner,{x:2110,y:2100},'engineer');
  enemy.cooldown=100;g.updateVision();
  assert.ok(g.world.sightLine(guard,enemy));assert.ok(distance(guard,enemy)>UNITS.infantry.range);
  g.step();assert.ok(guard.x>1900,'guard should move toward visible contact in the first tick');
  assert.equal(enemy.hp,UNITS.engineer.hp);assert.deepEqual(guard.pursuitOrigin,{x:1900,y:2100});
  advanceCombat(g,.9);assert.ok(enemy.hp<UNITS.engineer.hp,'guard should advance and fire without being hit first');
 }
});

test('combat: plain move orders outrank auto-chase, but attack-move engages and keeps its order',()=>{
 for(const kind of ['move','attackMove']){
  const g=new Simulation();g.aiClock=-1e8;g.units=[];
  const blue=g.spawn(0,{x:1900,y:2100}),red=g.spawn(1,{x:2110,y:2100},'engineer');
  red.cooldown=100;g.command([blue.id],{x:1650,y:2100,kind});g.updateVision();
  g.step();
  assert.equal(blue.orders.length,1);
  if(kind==='move'){assert.ok(blue.x<1900);assert.equal(blue.pursuitOrigin,null);}
  else {assert.ok(blue.x>1900);assert.deepEqual(blue.pursuitOrigin,{x:1900,y:2100});}
  g.units=g.units.filter(u=>u.id!==red.id);
  advanceCombat(g,2);
  assert.ok(blue.x<1900,'original destination is resumed after the enemy disappears');
  assert.equal(blue.orders[0].kind,kind);
 }
});

test('combat: idle guards abandon pursuit and return to their initial position',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.units=[];
 const blue=g.spawn(0,{x:1900,y:2100}),red=g.spawn(1,{x:2110,y:2100},'engineer');
 red.cooldown=100;g.updateVision();advanceCombat(g,.2);
 assert.ok(blue.x>1910);assert.deepEqual(blue.pursuitOrigin,{x:1900,y:2100});
 const saved=Simulation.load(g.save());
 assert.deepEqual(saved.units.find(u=>u.id===blue.id).pursuitOrigin,blue.pursuitOrigin);
 g.units=g.units.filter(u=>u.id!==red.id);advanceCombat(g,3);
 assert.ok(distance(blue,{x:1900,y:2100})<18,'guard should return instead of leaving its post');
 assert.equal(blue.pursuitOrigin,null);
});

test('combat: cliffs prevent auto-pursuit of opponents outside weapon range',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.units=[];
 const guard=g.spawn(0,{x:1900,y:2100}),enemy=g.spawn(1,{x:2110,y:2100},'engineer');
 const wall=g.world.index({x:1980,y:2100});g.world.blocked[wall]=1;g.world.opaque[wall]=1;g.updateVision();
 assert.equal(g.world.sightLine(guard,enemy),false);
 advanceCombat(g,1);assert.equal(guard.x,1900);assert.equal(enemy.hp,UNITS.engineer.hp);
 assert.equal(guard.pursuitOrigin,undefined);
});
