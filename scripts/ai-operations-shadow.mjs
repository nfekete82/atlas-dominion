#!/usr/bin/env node
/** New strategic architecture, SHADOW ONLY.
 * A read-only sidecar evaluates the proposed central operation state machine
 * against real paid matches, never changing a unit order, tactical mode,
 * production priority, savegame or the battle result.
 * The public-route estimate is independently computed, not secretly read
 * from the tactical commander's private caches. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {chooseOperation} from '../dist/src/reborn/operation-controller.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const combat=u=>u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind);
export function observeOperationView(g){
 const own=g.units.filter(u=>u.owner===1&&combat(u));
 const known=g.memories[1].filter(m=>m.owner===0&&m.hp>0);
 const guns=known.filter(m=>m.kind==='turret');
 const headquarters=known.some(m=>m.kind==='headquarters');
 const anchor=own.length?own.reduce((a,u)=>({x:a.x+u.x/own.length,y:a.y+u.y/own.length}),{x:0,y:0}):
  g.bases.find(b=>b.owner===1&&b.hp>0)??g.territories.find(t=>t.owner===1)?.point??{x:0,y:0};
 const enemies=g.units.filter(u=>u.owner===0&&combat(u)&&g.canSee(1,u));
 const fronts=g.territories.filter(t=>t.owner!==1&&
  t.neighbors.some(id=>g.territories[id]?.owner===1)).map(t=>{
  // Real public nav mesh, not straight-line guess and not the game's live
  // tactical orders. The only enemy information is RED-visible or remembered.
  const points=g.world.path(anchor,t.point,g.obstacles(),12);
  const length=points.length?points.reduce((n,p,i)=>n+d(p,i?points[i-1]:anchor),0):Infinity;
  const risky=points.filter(p=>guns.some(tower=>d(p,tower)<(tower.range??600)+40)).length;
  return {sector:t.id,owner:t.owner,income:t.income,routeLength:length,
   routeRisk:points.length?Math.min(99,risky/points.length*12):Infinity,
   observedTower:guns.some(b=>d(b,t.point)<740),
   observedHQ:known.some(b=>b.kind==='headquarters'&&d(b,t.point)<740),
   visibleFighters:enemies.filter(u=>d(u,t.point)<420).length};
 });
 const homeThreat=g.bases.some(b=>b.owner===1&&b.hp>0&&
  enemies.some(u=>d(u,b)<440));
 return {at:g.time,livingFighters:own.length,
  hasArtillery:own.some(u=>u.kind==='artillery'),
  enemyHQEliminated:g.tactical.state.commander?.enemyHQEliminatedAt!==undefined,
  observedEnemyHQ:headquarters,visibleHomeThreat:homeThreat,
  knownEnemyTowerCount:guns.length,fronts};
}
export class OperationShadowObserver{
 constructor(){this.nextAt=30;this.sampleCount=0;this.operation=null;
  this.modeSeconds={};this.transitions=[];this.missions={};
  this.mismatched=0;this.riskyOpen=0;this.last=null;}
 observe(g){
  if(g.time+1e-6<this.nextAt)return;
  this.nextAt+=10;
  const view=observeOperationView(g),decision=chooseOperation(view,this.operation);
  this.operation=decision.next;
  this.sampleCount++;
  this.modeSeconds[decision.next.mode]=(this.modeSeconds[decision.next.mode]??0)+10;
  const actual=g.tactical.state.commander?.mission;
  const actualKind=actual?.kind??'none';
  this.missions[actualKind]=(this.missions[actualKind]??0)+10;
  const mismatch=decision.next.mode==='expand'&&actualKind!=='capture'||
   decision.next.mode==='siege'&&actualKind==='capture'||
   decision.next.mode==='assault'&&actualKind==='capture'||
   decision.next.mode==='defend'&&g.tactical.state.phase!=='defend';
  if(mismatch)this.mismatched++;
  // Front proximity is not proof of safety under fog, so expose residual
  // uncertainty rather than silently calling candidate opportunities safe.
  if(decision.next.mode==='expand'&&decision.openFront!==null&&
   view.fronts.some(f=>f.sector===decision.openFront&&f.routeRisk>=4))
   this.riskyOpen++;
  if(decision.changed||this.transitions.length===0){
   if(this.transitions.length<80)this.transitions.push({
    at:Math.round(g.time),mode:decision.next.mode,reason:decision.next.reason,
    actualKind,front:decision.openFront,own:view.livingFighters,
    gun:view.hasArtillery,knownTowers:view.knownEnemyTowerCount});
  }
  this.last={at:Math.round(g.time),recommended:decision.next.mode,
   actualKind,front:decision.openFront};
 }
 finish(){
  return {samples:this.sampleCount,observedSeconds:this.sampleCount*10,
   modeSeconds:this.modeSeconds,actualMissionSeconds:this.missions,
   divergentSamples:this.mismatched,riskyCandidateSamples:this.riskyOpen,
   transitions:this.transitions,last:this.last};
 }
}
export function parseOptions(argv){
 const options={opponent:'pressure',seeds:'2026,2029,2062,2066',seconds:'360',
  output:'ai-arena-results/operation-shadow.json'};
 for(let i=0;i<argv.length;i+=2){
  const flag=argv[i]?.startsWith('--')?argv[i].slice(2):null;
  if(!flag||!['opponent','seeds','seconds','output'].includes(flag)||
   !argv[i+1]||argv[i+1].startsWith('--'))throw Error('Invalid shadow option');
  options[flag]=argv[i+1];
 }
 const seeds=options.seeds.split(',').map(Number),seconds=Number(options.seconds);
 if(!OPPONENTS.includes(options.opponent)||seeds.length<1||seeds.length>12||
  seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)||
  new Set(seeds).size!==seeds.length||
  !Number.isInteger(seconds)||seconds<120||seconds>900)
  throw Error('Invalid shadow opponent, seeds or horizon');
 return {...options,seeds,seconds};
}
export function runAudit({opponent,seeds,seconds}){
 const rows=[];
 for(const seed of seeds){
  let initial=null;
  for(const strategy of ['current','early-barracks']){
   const shadow=new OperationShadowObserver();
   class ObservedSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const result=runMatch({Simulation:ObservedSimulation,UNITS},{
    seconds,label:strategy,opponent:'guarded',
    defender:g=>scriptedBlueTurn(g,opponent),
    observe:g=>shadow.observe(g)
   },seed,'director',11);
   if(initial!==null&&initial!==result.initialStateHash)
    throw Error('Nonidentical paired starting states');
   initial=result.initialStateHash;
   const audit=shadow.finish();
   rows.push({seed,opponent,strategy,outcome:result.outcome,
    initialStateHash:initial,hqDamage:result.enemyHQDamage,
    redDeaths:result.redUnitsLost,captures:result.captures,audit});
   console.log('SHADOW',opponent,seed,strategy,'outcome='+result.outcome,
    'modes='+JSON.stringify(audit.modeSeconds),
    'mission='+JSON.stringify(audit.actualMissionSeconds),
    'divergent='+audit.divergentSamples+'/'+audit.samples);
  }
 }
 return {schemaVersion:1,kind:'pure strategic intent observer, never deployed',
  samplingIntervalSeconds:10,opponent,seeds,seconds,
  expected:seeds.length*2,completed:rows.length,rows,
  caveat:'An intent disagreement is not a gameplay improvement. A visible-free route can contain fog-hidden defenders. No behavior is changed by this audit.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const opts=parseOptions(process.argv.slice(2)),result=runAudit(opts),out=resolve(opts.output);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out+'.tmp',JSON.stringify(result,null,2)+'\n');
 renameSync(out+'.tmp',out);
 console.log('OPERATION SHADOW COMPLETE '+result.completed+'/'+result.expected);
}
