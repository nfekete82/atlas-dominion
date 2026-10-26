import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveOpponent,TITAN_PROFILES} from '../scripts/adaptive-opponents.mjs';
import {parseTitanOptions} from '../scripts/benchmark-titan.mjs';
import {productionIdleReason} from '../scripts/benchmark-reborn-ai.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';

test('Titan CLI fixes paired director inputs and rejects ambiguous samples',()=>{
 const o=parseTitanOptions(['--before','/tmp/reference.js','--profiles','infantry,armor','--maps','3,4,5','--seeds','2026','--only','before']);
 assert.deepEqual(o.profiles,['infantry','armor']);assert.equal(o.only,'before');assert.equal(TITAN_PROFILES.length,9);
 for(const args of [[],['--before','x','--profiles','cheat'],['--before','x','--maps','4,4'],['--before','x','--seeds','-1'],['--before','x','--only','candidate'],['--before','x','--seconds','NaN']])assert.throws(()=>parseTitanOptions(args));
});

test('all independent opponents ignore hidden enemy unit fields and hidden buildings',()=>{
 for(const profile of TITAN_PROFILES.filter(p=>!p.startsWith('tower'))){
  const g=new Simulation(2026,4),hiddenUnit=new Proxy({owner:1},{get(t,k){if(k==='owner')return 1;throw Error('hidden unit read '+String(k));}}),hiddenBase=new Proxy({owner:1},{get(t,k){if(k==='owner')return 1;throw Error('hidden building read '+String(k));}});
  const hiddenUnits=g.units.filter(u=>u.owner===1),hiddenBases=g.bases.filter(b=>b.owner===1);
  g.units=[...g.units.filter(u=>u.owner===0),hiddenUnit];g.bases=[...g.bases.filter(b=>b.owner===0),hiddenBase];
  const see=g.canSee.bind(g);g.canSee=(owner,p)=>p===hiddenUnit?false:see(owner,p);
  // Build/recruit remain real APIs but their own engine internals may inspect
  // the full world; isolate only actor reads for this observation boundary test.
  g.build=()=>null;g.buildError=()=> 'blocked';g.recruit=()=>false;g.command=()=>{};
  assert.doesNotThrow(()=>adaptiveOpponent(profile,{}, {UNITS,BUILDINGS})(g));
  assert.ok(hiddenUnits.length&&hiddenBases.length);
 }
});

test('independent strategies use real debited APIs and complete their paid opening',()=>{
 for(const profile of ['infantry','armor','expansion','fortress','attrition']){
  const g=new Simulation(2026,4);g.aiClock=-1e8;
  let charged=0;const build=g.build.bind(g),recruit=g.recruit.bind(g);
  g.build=(owner,kind,...args)=>{const before=g.credits[owner],result=build(owner,kind,...args);if(result){assert.equal(before-g.credits[owner],BUILDINGS[kind].cost);charged+=BUILDINGS[kind].cost;}return result;};
  g.recruit=(id,kind)=>{const b=g.bases.find(b=>b.id===id),before=g.credits[b.owner],result=recruit(id,kind);if(result){assert.equal(before-g.credits[b.owner],UNITS[kind].cost);charged+=UNITS[kind].cost;}return result;};
  const metrics={},actor=adaptiveOpponent(profile,metrics,{UNITS,BUILDINGS});
  for(let i=0;i<600;i++){if(i%30===0)actor(g);g.step(.1);assert.ok(g.credits[0]>=0);}
  assert.ok(metrics.paidBuildings.barracks>=1,profile);assert.ok(metrics.paidRecruitOrders.infantry>=1,profile);
  assert.equal(charged,metrics.paidBuildCredits+metrics.paidRecruitCredits,profile);
  assert.ok(g.bases.some(b=>b.owner===0&&b.kind==='barracks'&&b.buildRemaining===0));
 }
});

test('idle accounting prefers actual per-facility reasons and marks baseline inference',()=>{
 const g={credits:[950,0],tactical:{state:{economy:{production:{facilities:{7:{reason:'saving-unit'}}}}}},count:()=>1,queued:()=>0};
 const b={id:7,kind:'factory',queue:[]};
 assert.deepEqual(productionIdleReason(g,b,UNITS),{reason:'saving-unit',source:'controller'});
 delete g.tactical.state.economy.production;
 assert.deepEqual(productionIdleReason(g,b,UNITS),{reason:'insufficient-credits',source:'inferred'});
 b.queue=[1,2];assert.deepEqual(productionIdleReason(g,b,UNITS),{reason:'queue-blocked',source:'inferred'});
});

test('combined actor finances an actual airframe from normal initial credits and income',()=>{const g=new Simulation(2026,4);g.aiClock=-1e8;const metrics={},actor=adaptiveOpponent('combined',metrics,{UNITS,BUILDINGS});for(let i=0;i<2200&&!g.units.some(u=>u.owner===0&&u.kind==='gunship');i++){if(i%30===0)actor(g);g.step(.1);}assert.equal(metrics.paidRecruitOrders.gunship,1);assert.ok(g.units.some(u=>u.owner===0&&u.kind==='gunship'));assert.ok(g.time<200);assert.ok(g.units.some(u=>u.owner===0&&u.kind==='infantry'));});
