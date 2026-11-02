import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {developArmy,generatorBuildPriority} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

function setup(known){
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.aiClock=-1e8;g.time=110;g.credits=[0,4500];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);g.world.cliffIds.fill(-1);g.explored[1].fill(1);
 addProducer(g,'barracks',1);addProducer(g,'generator',1);
 for(let i=0;i<4;i++)g.spawn(1,{x:home.x+70+i*30,y:home.y+75},'infantry');
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 worker.orders=[];
 if(known)g.tactical.state.knownTurrets=[{id:9980,x:home.x+850,y:home.y+700,hp:650,range:600,seenAt:100}];
 return g;
}
test('AI: optional second generator is normally desirable with credits and a real army',()=>{
 const g=setup(false);
 assert.equal(generatorBuildPriority({existing:1,fighters:4,credits:g.credits[1],
  barracksReady:true,underAttack:false,finishing:false}),true);
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='generator'&&b.buildRemaining>0),
  'without observed enemy siege preserve economy-first behavior');
});
test('AI: observed turret moves the first vehicle factory ahead of an optional second core',()=>{
 const g=setup(true);
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='factory'&&b.buildRemaining>0),
  'factory must get built with actual credits and worker, not a virtual goal');
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,1,
  'the extra generator must not be built first');
});
test('AI: safe first core still exists when no generator has been constructed',()=>{
 const g=setup(true);
 g.bases=g.bases.filter(b=>b.kind!=='generator');
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='generator'));
});
