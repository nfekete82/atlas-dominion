import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeDefensePlan} from '../dist/src/reborn/home-defense-doctrine.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';
const ctx={fighters:8,time:85,recentLosses:0,recentFailures:0,
 lastFailureAt:-1,observedHomePressure:false,defendedTarget:false,
 confirmedEndgame:false};
test('modern AI pays for a garrison instead of sending its entire opening roster',()=>{
 const p=homeDefensePlan(ctx);
 assert.equal(p.guards,3);assert.equal(p.minimumReady,4);
 assert.equal(p.allowSecondaryRaids,false);
 assert.equal(homeDefensePlan({...ctx,fighters:2}).guards,2);
 assert.equal(homeDefensePlan({...ctx,time:30}).notBefore,65);
});
test('failed early push adds guards and a genuinely bounded rebuild window',()=>{
 const p=homeDefensePlan({...ctx,recentLosses:3,recentFailures:2,lastFailureAt:93,time:101,defendedTarget:true});
 assert.ok(p.guards>=4);assert.equal(p.minimumReady,6);
 assert.equal(p.notBefore,151);
 assert.equal(p.mode,'recover');assert.equal(p.allowSecondaryRaids,false);
 const later=homeDefensePlan({...ctx,time:220,fighters:13});
 assert.equal(later.allowSecondaryRaids,true);
});
test('visible attack reinforces the paid home defense; cleanup can commit the army',()=>{
 const threatened=homeDefensePlan({...ctx,observedHomePressure:true});
 assert.ok(threatened.guards>homeDefensePlan(ctx).guards);
 assert.equal(threatened.mode,'defense');
 assert.equal(homeDefensePlan({...ctx,confirmedEndgame:true}).guards,0);
});
test('modern campaign retains and stations a real garrison without inventing units or credits',()=>{
 const g=new Simulation(2074,19);g.aiClock=-1e8;g.time=80;g.credits=[0,0];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.tactical.mode='director';g.tactical.state.phase='gather';
 g.tactical.state.phaseAt=80;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);g.units=g.units.filter(u=>u.owner===1&&u.kind==='engineer'||u.owner===0);
 for(let i=0;i<8;i++)g.spawn(1,{x:home.x+180+i*15,y:home.y+180},i<2?'rocket':i<4?'heavy':'infantry');
 g.updateVision();
 const before=g.units.length;
 const credits=g.credits[1];
 g.tactical.plan();
 assert.equal(g.units.length,before);
 assert.equal(g.credits[1],credits);
 const defenders=g.units.filter(u=>u.owner===1&&u.kind!=='engineer'&&
  (u.hold||u.orders[0]?.tactical?.mode==='safe'&&distance(u.orders[0],home)<500));
 assert.ok(defenders.length>=3,'at least three paid soldiers protect nearby facilities');
 assert.ok(g.tactical.state.phase!=='attack'||g.tactical.state.group.length<=5,
  'no all-in early attack that removes the entire base screen');
});
