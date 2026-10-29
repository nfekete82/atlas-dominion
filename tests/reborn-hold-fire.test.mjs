import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function arena(){
 const g=new Simulation(2026,4);
 g.units=[];
 g.aiClock=-1e8;
 g.world.blocked.fill(0);
 g.world.opaque.fill(0);
 g.world.components.fill(0);
 return g;
}
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};

test('hold fire: nearby enemy building and passive enemy infantry are NEVER attacked automatically',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   red=g.spawn(1,{x:1980,y:2100},'heavy'),
   hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 Object.assign(hq,{x:1930,y:2230}); // visible inside rifle range
 red.cooldown=100;
 g.stop([red.id,blue.id],true);
 g.updateVision();
 assert.equal(g.canSee(0,hq),true);
 const hp={red:red.hp,hq:hq.hp},position={x:blue.x,y:blue.y};
 step(g,2);
 assert.equal(red.hp,hp.red,'a visible enemy walking past is not a provocation');
 assert.equal(hq.hp,hp.hq,'a nearby hostile building must not receive passive damage');
 assert.equal(g.shots.filter(s=>s.owner===0).length,0,'no autonomous shot while holding');
 assert.deepEqual({x:blue.x,y:blue.y},position,'hold never moves toward a target');
 assert.equal(blue.combatTarget,null);
});

test('hold fire: respond only to the actual damaging attacker in range; ignore other closer enemies',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   attacker=g.spawn(1,{x:2010,y:2100},'heavy'),
   decoy=g.spawn(1,{x:1940,y:2110},'tank');
 g.stop([blue.id,attacker.id,decoy.id],true);
 decoy.cooldown=100;attacker.cooldown=100;g.updateVision();
 const initialDecoy=decoy.hp,initialAttack=attacker.hp;
 step(g,.5);
 assert.equal(decoy.hp,initialDecoy);assert.equal(attacker.hp,initialAttack);
 g.strike(attacker,blue,8); // actual simulated hit, not a visibility event
 assert.equal(blue.lastAttacker,attacker.id);
 step(g,.1);
 assert.ok(attacker.hp<initialAttack,'the real attacker may receive defensive fire');
 assert.equal(decoy.hp,initialDecoy,'a closer bystander must not be selected instead');
 assert.equal(blue.hold,true);
 assert.deepEqual({x:blue.x,y:blue.y},{x:1900,y:2100},'counterfire never causes a chase');
});

test('hold fire: only a building that actually hits the unit becomes an eligible target',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   building=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 Object.assign(building,{x:1960,y:2130});
 g.stop([blue.id],true);g.updateVision();
 const full=building.hp;
 step(g,.2);
 assert.equal(building.hp,full);
 g.strike(building,blue,5);
 step(g,.1);
 assert.ok(building.hp<full,'defensive counterfire targets the real hostile source');
 assert.equal(blue.hold,true);
 assert.deepEqual({x:blue.x,y:blue.y},{x:1900,y:2100});
});

test('hold fire: a distant attacker cannot make a stationary unit chase or shoot out of range',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   attacker=g.spawn(1,{x:2300,y:2100},'artillery');
 g.stop([blue.id,attacker.id],true);g.updateVision();
 const hp=attacker.hp;
 g.strike(attacker,blue,5);
 step(g,.5);
 assert.equal(attacker.hp,hp);
 assert.equal(g.shots.filter(s=>s.owner===0).length,0);
 assert.deepEqual({x:blue.x,y:blue.y},{x:1900,y:2100});
});

test('hold fire: after the retaliatory window, a visible enemy becomes passive again',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   red=g.spawn(1,{x:1980,y:2100},'heavy');
 g.stop([blue.id,red.id],true);red.cooldown=100;g.updateVision();
 g.strike(red,blue,4);
 step(g,.4);assert.ok(red.hp<420);
 step(g,6);const after=red.hp;
 step(g,2);
 assert.equal(red.hp,after,'hold does not become a persistent attack command after defense expires');
 assert.equal(blue.combatTarget,null);
 assert.equal(blue.hold,true);
});

test('hold fire: explicit attack lifts hold and saved games keep the defensive rule',()=>{
 const g=arena(),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
   red=g.spawn(1,{x:1980,y:2100},'heavy');
 g.stop([blue.id,red.id],true);red.cooldown=100;g.updateVision();
 const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;
 const fighter=loaded.units.find(u=>u.id===blue.id),enemy=loaded.units.find(u=>u.id===red.id);
 assert.equal(fighter.hold,true);
 step(loaded,.4);
 assert.equal(enemy.hp,420,'loaded hold state must not autoattack visible opponents');
 assert.equal(loaded.command([fighter.id],{x:enemy.x,y:enemy.y,kind:'attack',target:enemy.id}),1);
 assert.equal(fighter.hold,false,'manual attack explicitly cancels hold');
 step(loaded,.4);
 assert.ok(enemy.hp<420,'a new explicit attack works normally');
});
