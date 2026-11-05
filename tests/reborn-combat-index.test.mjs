import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('combat index: complete paid battles match linear entity lookup on current map sizes',()=>{
 for(const version of [11,12,13,14]){
  const indexed=new Simulation(2026,version),linear=new Simulation(2026,version);
  linear.combatEntity=id=>id==null?undefined:[...linear.units,...linear.bases].find(e=>e.id===id);
  for(const g of [indexed,linear]){
   g.time=25;g.aiClock=3;
   for(let i=0;i<8;i++){
    const u=g.spawn(i%2,{x:1700+(i%2)*150,y:1700+Math.floor(i/2)*36},i<2?'tank':i<4?'medic':'infantry');
    if(i>=6)g.stop([u.id],true);
   }
  }
  for(let i=0;i<240;i++){
   indexed.step();linear.step();
   if(i%40===0||i===239)assert.deepEqual(indexed.save(),linear.save(),`map ${version}, tick ${i}`);
  }
 }
});

test('combat index: missing/dead targets and replaced unit arrays do not retain a stale lock',()=>{
 const g=new Simulation(2026);g.world.blocked.fill(0);g.world.opaque.fill(0);g.aiClock=-1e8;
 const blue=g.spawn(0,{x:1500,y:1500},'infantry'),red=g.spawn(1,{x:1580,y:1500},'infantry');
 g.updateVision();g.command([blue.id],{kind:'attack',target:red.id,x:red.x,y:red.y});g.step();
 assert.equal(blue.combatTarget,red.id);
 g.units=g.units.filter(u=>u!==red);g.step();
 assert.notEqual(blue.combatTarget,red.id);assert.equal(g.combatEntity(red.id),undefined);
 assert.equal(g.combatEntity(null),undefined);assert.equal(g.combatEntity(999999),undefined);
 const base=g.bases[1];assert.equal(g.combatEntity(base.id),base);
});
