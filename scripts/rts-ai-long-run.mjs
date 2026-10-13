import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// node scripts/rts-ai-long-run.mjs seed opponents [compiled game module] [ticks]
const seed=Number(process.argv[2]??20261013),opponents=Number(process.argv[3]??8);
const modulePath=resolve(process.argv[4]??'dist/src/engine/game.js');
const ticks=Number(process.argv[5]??1000);
const {Game}=await import(pathToFileURL(modulePath).href);
if(!Number.isSafeInteger(seed)||!Number.isInteger(opponents)||opponents<1||opponents>49||
  !Number.isInteger(ticks)||ticks<1||ticks>5000)throw Error('Invalid seed, opponents or ticks');
const warmupTicks=process.argv.includes('--warmup')?360:0;
if(warmupTicks){
  let warmup=new Game(seed^0x5a5a5a5a,opponents,'DE','balanced',true);
  for(let i=0;i<warmupTicks;i++){warmup.status='playing';warmup.step();}
  warmup=null;global.gc?.();
}
const game=new Game(seed,opponents,'DE','balanced',true);
const initialPeople=game.factions.reduce((n,f)=>n+f.population,0);
const initialAIPeople=game.factions.slice(1).reduce((n,f)=>n+f.population,0);
let recruited=0,aiRecruited=0,maxConservationDrift=0,conservationViolations=0;
const originalRecruit=game.recruitSquad.bind(game);
game.recruitSquad=(...args)=>{
  const result=originalRecruit(...args);
  if(result.ok){recruited+=args[2];if(args[0]>0)aiRecruited+=args[2];}
  return result;
};
const initial=game.factions.slice(1).reduce((n,f)=>n+f.territory,0);
const loss=()=>game.factions.slice(1).reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
const stages=['commandRTSAI','moveSquads','resolveSquadContacts','recount',
  'rebuildFrontierCandidates','orderSquadAttack','chooseFront','maritimeRoute'];
let sample,attempts=new Map();
for(const name of stages){
  const original=game[name].bind(game);
  game[name]=(...args)=>{
    const start=performance.now(),before=loss();
    if(name==='orderSquadAttack'){
      const [owner,id,point]=args,key=`${id}:${point.y*480+point.x}`;
      sample.attackAttempts++;
      if(game.tick-(attempts.get(key)??-Infinity)<=16)sample.repeatedAttackAttempts++;
      attempts.set(key,game.tick);
    }
    const result=original(...args);
    const entry=sample.stages[name];
    entry.ms+=performance.now()-start;entry.calls++;entry.losses+=loss()-before;
    if(name==='orderSquadAttack'&&!result.ok)sample.failedAttackAttempts++;
    return result;
  };
}
const measurements=[],checkpoints=[],intervals=[];
let firstTerminal=null;
const quantiles=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  const q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??0;
  return {median:q(.5),p95:q(.95),p99:q(.99)};
};
let previousLoss=0,previousTerritory=0;
for(let i=0;i<ticks;i++){
  sample={tick:i+1,stages:Object.fromEntries(stages.map(name=>[name,{ms:0,calls:0,losses:0}])),
    attackAttempts:0,repeatedAttackAttempts:0,failedAttackAttempts:0};
  const before=new Map(game.squads.map(s=>[s.id,{index:s.index,seaLanding:s.seaLanding}]));
  // Headless observer mode: keep simulating surviving AIs after the inactive
  // human loses. Never count Game.step() no-ops as fast simulation ticks.
  if(game.status!=='playing'){
    firstTerminal??={tick:game.tick,status:game.status};
    game.status='playing';
  }
  const start=performance.now();game.step();sample.ms=performance.now()-start;
  if(game.tick!==i+1)throw Error('Simulation did not advance an actual tick');
  sample.losses=loss();
  sample.realLosses=initialAIPeople+aiRecruited-game.factions.slice(1).reduce((n,f)=>n+f.population,0);
  const people=game.factions.reduce((n,f)=>n+f.population,0);
  const allLosses=game.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
  sample.conservationDrift=initialPeople+recruited-allLosses-people;
  maxConservationDrift=Math.max(maxConservationDrift,Math.abs(sample.conservationDrift));
  if(Math.abs(sample.conservationDrift)>1e-6)conservationViolations++;
  sample.territory=game.factions.slice(1).reduce((n,f)=>n+f.territory,0)-initial;
  const own=game.squads.filter(s=>s.owner>0);
  sample.formations=own.length;sample.fielded=own.reduce((n,s)=>n+s.troops,0);
  sample.contacts=0;sample.invalidMoves=0;sample.moved=0;
  const sailing=unit=>unit.seaRoute?.length&&unit.index===unit.seaRoute[0]&&unit.destination===null;
  for(const unit of own){
    const prior=before.get(unit.id);
    if(prior&&prior.index!==unit.index){
      sample.moved++;
      if(prior.seaLanding!==unit.index){
        const dx=Math.abs(prior.index%480-unit.index%480);
        const dy=Math.abs(Math.floor(prior.index/480)-Math.floor(unit.index/480));
        if(dx>1||dy>1||game.owner[unit.index]===-2)sample.invalidMoves++;
      }
    }
    for(const enemy of game.squads)if(!sailing(unit)&&!sailing(enemy)&&enemy.id>unit.id&&enemy.owner!==unit.owner&&
      !game.isAllied(unit.owner,enemy.owner)&&
      Math.abs(enemy.index%480-unit.index%480)+
      Math.abs(Math.floor(enemy.index/480)-Math.floor(unit.index/480))<=2)sample.contacts++;
  }
  measurements.push(sample);
  if((i+1)%100===0||i+1===ticks){
    const segment=measurements.slice(intervals.length*100);
    intervals.push({from:segment[0].tick,to:i+1,performance:quantiles(segment.map(s=>s.ms)),
      cumulativeLosses:sample.losses,realLosses:sample.realLosses,losses:sample.losses-previousLoss,
      territory:sample.territory,territoryGain:sample.territory-previousTerritory,
      meanFielded:segment.reduce((n,s)=>n+s.fielded,0)/segment.length,
      meanFormations:segment.reduce((n,s)=>n+s.formations,0)/segment.length,
      contacts:segment.reduce((n,s)=>n+s.contacts,0),
      attackAttempts:segment.reduce((n,s)=>n+s.attackAttempts,0),
      repeatedAttackAttempts:segment.reduce((n,s)=>n+s.repeatedAttackAttempts,0),
      failedAttackAttempts:segment.reduce((n,s)=>n+s.failedAttackAttempts,0),
      stages:Object.fromEntries(stages.map(name=>[name,{
        ms:segment.reduce((n,s)=>n+s.stages[name].ms,0),
        calls:segment.reduce((n,s)=>n+s.stages[name].calls,0),
        losses:segment.reduce((n,s)=>n+s.stages[name].losses,0)
      }]))});
    previousLoss=sample.losses;previousTerritory=sample.territory;
  }
  if([360,500,1000].includes(i+1)||i+1===ticks)checkpoints.push({ticks:i+1,
    territory:sample.territory,losses:sample.losses,realLosses:sample.realLosses,
    performance:quantiles(measurements.map(s=>s.ms)),
    invalidMoves:measurements.reduce((n,s)=>n+s.invalidMoves,0),
    stateHash:createHash('sha256').update(JSON.stringify(game.exportSave())).digest('hex')});
}
console.log(JSON.stringify({seed,opponents,modulePath,observer:true,warmupTicks,firstTerminal,
  conservation:{initialPeople,recruited,maxDrift:maxConservationDrift,violatingTicks:conservationViolations},
  checkpoints,intervals,...(process.argv.includes('--trace')?{measurements}:{} )},null,2));
