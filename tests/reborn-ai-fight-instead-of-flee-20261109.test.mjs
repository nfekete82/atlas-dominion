import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

function battle(){
 const g=new Simulation(2074,11);
 g.time=120;g.aiClock=-1000;g.units=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home,'red headquarters fixture required');
 const tank=g.spawn(1,{x:home.x+240,y:home.y+190},'tank');
 const engineer=g.spawn(1,{x:home.x+30,y:home.y+65},'engineer');
 const enemy=g.spawn(0,{x:tank.x+180,y:tank.y},'heavy');
 tank.orders=[{kind:'attackMove',x:enemy.x,y:enemy.y}];
 return {g,tank,engineer,enemy,home};
}
test('the red 58%-HP tank holds a winnable firefight instead of suicide-retreating',()=>{
 const {g,tank,engineer,enemy,home}=battle();
 tank.hp=UNITS.tank.hp*.58;
 tank.defendUntil=g.time+4;
 g.updateVision();
 const oldOrder=tank.orders[0];
 g.tactical.evacuateVehicle(tank);
 assert.equal(tank.orders[0],oldOrder,'immediate extraction must not cancel a working attack');
 assert.ok(!(g.tactical.state.recovering??[]).includes(tank.id));
 const withheld=g.tactical.recovery([tank,engineer],home);
 assert.equal(withheld.has(tank.id),false,'routine repair may not steal a live combat tank');
 assert.equal(tank.orders[0],oldOrder);
 assert.ok(enemy.hp>0);
});

test('an older stored recovery order is released when the paid tank returns to combat',()=>{
 const {g,tank,engineer,home}=battle();
 tank.hp=UNITS.tank.hp*.41;
 tank.defendUntil=g.time+3;
 g.tactical.state.recovering=[tank.id];
 const reserved=g.tactical.recovery([tank,engineer],home);
 assert.equal(reserved.has(tank.id),false,'stale 67%-HP extraction is cancelled');
 assert.ok(!(g.tactical.state.recovering??[]).includes(tank.id));
});

test('a genuinely critical tank may still be evacuated for repairs',()=>{
 const {g,tank,engineer,home}=battle();
 tank.hp=UNITS.tank.hp*.19;
 tank.defendUntil=g.time+3;
 g.tactical.evacuateVehicle(tank);
 assert.ok((g.tactical.state.recovering??[]).includes(tank.id));
 assert.equal(tank.orders[0]?.tactical?.mode,'safe');
});

test('a damaged but safe idle tank can rotate out for a real engineer',()=>{
 const {g,tank,engineer,home}=battle();
 tank.hp=UNITS.tank.hp*.43;
 tank.defendUntil=g.time-1;
 const reserved=g.tactical.recovery([tank,engineer],home);
 assert.equal(reserved.has(tank.id),true);
 assert.ok(tank.orders[0]?.tactical?.mode==='safe'||!tank.orders.length);
});
