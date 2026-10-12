import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';
import {MINIMAP_WIDTH,MINIMAP_HEIGHT,minimapTarget,minimapCombatPoints}
  from '../dist/src/render/strategic-minimap.js';

function border(seed=4803){
  const g=new Game(seed,2,'DE','balanced');
  g.factions.forEach(f=>f.ai=false);
  const own=g.owner.findIndex((id,i)=>id===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  assert.ok(own>=0);
  const hostile=landNeighbors(own).find(n=>g.owner[n]===NEUTRAL);
  g.owner[hostile]=1;
  g.factions[0].troops=1700;
  g.recount();
  return {g,own,hostile,point:cellToPoint(own)};
}

test('border commands move genuine troops and do not auto-refill withdrawn posts',()=>{
  const {g,own,point}=border();
  g.frontline[own]=320;g.recount();
  const total=g.populationOf(0),mobile=g.factions[0].troops;
  assert.equal(g.setBorderMode(0,point,'withdraw').ok,true);
  assert.equal(g.getBorderMode(point),'withdraw');
  assert.ok(g.frontline[own]<320);
  assert.ok(g.factions[0].troops>mobile);
  assert.ok(Math.abs(g.populationOf(0)-total)<.00001);
  const after=g.frontline[own];
  for(let i=0;i<6;i++)g.redistributeFrontline();
  assert.ok(g.frontline[own]<=after+.001,'auto-defense must respect withdrawal');
  assert.ok(Math.abs(g.populationOf(0)-total)<.00001,'redistribution conserves soldiers');
  assert.equal(g.setBorderMode(0,point,'hold').ok,true);
  assert.equal(g.getBorderMode(point),'hold');
  assert.equal(g.borderOrders.size,0);
});

test('defend priority grows its own frontier without conjuring extra soldiers',()=>{
  const {g,own,point}=border(4804);
  g.frontline[own]=0;g.recount();
  const before=g.populationOf(0);
  assert.equal(g.setBorderMode(0,point,'defend').ok,true);
  for(let i=0;i<12;i++)g.redistributeFrontline();
  assert.ok(g.frontline[own]>0);
  assert.ok(Math.abs(g.populationOf(0)-before)<.00001);
  assert.equal(g.getBorderMode(point),'defend');
});

test('border orders are saved exactly, survive load, and old saves remain valid',()=>{
  const {g,point}=border(4805);
  assert.equal(g.setBorderMode(0,point,'defend').ok,true);
  const save=g.exportSave();
  assert.equal(save.borderOrders.length,1);
  const restored=Game.fromSave(structuredClone(save));
  assert.deepEqual(restored.exportSave(),save);
  const legacy=structuredClone(save);delete legacy.borderOrders;
  assert.equal(Game.fromSave(legacy).getBorderMode(point),'hold');
  assert.throws(()=>Game.fromSave({...save,borderOrders:[{index:-1,mode:'defend'}]}),/Grenzbefehle/);
  assert.throws(()=>Game.fromSave({...save,borderOrders:[{index:point.y*480+point.x,mode:'unknown'}]}),/Grenzbefehle/);
  assert.throws(()=>Game.fromSave({...save,borderOrders:[...save.borderOrders,...save.borderOrders]}),/Grenzbefehle/);
});

test('an allied or foreign border cannot be manipulated by the human player',()=>{
  const {g,point,hostile}=border(4806);
  assert.equal(g.setBorderMode(1,point,'withdraw').ok,false);
  assert.equal(g.setBorderMode(0,cellToPoint(hostile),'withdraw').ok,false);
  assert.equal(g.setBorderMode(0,{x:-1,y:3},'defend').ok,false);
  assert.equal(g.offerAlliance(0,1).ok,true);
  assert.equal(g.setBorderMode(0,point,'defend').ok,false);
});

test('border hotspots show real country contacts and are ranked deterministically',()=>{
  const {g,own,point}=border(4807);
  g.frontline[own]=1;g.recount();
  const a=g.borderHotspots(6),b=g.borderHotspots(6);
  assert.deepEqual(a,b);
  assert.ok(a.length>=1);
  assert.ok(a.every(x=>g.owner[x.index]===0&&x.opponents.every(f=>f!==0&&f>=0)));
  assert.ok(a.some(x=>x.index===own));
  assert.deepEqual(g.borderHotspots(0),[]);
  assert.ok(a.every(x=>x.mode==='hold'));
});

test('minimap coordinates map to same real sector grid, with no fabricated wars',()=>{
  assert.equal(MINIMAP_WIDTH,240);assert.equal(MINIMAP_HEIGHT,130);
  assert.deepEqual(minimapTarget(120,65,240,130),{x:240,y:130});
  assert.deepEqual(minimapTarget(0,0,240,130),{x:0,y:0});
  assert.deepEqual(minimapTarget(240,130,240,130),{x:479,y:259});
  assert.equal(minimapTarget(-1,10,240,130),null);
  assert.equal(minimapTarget(12,10,0,130),null);
  const {g}=border(4808);
  assert.deepEqual(minimapCombatPoints(g),[]);
  g.attackOrders.push({id:12345,factionId:0,targetOwner:1,anchor:{x:240,y:128},
    committed:90,remaining:80,fallen:10,conquered:0,effort:100,startedTick:g.tick});
  const p=minimapCombatPoints(g);
  assert.equal(p.length,1);
  assert.equal(p[0].index,128*480+240);
  assert.equal(p[0].friendly,true);
});
