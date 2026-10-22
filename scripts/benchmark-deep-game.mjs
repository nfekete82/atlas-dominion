import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const phase=process.argv[2]??'after';
const modulePath=resolve(process.argv[3]??'dist/src/engine/game.js');
const extended=process.argv.includes('--extended');
const {Game}=await import(pathToFileURL(modulePath));
const root='docs/qa/deep-game-20261022';mkdirSync(root,{recursive:true});
const scenarios=[{opponents:49,country:'DE',difficulty:'balanced'},
 {opponents:8,country:'DE',difficulty:'balanced'},
 ...(extended?[{opponents:49,country:'ES',difficulty:'relaxed'},
 {opponents:49,country:'GB',difficulty:'intense'},
 {opponents:49,country:'FR',difficulty:'impossible'},
 {opponents:8,country:'IT',difficulty:'balanced',seed:20261013},
 {opponents:49,country:'PL',difficulty:'balanced',seed:221041}]:[])];
const quantiles=values=>{values.sort((a,b)=>a-b);return {median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)]};};
const results=[];
for(const config of scenarios){
 const seed=config.seed??20261022;
 let warm=new Game(seed,config.opponents,config.country,config.difficulty,true);
 for(let tick=0;tick<120;tick++){warm.status='playing';warm.step();}warm=null;global.gc?.();
 const g=new Game(seed,config.opponents,config.country,config.difficulty,true);
 const initial=g.factions.reduce((n,f)=>n+f.population,0),territory=g.factions.slice(1).reduce((n,f)=>n+f.territory,0);
 let recruited=0,drift=0,invalidMoves=0,firstTerminal=null;const times=[],phases={},checkpoints=[];
 for(const name of ['recruitSquad','reinforceSquad']){const original=g[name].bind(g);g[name]=(...args)=>{const result=original(...args);if(result.ok)recruited+=args.at(-1);return result;};}
 for(const name of ['commandRTSAI','moveSquads','resolveSquadContacts','recount','redistributeFrontline','rebuildFrontierCandidates']){
  const original=g[name].bind(g);phases[name]=0;g[name]=(...args)=>{const start=performance.now();const result=original(...args);phases[name]+=performance.now()-start;return result;};
 }
 for(let tick=1;tick<=1000;tick++){
  const before=new Map(g.squads.map(u=>[u.id,{index:u.index,landing:u.seaLanding}]));
  if(g.status!=='playing'){firstTerminal??={tick:g.tick,status:g.status};g.status='playing';}
  const start=performance.now();g.step();times.push(performance.now()-start);
  if(g.tick!==tick)throw Error('Simulation did not advance');
  for(const u of g.squads){const prev=before.get(u.id);if(!prev||prev.index===u.index||prev.landing===u.index)continue;
   if(Math.abs(prev.index%480-u.index%480)>1||Math.abs(Math.floor(prev.index/480)-Math.floor(u.index/480))>1||g.owner[u.index]===-2)invalidMoves++;
  }
  const losses=g.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0),people=g.factions.reduce((n,f)=>n+f.population,0);
  drift=Math.max(drift,Math.abs(initial+recruited-losses-people));
  if(tick===500||tick===1000){
   global.gc?.();checkpoints.push({tick,territoryGain:g.factions.slice(1).reduce((n,f)=>n+f.territory,0)-territory,
    losses,people,recruited,squads:g.squads.length,living:g.factions.filter(f=>f.alive).length,
    buildings:Array.from(g.buildings).reduce((a,code)=>{a[code]=(a[code]??0)+1;return a;},{}),
    meanMoney:g.factions.slice(1).reduce((n,f)=>n+f.money,0)/config.opponents,
    heapMB:process.memoryUsage().heapUsed/1048576,performance:quantiles([...times])});
  }
 }
 const result={...config,seed,ticks:g.tick,firstTerminal,maxConservationDrift:drift,invalidMoves,phases,checkpoints,
  hash:createHash('sha256').update(JSON.stringify(g.exportSave())).digest('hex')};results.push(result);
 console.log(JSON.stringify(result));
}
writeFileSync(`${root}/${phase}-simulation.json`,JSON.stringify({phase,node:process.version,platform:process.platform,arch:process.arch,results},null,2));
