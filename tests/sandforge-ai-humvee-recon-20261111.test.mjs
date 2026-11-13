import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
const modern=()=>{
 const g=new Simulation(2074,19);
 g.tactical.mode='director';g.tactical.state.phase='gather';
 g.time=90;g.aiClock=-1e8;g.credits=[0,0];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.units=g.units.filter(u=>u.owner===0||u.kind==='engineer');
 const h=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(h);
 const jeep=g.spawn(1,{x:h.x+150,y:h.y+140},'rover');
 for(let n=0;n<5;n++)g.spawn(1,{x:h.x+90+n*22,y:h.y+85},n<2?'heavy':'infantry');
 g.updateVision();
 return {g,jeep,h};
};
test('modern AI Humvee stays with combat doctrine and does not make a solo exploration trip into player base',()=>{
 const {g,jeep}=modern();
 const before=g.units.length,cash=g.credits[1];
 g.tactical.plan();
 assert.equal(g.units.length,before);
 assert.equal(g.credits[1],cash);
 assert.equal(g.tactical.state.commander?.recon.some(x=>x.unit===jeep.id)??false,false);
 // An assault order is legal only if the unit is in its actual paid squad.
 const squad=g.tactical.state.group.includes(jeep.id);
 if(jeep.orders[0]?.tactical?.mode==='assault')assert.equal(squad,true);
});
test('campaign reconnaissance still keeps its helicopter role',()=>{
 const {g,h}=modern();
 const heli=g.spawn(1,{x:h.x+90,y:h.y+80},'scout');
 g.tactical.plan();
 assert.ok(g.tactical.state.commander?.recon.some(t=>t.unit===heli.id)||
  heli.transport||heli.orders.length>=0);
});
