import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {produceCombinedArmy,earlyArtilleryWindow} from '../dist/src/reborn/director-production.js';
import {deferOptionalAirfieldForSiege} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

const valid={factoryReady:true,artillery:0,rovers:1,tanks:0,fighters:5,income:80,
 underAttack:false,visibleEnemyAir:false,time:74};
test('4.9: first paid rocket is reserved after rover with sound economy, not from hidden turret intelligence',()=>{
 assert.equal(earlyArtilleryWindow(valid),true);
 for(const change of [{factoryReady:false},{artillery:1},{rovers:0},{tanks:1},
  {fighters:4},{income:55},{underAttack:true},{visibleEnemyAir:true},{time:220}])
  assert.equal(earlyArtilleryWindow({...valid,...change}),false,JSON.stringify(change));
});
test('4.9: optional airfield only defers for an observed siege and a factory without artillery',()=>{
 assert.equal(deferOptionalAirfieldForSiege('airfield',true,true,0,false),true);
 for(const args of [
  ['factory',true,true,0,false],['airfield',false,true,0,false],
  ['airfield',true,false,0,false],['airfield',true,true,1,false],
  ['airfield',true,true,0,true]
 ])assert.equal(deferOptionalAirfieldForSiege(...args),false,JSON.stringify(args));
});
function fixture(){
 const g=new Simulation(2026,4);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const factory=addProducer(g,'factory',1);
 g.spawn(1,{x:home.x-80,y:home.y+105},'engineer');
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x-100-i*10,y:home.y+125},'infantry');
 g.spawn(1,{x:home.x-140,y:home.y+190},'rover');
 g.time=75;
 g.credits[1]=650;
 g.tactical.state.economy={goal:null,since:0,attemptAt:-9,produced:{},built:{}};
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 const scores=Object.fromEntries(Object.keys(UNITS).map(k=>[k,k==='artillery'?50:20]));
 const ctx={own:g.bases.filter(b=>b.owner===1&&b.hp>0),army,seen:[],income:80,underAttack:false,
  knownTurrets:0,knownEnemyHQ:false,reserve:0,maxArmy:36,scores,defenseNeedsWorker:false,finishing:false};
 return {g,factory,ctx};
}
test('4.9: intact production queue buys exactly one real rocket before a second tank',()=>{
 const {g,factory,ctx}=fixture();
 produceCombinedArmy(g,g.tactical.state,ctx);
 assert.ok(factory.queueTypes.includes('artillery'),'first vehicle reserve buys real artillery');
 assert.equal(g.credits[1],50);
 assert.equal(g.tactical.state.economy.produced.artillery,1);
 produceCombinedArmy(g,g.tactical.state,ctx);
 assert.equal(factory.queueTypes.filter(k=>k==='artillery').length,1,'already paid queue suppresses duplicate');
});
test('4.9: under attack, do not force an early rocket and preserve defensive economy',()=>{
 const {g,factory,ctx}=fixture();
 ctx.underAttack=true;
 produceCombinedArmy(g,g.tactical.state,ctx);
 assert.equal(factory.queueTypes.includes('artillery'),false);
});
