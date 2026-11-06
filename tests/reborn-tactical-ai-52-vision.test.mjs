import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseEndgameVisionPost} from '../dist/src/reborn/tactical-ai.js';
import {keepCleanupTowerObjective} from '../dist/src/reborn/campaign-commander.js';

const base=()=>({
 origin:{x:100,y:900},target:{id:1004,x:1000,y:900},
 known:[{id:1004,x:1000,y:900,range:600}],unitRange:680,unitSight:830,size:3600,
 walkable:()=>true,clearLine:()=>true,
 route:p=>({length:Math.hypot(p.x-100,p.y-900),safe:true})
});
test('5.2: selects a route-checked, turret-safe line-of-sight standoff post from observed data',()=>{
 const x=base(),p=chooseEndgameVisionPost(x);
 assert.ok(p,'a clear route exists around a known turret');
 const r=Math.hypot(p.x-x.target.x,p.y-x.target.y);
 assert.ok(r>632&&r<680,'watch point stays beyond real gun range but inside artillery range');
 assert.ok(x.route(p).safe);
});
test('5.2: rejects absent artillery sight advantage or obstructed or risky approaches',()=>{
 const x=base();
 assert.equal(chooseEndgameVisionPost({...x,unitSight:610}),undefined);
 assert.equal(chooseEndgameVisionPost({...x,unitRange:630}),undefined);
 assert.equal(chooseEndgameVisionPost({...x,walkable:()=>false}),undefined);
 assert.equal(chooseEndgameVisionPost({...x,clearLine:()=>false}),undefined);
 assert.equal(chooseEndgameVisionPost({...x,route:()=>({length:900,safe:false})}),undefined);
 assert.equal(chooseEndgameVisionPost({...x,route:()=>undefined}),undefined);
});
test('5.2: an additional observed battery denies unsafe firing posts',()=>{
 const x=base();
 assert.equal(chooseEndgameVisionPost({...x,
  known:[...x.known,{id:999,x:1000,y:900,range:900}]}),undefined);
});
test('5.2: temporarily fogged, previously observed turret gets bounded objective stability',()=>{
 const base={confirmedEndgame:true,knownTurret:true,hasArtillery:true,missionSeconds:75,
  recentNearbyLosses:0,recentIntel:true};
 assert.equal(keepCleanupTowerObjective(base),true);
 assert.equal(keepCleanupTowerObjective({...base,missionSeconds:91}),false);
 assert.equal(keepCleanupTowerObjective({...base,recentIntel:false}),false);
 assert.equal(keepCleanupTowerObjective({...base,recentNearbyLosses:2}),false);
});
