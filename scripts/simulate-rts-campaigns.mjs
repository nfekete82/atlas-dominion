// Deterministic scripted player: only public paid build/recruit/order APIs.
// No observer resets, income grants, unit grants, or combat modifications.
import {Game,cellToPoint,landNeighbors,isSquadEmbarked} from '../dist/src/engine/game.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const results=[],root='docs/qa/deep-game-20261022';mkdirSync(root,{recursive:true});
const passive=process.argv.includes('--passive');
const configs=passive?[{country:'VA',difficulty:'impossible',opponents:49},
 {country:'SM',difficulty:'intense',opponents:49}]:[{country:'DE',difficulty:'balanced',opponents:49},
 {country:'GB',difficulty:'relaxed',opponents:8},
 {country:'FR',difficulty:'impossible',opponents:49}];
for(const config of configs){
 const g=new Game(221041,config.opponents,config.country,config.difficulty,true);
 const initial=g.factions.reduce((n,f)=>n+f.population,0);let recruited=0,maxDrift=0;
 for(const name of ['recruitSquad','reinforceSquad']){const original=g[name].bind(g);g[name]=(...args)=>{const result=original(...args);if(result.ok)recruited+=args.at(-1);return result;};}
 const checkpoints=[];
 for(let tick=0;tick<(passive?3000:5000)&&g.status==='playing';tick++){
  if(!passive&&tick%8===0){
   const player=g.factions[0],own=g.squads.filter(u=>u.owner===0),barracks=[];
   for(let tile=0;tile<g.buildings.length;tile++)if(g.owner[tile]===0&&g.buildings[tile]===4)barracks.push(tile);
   if(!barracks.length&&player.money>=280){
    const site=g.owner.findIndex((id,tile)=>id===0&&g.canBuild(0,cellToPoint(tile),'barracks').ok);
    if(site>=0)g.build(0,cellToPoint(site),'barracks');
   }
   if(barracks.length&&player.money>=200&&own.length<4)
    g.recruitSquad(0,cellToPoint(barracks[0]),Math.min(300,Math.floor(player.money/2)));
   const targets=new Set();
   for(let tile=0;tile<g.owner.length;tile++)if(g.owner[tile]===0)
    for(const next of landNeighbors(tile))if(g.owner[next]!==0&&g.owner[next]!==-2&&!g.isAllied(0,g.owner[next]))targets.add(next);
   for(const unit of own){
    if(isSquadEmbarked(unit)||unit.destination!=null||unit.campaignTarget!=null||unit.attackTarget!=null)continue;
    if(unit.troops<30&&barracks.length){
     if(unit.index!==barracks[0])g.orderSquad(0,unit.id,cellToPoint(barracks[0]));
     else if(player.money>=160)g.reinforceSquad(0,unit.id,cellToPoint(unit.index),80);
     continue;
    }
    let best=null,score=-Infinity;
    for(const tile of targets){
     const defenders=g.squads.filter(e=>e.owner!==0&&!isSquadEmbarked(e)&&
      (e.index===tile||landNeighbors(tile).includes(e.index))).reduce((n,e)=>n+e.troops,0);
     const distance=Math.abs(tile%480-unit.index%480)+Math.abs(Math.floor(tile/480)-Math.floor(unit.index/480));
     const value=(g.owner[tile]===-1?65:25)+(g.buildings[tile]===4?45:0)-defenders*.8-distance;
     if(value>score){score=value;best=tile;}
    }
    if(best!=null)g.orderSquadAttack(0,unit.id,cellToPoint(best));
   }
  }
  g.step();assert.equal(g.tick,tick+1);
  const people=g.factions.reduce((n,f)=>n+f.population,0),losses=g.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
  maxDrift=Math.max(maxDrift,Math.abs(initial+recruited-losses-people));assert.ok(maxDrift<1e-6);
  assert.ok(g.factions.every(f=>Number.isFinite(f.money)&&f.money>=0));
  if(g.tick%1000===0||g.status!=='playing'){global.gc?.();checkpoints.push({tick:g.tick,status:g.status,playerTerritory:g.factions[0].territory,
   living:g.factions.filter(f=>f.alive).length,squads:g.squads.length,heapMB:process.memoryUsage().heapUsed/1048576,losses});}
 }
 const result={...config,playerPolicy:passive?'passive':'public-paid-orders',seed:221041,ticks:g.tick,status:g.status,maxDrift,checkpoints};results.push(result);
 writeFileSync(root+(passive?'/terminal-campaigns.json':'/campaigns.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(result));
}
