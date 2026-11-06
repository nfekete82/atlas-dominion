import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flankRouteScore,isContinuingFlank} from '../dist/src/reborn/battle-squads.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('2.3: equal-length flanks prefer the side away from real visible heavy infantry',()=>{
 const origin={x:100,y:500};
 const upper=[{x:300,y:340},{x:500,y:500}];
 const lower=[{x:300,y:660},{x:500,y:500}];
 const observed=[{id:7,kind:'heavy',hp:420,x:310,y:345}];
 const safe=flankRouteScore(origin,lower,observed);
 const dangerous=flankRouteScore(origin,upper,observed);
 assert.ok(safe<dangerous,'avoid an observed heavy covering the upper approach');
 assert.equal(flankRouteScore(origin,upper,[]),flankRouteScore(origin,lower,[]),
  'with no visible enemies both equally long routes must tie');
 assert.equal(flankRouteScore(origin,upper,[{...observed[0],hp:0}]),
  flankRouteScore(origin,upper,[]),'destroyed enemies cannot constrain routes');
 assert.equal(flankRouteScore(origin,[],observed),Infinity,'unreachable flanks remain disallowed');
});
test('2.3: flank approach uses two accepted attack-move orders, never a helpless safe move',()=>{
 const g=new Simulation(2026,4);
 g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);g.aiClock=-1e8;
 const red=g.spawn(1,{x:1400,y:1450},'infantry');
 const blue=g.spawn(0,{x:1505,y:1450},'infantry');blue.cooldown=100;
 g.updateVision();
 g.tactical.state.groupId=17;
 const leg=g.tactical.issue([red],{x:1660,y:1450},'assault',undefined,false,false);
 const follow=g.tactical.issue([red],{x:1840,y:1450},'assault',undefined,true,false);
 assert.ok(leg&&follow,'both routed orders must be accepted by the game');
 assert.equal(red.orders.length,2);
 assert.deepEqual(red.orders.map(o=>o.kind),['attackMove','attackMove']);
 assert.ok(red.orders.every(o=>o.tactical?.group===17&&o.tactical.mode==='assault'));
 assert.equal(isContinuingFlank(red.orders,17),true);
 assert.equal(isContinuingFlank(red.orders,18),false,'old unit groups cannot inherit a new flank');
 red.defendUntil=g.time+5;
 assert.equal(isContinuingFlank(red.orders,17),true,'taking a hit must not erase a two-leg flank');
 red.defendUntil=0;
 const before=blue.hp;
 for(let i=0;i<45;i++)g.step(.05);
 assert.ok(blue.hp<before,'flanker should return fire during its first leg, unlike old safe move');
});
test('2.3: danger scoring is deterministic, reads only observed threats and leaves saves unchanged',()=>{
 const g=new Simulation(2026,4),snapshot=g.save();
 const enemy={id:99,kind:'infantry',hp:100,x:550,y:330};
 const o={x:300,y:300},route=[{x:500,y:350},{x:700,y:400}];
 const a=flankRouteScore(o,route,[enemy]);
 assert.equal(a,flankRouteScore(o,structuredClone(route),[structuredClone(enemy)]));
 assert.deepEqual(g.save(),snapshot);
});
