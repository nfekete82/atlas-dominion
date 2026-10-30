import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {infantryRecoveryThreshold,cleanupReserveSize} from '../dist/src/reborn/tactical-ai.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('4.3: recovery threshold only changes for confirmed endgame with a living medic',()=>{
 assert.equal(infantryRecoveryThreshold(false,true),.3);
 assert.equal(infantryRecoveryThreshold(true,false),.3);
 assert.equal(infantryRecoveryThreshold(true,true),.48);
 assert.equal(cleanupReserveSize(false,6),0);
 assert.equal(cleanupReserveSize(false,7),1);
 assert.equal(cleanupReserveSize(true,8),0);
 assert.equal(cleanupReserveSize(true,9),1);
});

function wounded(endgame,withMedic){
 const g=new Simulation(2028,3);
 g.time=180;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const u=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 assert.ok(u);assert.ok(home);
 u.hp=UNITS.infantry.hp*.4;
 if(withMedic)g.spawn(1,{x:home.x+180,y:home.y+180},'medic');
 if(endgame){
  g.tactical.state.commander={...newCampaign(),observedEnemyHQ:{id:1000,x:home.x-400,y:home.y},enemyHQEliminatedAt:150};
 }
 const army=g.units.filter(u=>u.owner===1);
 return {g,home,u,army};
}
test('4.3: rotate 40%-HP infantry to safe recovery if and only if a medic can treat it',()=>{
 const a=wounded(true,true);
 const protectedIds=a.g.tactical.recovery(a.army,a.home);
 assert.equal(protectedIds.has(a.u.id),true);
 assert.equal(a.g.tactical.state.recovering.includes(a.u.id),true);
 assert.equal(a.u.orders[0].tactical.mode,'safe');
 const b=wounded(true,false);
 assert.equal(b.g.tactical.recovery(b.army,b.home).has(b.u.id),false);
 const c=wounded(false,true);
 assert.equal(c.g.tactical.recovery(c.army,c.home).has(c.u.id),false);
});
test('4.3: recuperating infantry remain withheld until actually healed to 80%',()=>{
 const {g,home,u,army}=wounded(true,true);
 g.tactical.recovery(army,home);
 u.hp=UNITS.infantry.hp*.75;
 assert.equal(g.tactical.recovery(army,home).has(u.id),true);
 u.hp=UNITS.infantry.hp*.8;
 assert.equal(g.tactical.recovery(army,home).has(u.id),false);
});
