import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {concentrateFront,allowDetachedRaid,strategicReserve,frontReinforcementDistance,frontStrengthRequired} from '../dist/src/reborn/strategic-front.js';

test('front: experiment applies only to four-bastion map',()=>{
 assert.equal(concentrateFront(11,'concentrated'),true);
 for(const map of [3,4,12,13,14])assert.equal(concentrateFront(map,'concentrated'),false);
 assert.equal(concentrateFront(11,'classic'),false);
});
test('front: prevent premature two-unit raids with fewer than nine real fighters',()=>{
 assert.equal(allowDetachedRaid({small:true,available:6,front:4,observedThreat:0}),false);
 assert.equal(allowDetachedRaid({small:true,available:10,front:8,observedThreat:0}),true);
 assert.equal(allowDetachedRaid({small:true,available:10,front:8,observedThreat:2}),false);
 assert.equal(allowDetachedRaid({small:false,available:3,front:1,observedThreat:2}),true);
});
test('front: preserve urgent HQ defense and stage reinforcements closer',()=>{
 assert.equal(strategicReserve({small:true,count:5,enemyNearHome:false}),0);
 assert.equal(strategicReserve({small:true,count:9,enemyNearHome:false}),1);
 assert.equal(strategicReserve({small:true,count:9,enemyNearHome:true}),3);
 assert.equal(frontReinforcementDistance(true),210);
 assert.equal(frontReinforcementDistance(false),280);
});
test('front: a defended sector requires the paid force to assemble',()=>{
 const x={small:true,defended:true,readyCount:1,selectedCount:6,hasArmor:false,observedThreat:2};
 assert.equal(frontStrengthRequired(x),false);
 assert.equal(frontStrengthRequired({...x,readyCount:5}),true);
 assert.equal(frontStrengthRequired({...x,readyCount:3,hasArmor:true}),false);
 assert.equal(frontStrengthRequired({...x,readyCount:4,hasArmor:true}),false);
 assert.equal(frontStrengthRequired({...x,small:false}),true);
 assert.equal(frontStrengthRequired({...x,defended:false,readyCount:2}),true);
});
test('front: same map, income, army, fog, buildings and starts in A/B comparison',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 b.tactical.frontPolicy='concentrated';
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.visible,b.visible);
 assert.deepEqual(a.explored,b.explored);
 assert.equal(a.tactical.frontPolicy,'classic');
 const saved=b.save();
 assert.equal(saved.ai?.frontPolicy,undefined);
 assert.equal(Simulation.load(saved).tactical.frontPolicy,'classic');
});
