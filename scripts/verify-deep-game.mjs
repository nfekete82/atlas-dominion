import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Game} from '../dist/src/engine/game.js';
import {validSeaRoute} from '../dist/src/engine/navigation.js';
const directory=process.env.ATLAS_QA_DIR??'docs/qa/deep-game-20261022';
const cases=JSON.parse(readFileSync(directory+'/after-simulation.json','utf8')).results;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const verified=[];
for(const config of cases){
 const {seed,opponents,country,difficulty}=config;
 let game=new Game(seed,opponents,country,difficulty,true),reference=null,paid=0,maxDrift=0,movementWrites=0;
 const initial=game.factions.reduce((n,f)=>n+f.population,0),watched=new WeakSet();let moves=new Set();
 const instrument=()=>{
  const subject=game;
  for(const name of ['recruitSquad','reinforceSquad']){
   const original=subject[name].bind(subject);
   subject[name]=(...args)=>{const result=original(...args);if(result.ok&&subject===game)paid+=args.at(-1);return result;};
  }
 };
 instrument();
 for(let tick=1;tick<=1000;tick++){
  moves=new Set();
  for(const unit of game.squads)if(!watched.has(unit)){
   watched.add(unit);const world=game;let position=unit.index;
   Object.defineProperty(unit,'index',{enumerable:true,configurable:true,get:()=>position,set:next=>{
    if(next===position)return;assert.ok(!moves.has(unit.id),`duplicate movement ${tick}/${unit.id}`);moves.add(unit.id);movementWrites++;
    const landing=unit.seaRoute?.length&&position===unit.seaRoute[0]&&unit.destination===null&&
     next===unit.seaLanding&&unit.seaTicks>=Math.max(8,Math.ceil(unit.seaRoute.length/3));
    if(landing)assert.ok(validSeaRoute(unit.seaRoute,position,next));
    else{
     const dx=next%480-position%480,dy=Math.floor(next/480)-Math.floor(position/480);
     assert.ok(Math.abs(dx)<=1&&Math.abs(dy)<=1,`illegal movement ${tick}/${unit.id}`);
     if(dx&&dy)assert.ok(world.owner[position+dx]===unit.owner&&world.owner[position+dy*480]===unit.owner,'blocked corner');
    }
    assert.equal(world.owner[next],unit.owner,'unowned destination');position=next;
   }});
  }
  if(reference){reference.status='playing';reference.step();}
  game.status='playing';game.step();assert.equal(game.tick,tick);
  const people=game.factions.reduce((n,f)=>n+f.population,0),losses=game.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
  maxDrift=Math.max(maxDrift,Math.abs(initial+paid-losses-people));assert.ok(maxDrift<1e-6,'soldier conservation');
  assert.ok(game.squads.every(unit=>unit.troops>0&&game.owner[unit.index]===unit.owner));
  assert.ok(game.squads.every(unit=>unit.destination===null||game.owner[unit.destination]===unit.owner),'owned march destinations');
  assert.ok(game.squads.every(unit=>unit.attackTarget==null||game.owner[unit.attackTarget]!==unit.owner),'hostile attack waypoints');
  assert.ok(game.factions.every(f=>Number.isFinite(f.money)&&f.money>=0));
  if(reference&&tick%100===0)assert.deepEqual(game.exportSave(),reference.exportSave(),`replay ${country}/${difficulty}/${tick}`);
  if(tick===500){
   const save=game.exportSave();reference=game;
   for(const unit of reference.squads)Object.defineProperty(unit,'index',{value:unit.index,writable:true,enumerable:true,configurable:true});
   game=Game.fromSave(JSON.parse(JSON.stringify(save)));instrument();assert.deepEqual(game.exportSave(),save);
  }
 }
 assert.equal(hash(reference.exportSave()),config.hash,'independent uninterrupted simulation hash');
 const finalSave=game.exportSave();
 assert.deepEqual(Game.fromSave(JSON.parse(JSON.stringify(finalSave))).exportSave(),finalSave,'final JSON save');
 verified.push({seed,opponents,country,difficulty,ticks:game.tick,jsonReloadTick:500,finalJsonReloadTick:1000,maxDrift,movementWrites,passed:true});
 writeFileSync(directory+'/replay-verification.json',JSON.stringify(verified,null,2));
 console.log(`Verified ${opponents+1} countries, ${country}, ${difficulty}, seed ${seed}: 1000 ticks, ${movementWrites} lawful moves, exact JSON continuation`);
}
