#!/usr/bin/env node
import {mkdirSync,writeFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {World} from '../dist/src/reborn/world.js';
import {TERRAIN_PROFILES} from '../dist/src/reborn/battlefield-terrain.js';
import {campaignLayout} from '../dist/src/reborn/config.js';
import {generateOases,safeOasis} from './webgl-oasis-generation.js';
const mode=process.argv[2]??'geometry',out=process.argv[3]??`docs/qa/procedural-battlefields/${mode}.json`;
const rows=[],errors=[],started=performance.now();
const quantile=(a,q)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*q))];
if(mode==='geometry'){
 for(const version of [23,24,25,26])for(const profile of TERRAIN_PROFILES){
  for(let index=0;index<50;index++){
   const seed=(index<4?index:(Math.imul(index,2654435761)^0x5ef731a9))>>>0,start=performance.now();
   try{
    const w=new World(seed,version,profile),ms=performance.now()-start;
    const options={world:w,heightAt:(x,y)=>w.terrainHeight(x,y)},oases=generateOases(options);
    if(!w.validation.valid)throw Error(JSON.stringify(w.validation));
    if(oases.some((o,i)=>!safeOasis(o,options,oases.slice(0,i))))throw Error('unsafe oasis');
    rows.push({version,profile,seed,orientation:campaignLayout(version,seed).headquarters,ms,candidate:w.validation.candidate,
     buildArea:w.validation.buildAreaSamples,tankReachable:w.validation.tankReachableSites,freeCells:w.validation.freeCells,
     oases:oases.length,rocks:w.generated.mesas.length,min:w.generated.battlefield.minHeight,max:w.generated.battlefield.maxHeight});
   }catch(e){errors.push({version,profile,seed,error:String(e.stack??e)});}
  }
  console.log(`geometry v${version}/${profile}: ${rows.length} accepted, ${errors.length} errors`);
 }
}else if(mode==='ai'){
 const seconds=Number(process.env.BATTLEFIELD_MATCH_SECONDS??420);
 for(const version of [23,26])for(const profile of TERRAIN_PROFILES)for(const seed of [0,1,2,3]){
  const g=Simulation.campaign(seed,version,profile),start=performance.now(),cpuStart=process.cpuUsage(),home=campaignLayout(version,seed).headquarters[1];
  // Browser gameplay settings; the AI itself receives no extra map knowledge.
  g.highGroundEnabled=true;g.visionScale=1.3;g.infantryVisionBonus=1.15;g.updateVision();
  let firstHQ=null,firstProduction=null,firstExpansion=null,produced=0,peakSectors=1,blockedSamples=0,stalledSamples=0;
  const initial=new Set(g.units.map(u=>u.id)),seen=new Set(initial),positions=new Map();
  for(let tick=0;tick<seconds*20&&g.status==='playing';tick++){
   g.step(.05);
   if(tick%20===0){
    if(firstHQ===null&&g.hasHeadquarters(1))firstHQ=g.time;
    for(const u of g.units)if(u.owner===1&&!seen.has(u.id)){seen.add(u.id);produced++;firstProduction??=g.time;}
    const sectors=g.territories.filter(t=>t.owner===1).length;peakSectors=Math.max(peakSectors,sectors);
    if(sectors>1)firstExpansion??=g.time;
    for(const u of g.units.filter(u=>u.owner===1&&['tank','rover','artillery','infantry','engineer'].includes(u.kind))){
     if(!g.world.walkable(u))blockedSamples++;
     if(tick%600===0){const prev=positions.get(u.id),goal=u.orders[0];
      if(prev&&goal&&goal.kind==='move'&&Math.hypot(u.x-goal.x,u.y-goal.y)>180&&Math.hypot(u.x-prev.x,u.y-prev.y)<5)stalledSamples++;
      positions.set(u.id,{x:u.x,y:u.y});}
    }
   }
  }
  const cpu=process.cpuUsage(cpuStart);
  const row={version,profile,seed,aiHome:home,seconds:g.time,firstHQ,firstProduction,firstExpansion,produced,peakSectors,
   blockedSamples,stalledMoveSamples:stalledSamples,status:g.status,wallMs:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,
   remaining:g.units.filter(u=>u.owner===1).length};
  if(firstHQ===null||firstProduction===null||firstExpansion===null||blockedSamples)errors.push(row);
  rows.push(row);console.log(`AI v${version}/${profile}/${seed}: HQ ${firstHQ?.toFixed(1)}, produced ${produced}, sectors ${peakSectors}, blocked ${blockedSamples}, ${row.wallMs.toFixed(0)}ms`);
 }
}else throw Error('Expected geometry or ai');
const result={mode,generatorVersion:1,scope:mode==='ai'?'40 paid bootstrap matches, existing RED AI vs passive BLUE startup; four RED corners, five profiles, 4/16 bastions. Functionality, not competitive faction balance.':'50 seeds × five profiles × four sizes (1000 worlds), all orientations; World authoritative navigation validation.',
 total:rows.length,errors,wallMs:performance.now()-started,
 timingMs:mode==='geometry'?{median:quantile(rows.map(r=>r.ms),.5),p95:quantile(rows.map(r=>r.ms),.95),max:Math.max(...rows.map(r=>r.ms))}:undefined,
 corrections:mode==='geometry'?rows.filter(r=>r.candidate>0).length:undefined,rows};
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined,errors:errors.length}));if(errors.length)process.exitCode=1;
