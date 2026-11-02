import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {bluePressure} from './benchmark-compact-blue-pressure.mjs';

let sampled=-1;
const m=runMatch({Simulation,UNITS},{seconds:160,opponent:'guarded',defender:bluePressure,label:'seed2027-collapse',
 observe:g=>{
  const sec=Math.floor(g.time/12);
  if(sec<=sampled)return;sampled=sec;
  const redBases=g.bases.filter(b=>b.owner===1).map(b=>({
   kind:b.kind,id:b.id,hp:Math.round(b.hp),built:Math.round(b.buildRemaining),
   queue:b.queueTypes,production:Math.round(b.production*10)/10
  }));
  const redUnits=g.units.filter(u=>u.owner===1&&u.hp>0).map(u=>({
   kind:u.kind,id:u.id,hp:Math.round(u.hp),orders:u.orders.map(o=>o.kind+':'+(o.target??'')),
   at:[Math.round(u.x),Math.round(u.y)]
  }));
  const state=g.tactical.state;
  console.log('COLLAPSE '+JSON.stringify({t:Math.round(g.time),credits:g.credits[1],
   sectors:g.territories.filter(t=>t.owner===1).length,bases:redBases,
   units:redUnits,phase:state.phase,goal:state.economy?.goal,
   production:state.economy?.production,
   savingSince:state.savingSince,savingFor:state.savingFor,
   mission:state.commander?.mission?.kind}));
 }},2027,'director',11);
console.log('FINAL '+JSON.stringify({outcome:m.outcome,redCredits:m.redCredits,
 paidBuildCredits:m.paidBuildCredits,paidRecruitCredits:m.paidRecruitCredits,
 orders:m.redOrdersByKind,produced:m.redProducedByKind,finishedBuildings:m.finishedBuildings}));
