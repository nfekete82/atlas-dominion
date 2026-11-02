import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectSiegeInterceptors} from '../dist/src/reborn/battle-squads.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const enemy={id:99,kind:'heavy',hp:420,x:2000,y:2000};
const unit=(id,kind,hp=UNITS[kind].hp,x=1500+id*15)=>({id,kind,hp,x,y:2000});

test('siege escort: tank and heavy intercept before riflemen, reserve still guards battery',()=>{
 const group=[unit(1,'infantry'),unit(2,'tank'),unit(3,'heavy'),unit(4,'infantry'),unit(5,'rover'),unit(6,'infantry')];
 const selected=selectSiegeInterceptors(group,enemy);
 assert.deepEqual(selected,[2,3,5]);
 assert.equal(group.length-selected.length,3);
 assert.deepEqual(selectSiegeInterceptors(group.slice().reverse(),enemy),selected,'stable under roster reordering');
});
test('siege escort: preserve injured soldiers, no unsafe diversion of support or air',()=>{
 const group=[unit(1,'infantry',35),unit(2,'heavy',420),unit(3,'tank',600),unit(4,'infantry',100),
  unit(5,'artillery'),unit(6,'medic')];
 assert.deepEqual(selectSiegeInterceptors(group,enemy),[3,2]);
 assert.ok(!selectSiegeInterceptors(group,enemy).includes(1));
 assert.deepEqual(selectSiegeInterceptors([unit(1,'infantry',33),unit(2,'infantry',65)],enemy),[2]);
 assert.deepEqual(selectSiegeInterceptors([unit(1,'artillery'),unit(2,'medic')],enemy),[]);
 assert.deepEqual(selectSiegeInterceptors([unit(3,'tank')],enemy),[3]);
});
test('siege escort: selector consumes target and friendly roster only; explicit reaction needs visibility',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.world.cliffIds.fill(-1);
 const rocket=g.spawn(1,{x:hq.x+600,y:hq.y+350},'artillery');
 const soldiers=['infantry','heavy','tank','rover','infantry','infantry'].map((k,i)=>
  g.spawn(1,{x:rocket.x+140+i*16,y:rocket.y+50},k));
 const threat=g.spawn(0,{x:rocket.x+310,y:rocket.y+45},'heavy');
 g.updateVision();assert.ok(g.canSee(1,threat));
 const members=[rocket,...soldiers];
 const defensive=g.tactical.screenThreats(members,rocket);
 assert.ok(defensive.size>=1&&defensive.size<=3);
 assert.ok(!defensive.has(rocket.id));
 assert.ok(defensive.size<soldiers.length);
 for(const u of soldiers.filter(u=>defensive.has(u.id)))assert.equal(u.orders[0]?.target,threat.id);
 assert.equal(g.tactical.diagnostics.siegeScreenRetained,soldiers.length-defensive.size);
 g.units=g.units.filter(u=>u.id!==threat.id);
 g.updateVision();
 assert.equal(g.tactical.screenThreats(members,rocket).size,0,'no invented contact outside vision');
});
