#!/usr/bin/env node
/** READ-ONLY postmortem for four-bastion failures.
 * Samples economy, production and territory control while existing red AI
 * plays a paid scripted opponent; does not alter any gameplay behavior.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {scriptedBlueTurn,OPPONENTS} from './ai-tournament-opponents.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function routeLength(start,path){
 if(!path.length)return null;
 let length=0,from=start;
 for(const point of path){length+=distance(from,point);from=point;}
 return Math.round(length);
}
export function initialRouteAudit(seed){
 const g=new Simulation(seed,11),neutral=g.territories.filter(t=>t.owner===-1),obstacles=g.obstacles();
 const paths={};
 for(const owner of [0,1]){
  const unit=g.units.find(u=>u.owner===owner&&u.kind==='infantry');
  if(!unit)throw Error('Initial soldier absent');
  paths[owner]=neutral.map(t=>{
   const path=g.world.path(unit,t.point,obstacles,0);
   const straight=Math.round(distance(unit,t.point));
   const actual=routeLength(unit,path);
   return {sector:t.id,straight,actual,
    detourRatio:actual===null?null:Math.round(actual/Math.max(1,straight)*100)/100,
    navigable:path.length>0};
  });
 }
 const minimum=owner=>Math.min(Infinity,...paths[owner].map(p=>p.actual??Infinity));
 const blue=minimum(0),red=minimum(1);
 return {seed,mapVersion:11,neutralSectors:neutral.map(t=>t.id),
  startPositions:[0,1].map(owner=>({owner,hq:g.bases.find(b=>b.owner===owner)?.territory,
   soldier:g.units.find(u=>u.owner===owner&&u.kind==='infantry')&&
    (({x,y})=>({x,y}))(g.units.find(u=>u.owner===owner&&u.kind==='infantry'))})),
  pathOptions:paths,shortestBlueRoute:Number.isFinite(blue)?blue:null,
  shortestRedRoute:Number.isFinite(red)?red:null,
  redToBlueShortestRatio:Number.isFinite(red)&&Number.isFinite(blue)?
   Math.round(red/Math.max(1,blue)*100)/100:null,
  equalInitialCredits:g.credits[0]===g.credits[1],
  initialIncome:[g.income(0),g.income(1)]};
}
export function phaseSnapshot(g){
 const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),
  blue=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier);
 const buildings=owner=>g.bases.filter(b=>b.owner===owner&&b.hp>0).map(b=>({
  kind:b.kind,completion:b.buildRemaining,queue:b.queueTypes.slice(),hp:Math.round(b.hp)}));
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 return {time:Math.round(g.time),phase:g.tactical.state.phase,
  aiLastPlan:g.tactical.state.lastPlan,
  commanderPhase:g.tactical.state.commander?.phase??null,
  missionKind:g.tactical.state.commander?.mission?.kind??null,
  missionTarget:g.tactical.state.commander?.mission?.sector??null,
  tacticalGroup:g.tactical.state.group.length,
  redCredits:Math.round(g.credits[1]),blueCredits:Math.round(g.credits[0]),
  redIncome:g.income(1),blueIncome:g.income(0),
  redSectors:g.territories.filter(t=>t.owner===1).map(t=>t.id),
  blueSectors:g.territories.filter(t=>t.owner===0).map(t=>t.id),
  neutralSectors:g.territories.filter(t=>t.owner===-1).map(t=>t.id),
  redCombat:red.filter(u=>!['engineer','medic','scout'].includes(u.kind)).length,
  blueCombat:blue.filter(u=>!['engineer','medic','scout'].includes(u.kind)).length,
  redBuildings:buildings(1),blueBuildings:buildings(0),
  redHQHp:hq?Math.round(hq.hp):0,
  visibleBlueThreats:hq?blue.filter(u=>g.canSee(1,u)&&distance(u,hq)<560).length:0};
}
function options(args){
 const read=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1];};
 const seeds=read('seeds','2026,2027,2028,2030,2031,2033').split(',').map(Number),
  opponents=read('opponents','pressure,expansion').split(','),
  seconds=Number(read('seconds','360')),
  output=resolve(read('output','ai-arena-results/early-phase-postmortem.json'));
 if(!seeds.length||seeds.length>16||seeds.some(s=>!Number.isSafeInteger(s)||s<0)||
  !Number.isInteger(seconds)||seconds<100||seconds>1200||opponents.some(p=>!OPPONENTS.includes(p)))
  throw Error('Invalid postmortem CLI');
 return {seeds,opponents,seconds,output};
}
export function runPostmortem(config){
 const games=[],maps=config.seeds.map(initialRouteAudit);
 for(const seed of config.seeds)for(const opponent of config.opponents){
  const snapshots=[];let bucket=-1;
  const m=runMatch({Simulation,UNITS},{seconds:config.seconds,
   opponent:'guarded',defender:g=>scriptedBlueTurn(g,opponent),
   observe:g=>{
    const next=Math.floor(g.time/15);
    if(next===bucket)return;bucket=next;snapshots.push(phaseSnapshot(g));
   }},seed,'director',11);
  games.push({seed,opponent,outcome:m.outcome,elapsedSeconds:m.elapsedSeconds,
   captures:m.captures,netCaptures:m.netCaptures,redUnitsLost:m.redUnitsLost,
   blueUnitsLost:m.blueUnitsLost,enemyHQDamage:m.enemyHQDamage,
   firstFrontContact:m.firstFrontContact,firstAssault:m.firstAssault,
   firstFactory:m.firstFactory,firstArtillery:m.firstArtillery,
   abortedMissions:m.abortedMissions,rapidUnitOrderChanges:m.rapidUnitOrderChanges,
   repeatedUnitCommands:m.repeatedUnitCommands,paidRecruitCredits:m.paidRecruitCredits,
   paidBuildCredits:m.paidBuildCredits,productionIdleReasons:m.productionIdleReasons,
   redProducedByKind:m.redProducedByKind,redLossesByKind:m.redLossesByKind,
   snapshots});
  console.log('postmortem',seed,opponent,m.outcome,'redDeaths='+m.redUnitsLost,
   'redCaptures='+m.captures,'neutralAt60='+JSON.stringify(snapshots.find(s=>s.time>=60)?.neutralSectors));
 }
 const report={schemaVersion:1,mapVersion:11,
  disclaimer:'Observational scripted-opponent study, no strategy changes or proof of human difficulty',
  seeds:config.seeds,opponents:config.opponents,seconds:config.seconds,maps,games};
 mkdirSync(dirname(config.output),{recursive:true});
 writeFileSync(config.output,JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&new URL('file://'+resolve(process.argv[1])).href===import.meta.url){
 try{const report=runPostmortem(options(process.argv.slice(2)));
  console.log('POSTMORTEM COMPLETED',report.games.length,
   'red losses='+report.games.filter(g=>g.outcome==='loss').length);}
 catch(e){console.error(e.stack??String(e));process.exitCode=1;}
}
