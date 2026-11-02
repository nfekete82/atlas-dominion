import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

function fixture(known,paidRocket,medic){
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.time=150;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const infantry=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 infantry.hp=UNITS.infantry.hp*.4;
 if(paidRocket)g.spawn(1,{x:home.x+80,y:home.y+115},'artillery');
 if(medic)g.spawn(1,{x:home.x+110,y:home.y+115},'medic');
 if(known)g.tactical.state.knownTurrets=[{id:99000,x:home.x+900,y:home.y+1100,hp:650,range:600,seenAt:145}];
 return {g,home,infantry,army:g.units.filter(u=>u.owner===1&&u.hp>0)};
}
test('siege: 40% HP infantry withdraws before death when rocket and medic support a known enemy turret',()=>{
 const {g,home,infantry,army}=fixture(true,true,true);
 const rotated=g.tactical.recovery(army,home);
 assert.ok(rotated.has(infantry.id));
 assert.ok(g.tactical.state.recovering.includes(infantry.id));
 assert.equal(infantry.orders[0]?.tactical?.mode,'safe');
 infantry.hp=UNITS.infantry.hp*.8;
 assert.equal(g.tactical.recovery(army,home).has(infantry.id),false);
});
test('siege: no fog knowledge, no rocket or no medic cannot trigger early withdrawal',()=>{
 for(const [known,gun,medic] of [[false,true,true],[true,false,true],[true,true,false]]){
  const {g,home,infantry,army}=fixture(known,gun,medic);
  assert.equal(g.tactical.recovery(army,home).has(infantry.id),false,
   JSON.stringify({known,gun,medic}));
 }
});
