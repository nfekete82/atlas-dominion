import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {holdForSiegeWeapon} from '../dist/src/reborn/tactical-ai.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

function siegeEconomy(credits){
 const g=new Simulation(2028,3);
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.world.cliffIds.fill(-1);
 g.explored[1].fill(1);
 g.time=220;g.aiClock=-1e8;g.credits[1]=credits;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 for(const [i,kind] of ['barracks','factory'].entries()){
  const spec=BUILDINGS[kind];
  g.bases.push({...home,id:1900+i,kind,hp:spec.hp,radius:spec.radius,
   x:home.x+320+i*300,y:home.y+280,territory:home.territory,
   queue:[],queueTypes:[],queueCosts:[],buildRemaining:0,production:0});
 }
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x+i*24,y:home.y-210},'heavy');
 const turret={id:2100,x:home.x-560,y:home.y,hp:600,range:600,seenAt:205};
 const s=g.tactical.state;
 s.knownTurrets=[turret];
 s.commander={...newCampaign(),observedEnemyHQ:{id:1000,x:home.x-650,y:home.y},
  enemyHQEliminatedAt:180};
 return {g,s,home,barracks:g.bases.find(b=>b.id===1900),factory:g.bases.find(b=>b.id===1901)};
}

test('4.2: with a known gun, paid artillery precedes cleanup infantry purchases',()=>{
 const {g,s,barracks,factory}=siegeEconomy(800);
 developArmy(g,s,g.units.filter(u=>u.owner===1),()=>0);
 assert.deepEqual(factory.queueTypes,['artillery'],'one paid siege weapon must be queued first');
 assert.ok(g.credits[1]<=800-UNITS.artillery.cost,
  'once artillery is funded, the barracks may buy a small paid escort');
});

test('4.2: scarce credits are reserved for artillery, not endlessly spent on infantry',()=>{
 const {g,s,barracks,factory}=siegeEconomy(400);
 developArmy(g,s,g.units.filter(u=>u.owner===1),()=>0);
 assert.deepEqual(factory.queueTypes,[]);
 assert.deepEqual(barracks.queueTypes,[]);
 assert.equal(g.credits[1],400);
 assert.equal(s.economy.production.reason,'saving-unit');
 assert.equal(s.economy.production.goal,'artillery');
});

test('4.2: queued artillery is counted, so the next affordable purchase may be an escort',()=>{
 const {g,s,barracks,factory}=siegeEconomy(1800);
 developArmy(g,s,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(factory.queueTypes.filter(k=>k==='artillery').length,1);
 assert.ok(barracks.queueTypes.length<=1,'do not queue an unbounded wave');
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,0,
  'avoid nonessential fortification in a confirmed endgame');
});

test('4.2: if a known turret survives but the siege factory is destroyed, rebuilding is allowed',()=>{
 const {g,s,home}=siegeEconomy(1600);
 g.bases=g.bases.filter(b=>b.kind!=='factory');
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 worker.orders=[];
 developArmy(g,s,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(s.economy.built.factory,1);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='factory').length,1);
});

test('4.2: an observed turret requires artillery even with 7 or more ordinary fighters',()=>{
 for(const size of [3,7,9,16])assert.equal(
  holdForSiegeWeapon('turret',false,0),true,'unsupported attack is not safe at '+size+' fighters');
 assert.equal(holdForSiegeWeapon('turret',false,1),false,'artillery makes a supported siege possible');
 assert.equal(holdForSiegeWeapon('turret',true,0),false,'genuine overmatch is still a permitted alternative');
 assert.equal(holdForSiegeWeapon('barracks',false,0),false,'non-turret objectives are unaffected');
 assert.equal(holdForSiegeWeapon(undefined,false,0),false,'no imaginary fogged turret');
});
