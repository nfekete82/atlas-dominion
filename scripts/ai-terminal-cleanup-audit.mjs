#!/usr/bin/env node
/** Read-only terminal / cleanup bottleneck audit.
 * The opponent, paid economy, commands, AI state, fog and outcomes are never
 * touched. This offline analyst CAN inspect both teams' complete state, but
 * never passes omniscient information back to either combatant.
 */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=u=>u.hp>0&&!u.carrier;
const byKind=list=>Object.fromEntries(
 [...new Set(list.map(x=>x.kind))].sort().map(k=>[k,list.filter(x=>x.kind===k).length]));
const rounded=n=>Math.round(n*10)/10;
export function terminalSnapshot(g){
 const c=g.tactical.state.commander,mission=c?.mission,active=g.units.filter(alive);
 const red=active.filter(u=>u.owner===1),blue=active.filter(u=>u.owner===0);
 const blueBases=g.bases.filter(b=>b.owner===0&&b.hp>0);
 const redBases=g.bases.filter(b=>b.owner===1&&b.hp>0);
 const redFighters=red.filter(u=>!['engineer','medic','scout'].includes(u.kind));
 const pending=g.territories.filter(t=>t.owner!==1).map(t=>{
  const nearest=redFighters.map(u=>({unit:u.id,kind:u.kind,range:rounded(dist(u,t.point)),
   order:u.orders[0]?.kind??null})).sort((a,b)=>a.range-b.range||a.unit-b.unit)[0]??null;
  const insideRed=red.some(u=>dist(u,t.point)<=g.rules.captureRadius);
  const insideBlue=blue.some(u=>dist(u,t.point)<=g.rules.captureRadius);
  return {id:t.id,owner:t.owner,captureProgress:rounded(t.progress),capturing:t.capturing,
   readiness:g.captureReadiness(t,1),nearest,insideRed,insideBlue};
 });
 const nearMission=mission?redFighters.slice().sort((a,b)=>dist(a,mission)-dist(b,mission)).slice(0,5)
  .map(u=>({id:u.id,kind:u.kind,distance:rounded(dist(u,mission)),
   health:rounded(u.hp),hold:!!u.hold,order:u.orders[0]?.kind??null,
   target:u.orders[0]?.target??null,pathLength:u.path?.length??0})):null;
 return {at:rounded(g.time),status:g.status,territoryRed:g.territories.filter(t=>t.owner===1).length,
  territoryBlue:g.territories.filter(t=>t.owner===0).length,
  pending,blueArmy:byKind(blue),redArmy:byKind(red),blueBases:blueBases.map(b=>({
   id:b.id,kind:b.kind,sector:b.territory,hp:rounded(b.hp)})),
  redProduction:redBases.filter(b=>['headquarters','barracks','factory','airfield'].includes(b.kind)).map(b=>({
   kind:b.kind,sector:b.territory,queued:b.queueTypes.slice(),hp:rounded(b.hp)})),
  allHeadquarters:g.bases.filter(b=>b.kind==='headquarters').map(b=>({
   id:b.id,owner:b.owner,sector:b.territory,hp:rounded(b.hp)})),
  observedHqRemovedAt:c?.enemyHQEliminatedAt??null,
  mission:mission?{kind:mission.kind,sector:mission.sector,objective:mission.objective,
   since:rounded(mission.since),progressAt:rounded(mission.progressAt)}:null,
  tacticalPhase:g.tactical.state.phase,groupSize:g.tactical.state.group.length,
  groupIds:g.tactical.state.group.slice(0,20),nearMission,
  recentReasons:(!redFighters.length?'no-fighters':null)};
}
export class TerminalObserver{
 constructor(start=300,interval=60){this.next=start;this.interval=interval;this.samples=[];this.final=null;}
 observe(g){
  if(g.time+1e-6>=this.next){
   this.samples.push(terminalSnapshot(g));this.next+=this.interval;
  }
  if(g.status!=='playing')this.final=terminalSnapshot(g);
 }
 finish(){
  return {sampleIntervalSeconds:this.interval,samples:this.samples.slice(-20),
   final:this.final??this.samples.at(-1)??null};
 }
}
export function options(argv){
 const out={opponent:'guarded',seeds:'2075,2026',seconds:'900',
  output:'ai-arena-results/terminal-cleanup.json'};
 for(let i=0;i<argv.length;i+=2){
  const k=argv[i]?.startsWith('--')?argv[i].slice(2):null;
  if(!k||!['opponent','seeds','seconds','output'].includes(k)||!argv[i+1]||
   argv[i+1].startsWith('--'))throw Error('Invalid terminal audit flag');
  out[k]=argv[i+1];
 }
 const seeds=out.seeds.split(',').map(Number),seconds=Number(out.seconds);
 if(!OPPONENTS.includes(out.opponent)||seeds.length<1||seeds.length>8||
  seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295)||
  new Set(seeds).size!==seeds.length||!Number.isInteger(seconds)||seconds<300||seconds>1200)
  throw Error('Invalid terminal audit options');
 return {...out,seeds,seconds};
}
export function audit({opponent,seeds,seconds}){
 const rows=[];
 for(const seed of seeds){
  let hash=null;
  for(const strategy of ['current','early-barracks']){
   const observer=new TerminalObserver();
   class ObservedSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const result=runMatch({Simulation:ObservedSimulation,UNITS},{
    opponent:'guarded',label:strategy,seconds,
    defender:g=>scriptedBlueTurn(g,opponent),
    observe:g=>observer.observe(g)
   },seed,'director',11);
   if(hash!==null&&hash!==result.initialStateHash)throw Error('Unequal paired opening');
   hash=result.initialStateHash;
   const trace=observer.finish();
   const final=trace.final;
   rows.push({opponent,seed,strategy,outcome:result.outcome,
    firstHqDamage:result.firstEnemyHQDamage,firstHqDestroyed:result.firstEnemyHQDestroyed,
    enemyHQDestroyed:result.enemyHQDestroyed,enemyHQCaptured:result.enemyHQCaptured,
    enemyHQDamage:result.enemyHQDamage,elapsed:result.elapsedSeconds,
    initialStateHash:hash,redDead:result.redUnitsLost,
    finalComposition:result.finalComposition,
    trace});
   console.log('TERMINAL',opponent,seed,strategy,result.outcome,
    'hqDestroyed='+result.enemyHQDestroyed,'hqCaptured='+result.enemyHQCaptured,
    'blueBases='+JSON.stringify(final?.blueBases??[]),
    'blueArmy='+JSON.stringify(final?.blueArmy??{}),
    'pending='+JSON.stringify(final?.pending?.map(p=>({id:p.id,owner:p.owner,
     gate:p.readiness,near:p.nearest?.range??null}))??[]),
    'mission='+JSON.stringify(final?.mission??null),
    'phase='+final?.tacticalPhase);
  }
 }
 return {schemaVersion:1,kind:'offline postmortem only',
  notice:'This offline observation sees complete state of both teams for diagnosis, NEVER for AI decision-making.',
  opponent,seeds,seconds,rows};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const opts=options(process.argv.slice(2)),report=audit(opts),path=resolve(opts.output);
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(path+'.tmp',path);
 console.log('TERMINAL AUDIT COMPLETE '+report.rows.length);
}
