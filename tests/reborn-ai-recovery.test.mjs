import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {addProducer} from './fixtures/reborn-production.mjs';

test('director recovers organically after a destroyed opening squad while a jeep survives',()=>{
 const game=new Simulation(2026,4);
 const hq=game.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const barracks=addProducer(game,'barracks',1);
 const factory=addProducer(game,'factory',1);
 // Create the exact economically unfavorable post-attack state. Do not
 // fabricate credits or inject units during simulation; subsequent purchases
 // must be financed by the game economy and the usual production queues.
 game.units=game.units.filter(u=>u.owner===0||u.kind==='engineer');
 game.spawn(1,{x:hq.x+95,y:hq.y+80},'rover');
 game.credits[1]=0;
 game.time=85;
 game.aiClock=RULES.aiInterval;
 const income=game.income(1);
 assert.ok(income>0,'the HQ and owned sector must actually earn money');
 assert.equal(game.units.filter(u=>u.owner===1&&u.kind==='infantry').length,0);
 let lastAlive=0,everRecruited=0,everAttacked=false;
 for(let i=0;i<3600&&game.status==='playing';i++){
  game.step(RULES.tick);
  if(i%20===0){
   lastAlive=game.units.filter(u=>u.owner===1&&u.kind==='infantry'&&u.hp>0).length;
   everRecruited=game.tactical.state.economy?.produced.infantry??0;
   everAttacked ||=game.units.some(u=>u.owner===1&&u.kind==='infantry'&&u.orders.some(o=>o.tactical?.mode==='assault'));
   if(everRecruited>=3&&everAttacked)break;
  }
 }
 assert.ok(everRecruited>=3,
  'real periodic income buys at least three replacement infantry after the initial army is gone');
 assert.ok(everAttacked,
  'new infantry receive a real assault order rather than remaining permanently passive');
 assert.ok(game.credits[1]>=0,'no negative credits or free army');
 assert.ok(barracks.queue.length<=8&&factory.queue.length<=8,'normal bounded queues still apply');
 const save=game.save();
 const restored=Simulation.load(save);
 assert.deepEqual(restored.tactical.state.economy?.produced,game.tactical.state.economy?.produced,
  'paid recovery survives a saved game');
});
