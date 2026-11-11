import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,weaponDamage} from '../dist/src/reborn/catalog.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {rocketInfantryQuota,bomberAntiArmorQuota,
 selectObservedCounterTarget} from '../dist/src/reborn/ai-counter-doctrine.js';
import {addProducer,seedCompletedGenerators} from './fixtures/reborn-production.mjs';

function established(seed=2074){
 const g=new Simulation(seed,4);
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.time=135;g.credits[1]=3600;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 const airfield=addProducer(g,'airfield',1);
 seedCompletedGenerators(g);
 for(const t of g.territories)t.owner=1;
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x+240+i*18,y:home.y+190},'infantry');
 for(let i=0;i<2;i++)g.spawn(1,{x:home.x+320+i*35,y:home.y+170},'tank');
 return {g,home,barracks,factory,airfield};
}
const pulse=g=>developArmy(g,g.tactical.state,
 g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),()=>0);
const observe=(g,enemies)=>{
 g.visible[1].fill(0);
 for(const e of enemies)g.visible[1][g.world.index(e)]=1;
};

test('AI buys 1 baseline rocket specialist, adds anti-armor and anti-air as observed (queued counts)',()=>{
 assert.equal(rocketInfantryQuota({fighters:5,time:100,vehicles:0,air:0,
  barracksReady:true,underAttack:false}),1);
 assert.equal(rocketInfantryQuota({fighters:5,time:100,vehicles:1,air:0,
  barracksReady:true,underAttack:false}),2);
 assert.equal(rocketInfantryQuota({fighters:5,time:100,vehicles:3,air:0,
  barracksReady:true,underAttack:false}),3);
 assert.equal(rocketInfantryQuota({fighters:5,time:100,vehicles:0,air:2,
  barracksReady:true,underAttack:false}),3);
 assert.equal(rocketInfantryQuota({fighters:5,time:100,vehicles:0,air:8,
  barracksReady:true,underAttack:false}),4);
 assert.equal(rocketInfantryQuota({fighters:8,time:180,vehicles:0,air:0,
  barracksReady:false,underAttack:false}),0);
 const x=established(),h=x.home;
 const armor=x.g.spawn(0,{x:h.x+920,y:h.y+480},'tank');
 observe(x.g,[armor]);
 const credits=x.g.credits[1];
 pulse(x.g);
 assert.ok(x.barracks.queueTypes.includes('rocket'),
  'working barracks must buy an actual counter instead of endless rifles');
 assert.equal(x.barracks.queueCosts[0],UNITS.rocket.cost);
 assert.ok(credits-x.g.credits[1]>=UNITS.rocket.cost,
  'real credits are spent, no conjured AA');
 assert.ok(x.g.tactical.state.economy.produced.rocket>=1);
});

test('AI builds guided AA missiles against observed air even with no factory available',()=>{
 const x=established(2077),h=x.home;
 x.g.bases=x.g.bases.filter(b=>b.id!==x.factory.id&&b.id!==x.airfield.id);
 const bomber=x.g.spawn(0,{x:h.x+900,y:h.y+450},'bomber');
 observe(x.g,[bomber]);
 pulse(x.g);
 assert.ok(x.barracks.queueTypes.includes('rocket'),
  'air defense comes from existing barracks, not a factory prerequisite');
});

test('AI funds bombers to destroy observed tanks, without requiring a transport helicopter',()=>{
 const x=established(2080),h=x.home;
 // Already paid missile infantry satisfy counter quota: next expensive
 // anti-armor response is the airfield bomber, not more cheap transports.
 for(let i=0;i<3;i++)x.g.spawn(1,{x:h.x+220+i*20,y:h.y+300},'rocket');
 // Red HQ can be at either map corner depending on seed. Place the
 // observed tank column TOWARD map center, never outside the playable map.
 const sx=h.x<x.g.world.size/2?1:-1,sy=h.y<x.g.world.size/2?1:-1;
 const enemy=[0,1,2].map(i=>x.g.spawn(0,{
  x:h.x+sx*(900+i*44),y:h.y+sy*(450+i*10)},i===2?'artillery':'tank'));
 observe(x.g,enemy);
 assert.ok(enemy.every(v=>x.g.canSee(1,v)),
  'real counter-production requires live, valid, in-map enemy sightings');
 assert.ok(x.g.income(1)>=45);
 const quota=bomberAntiArmorQuota({airfieldReady:true,income:x.g.income(1),
  fighters:10,groundVehicles:2,enemyArmor:3,enemyAir:0,
  underAttack:false,finishing:false});
 assert.equal(quota,2);
 pulse(x.g);
 assert.ok(x.airfield.queueTypes.includes('bomber'),
  'airfield must build bomber for tank strike without scout prerequisite: '+
  JSON.stringify({queues:[x.barracks,x.factory,x.airfield].map(b=>[b.kind,b.queueTypes]),
   income:x.g.income(1),credits:x.g.credits[1],observed:enemy.map(v=>x.g.canSee(1,v)),
   economy:x.g.tactical.state.economy,finishing:x.g.tactical.state.commander?.enemyHQEliminatedAt}));
 assert.equal(x.airfield.queueCosts[0],UNITS.bomber.cost);
});

test('AA and bomber anti-armor orders only choose physically observed targets',()=>{
 const source={x:1400,y:1400};
 const tank={id:1,kind:'tank',hp:1000,x:1600,y:1400};
 const artillery={id:2,kind:'artillery',hp:300,x:1580,y:1450};
 const bomber={id:3,kind:'bomber',hp:700,x:1640,y:1400};
 const infantry={id:4,kind:'infantry',hp:100,x:1420,y:1400};
 assert.equal(selectObservedCounterTarget('rocket',source,
  [infantry,tank,artillery,bomber],800).id,bomber.id);
 assert.equal(selectObservedCounterTarget('bomber',source,
  [bomber,infantry,artillery,tank],800).id,tank.id);
 assert.equal(selectObservedCounterTarget('bomber',source,[infantry,bomber],800),undefined);
 assert.equal(selectObservedCounterTarget('rocket',source,[],800),undefined);
 assert.ok(weaponDamage({kind:'rocket'},{kind:'bomber'})>
  weaponDamage({kind:'rocket'},{kind:'infantry'}));
});

test('REAL red tactical rockets defend from visible enemy bomber instead of shooting nearest rifleman',()=>{
 const g=new Simulation(2090,4);g.aiClock=1e9;g.tactical.plan=()=>{};
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 const rocket=g.spawn(1,{x:1450,y:1450},'rocket');
 const rifle=g.spawn(0,{x:1470,y:1450},'infantry');
 const aircraft=g.spawn(0,{x:1610,y:1460},'bomber');
 observe(g,[rifle,aircraft]);
 const targets=[rifle,aircraft].filter(u=>g.canSee(1,u));
 g.tactical.counterMissileScreen([rocket],targets,{x:1650,y:1500});
 assert.equal(rocket.orders[0]?.kind,'attack');
 assert.equal(rocket.orders[0]?.target,aircraft.id);
 const oldHP=aircraft.hp;
 for(let i=0;i<180;i++)g.step(.05);
 assert.ok(aircraft.hp<oldHP||g.missiles.some(m=>m.source===rocket.id),
  'rocket actively fires a REAL guided projectile at hostile aircraft');
});

test('REAL red air commander orders a bomber to flank and bomb an OBSERVED enemy tank',()=>{
 const g=new Simulation(2095,4);g.aiClock=1e9;g.tactical.plan=()=>{};
 const aircraft=g.spawn(1,{x:1400,y:1400},'bomber');
 const tank=g.spawn(0,{x:1700,y:1420},'tank');
 const hidden=g.spawn(0,{x:1700,y:1890},'tank');
 observe(g,[tank]);
 assert.equal(g.canSee(1,tank),true);
 assert.equal(g.canSee(1,hidden),false);
 g.tactical.airSupport([aircraft],{x:1710,y:1450},null);
 assert.equal(aircraft.orders.length,2);
 assert.equal(aircraft.orders[0].kind,'move','real wide approach before bombing');
 assert.equal(aircraft.orders[1].kind,'attack');
 assert.equal(aircraft.orders[1].target,tank.id);
 assert.notEqual(aircraft.orders[1].target,hidden.id,'no wallhacks');
});
