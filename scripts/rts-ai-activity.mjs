import {Game} from '../dist/src/engine/game.js';

const ticks=Number(process.argv[2]??250);
if(!Number.isInteger(ticks)||ticks<1||ticks>5000)throw Error('Ticks must be 1..5000');
const seed=Number(process.argv[3]??20261013);
if(!Number.isInteger(seed))throw Error('Seed must be an integer');
const game=new Game(seed,8,'DE','balanced',true);
const initial=game.factions.map(f=>f.territory);
const neutralGainsByPhase={opening:0,middle:0,late:0};
const totals={idleSquadTicks:0,activeSquadTicks:0,aiCaptures:0,aiTerritoryDelta:0};
const inactivity={stationaryTicks:0,stationaryOrderedTicks:0,stationaryUnorderedTicks:0,
  stationaryNearEnemyTicks:0,stationaryNeutralFrontTicks:0,
  stationaryDeepHomeTicks:0,longIdleEpisodes:0,maxIdleStreak:0};
const tracks=new Map();
let previous=game.factions.map(f=>f.territory);
for(let i=0;i<ticks;i++){
  const before=Int16Array.from(game.owner);
  game.step();
  const phase=i<100?'opening':i<240?'middle':'late';
  for(let cell=0;cell<game.owner.length;cell++)
    if(before[cell]===-1&&game.owner[cell]>0)neutralGainsByPhase[phase]++;
  const livingIds=new Set();
  for(const squad of game.squads){
    if(squad.owner===0)continue;
    livingIds.add(squad.id);
    const previousTrack=tracks.get(squad.id);
    const stationary=previousTrack?.index===squad.index;
    const streak=stationary?(previousTrack.streak+1):0;
    if(streak===16)inactivity.longIdleEpisodes++;
    inactivity.maxIdleStreak=Math.max(inactivity.maxIdleStreak,streak);
    tracks.set(squad.id,{index:squad.index,streak});
    if(stationary){
      inactivity.stationaryTicks++;
      const ordered=squad.destination!=null||squad.attackTarget!=null||
        squad.campaignTarget!=null||Boolean(squad.seaRoute?.length);
      if(ordered)inactivity.stationaryOrderedTicks++;
      else inactivity.stationaryUnorderedTicks++;
      const x=squad.index%480,y=Math.floor(squad.index/480);
      const adjacent=[x>0?squad.index-1:-1,x<479?squad.index+1:-1,
        y>0?squad.index-480:-1,y<259?squad.index+480:-1]
        .filter(n=>n>=0);
      if(adjacent.some(n=>game.owner[n]===-1))inactivity.stationaryNeutralFrontTicks++;
      else if(adjacent.some(n=>game.owner[n]>=0&&game.owner[n]!==squad.owner))
        inactivity.stationaryNearEnemyTicks++;
      else inactivity.stationaryDeepHomeTicks++;
    }
    if(squad.destination!=null||squad.attackTarget!=null||
      squad.campaignTarget!=null||squad.seaRoute?.length)
      totals.activeSquadTicks++;
    else totals.idleSquadTicks++;
  }
  for(const id of tracks.keys())if(!livingIds.has(id))tracks.delete(id);
  for(let id=1;id<game.factions.length;id++)
    totals.aiCaptures+=Math.max(0,game.factions[id].territory-previous[id]);
  previous=game.factions.map(f=>f.territory);
}
totals.aiTerritoryDelta=game.factions.slice(1).reduce((sum,f)=>sum+
  f.territory-initial[f.id],0);
const total=totals.idleSquadTicks+totals.activeSquadTicks;
let perimeter=0,owned=0,thinSectors=0;
const width=480,height=260;
for(let i=0;i<game.owner.length;i++){
  const owner=game.owner[i];
  if(owner<=0)continue;
  owned++;
  const x=i%width,y=Math.floor(i/width);
  const adjacent=[x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1];
  const friendly=adjacent.filter(n=>n>=0&&game.owner[n]===owner).length;
  if(friendly<=2)thinSectors++;
  perimeter+=4-friendly;
}
console.log(JSON.stringify({
  ticks,seed,
  neutralGainsByPhase,
  inactivity,
  shape:{owned,perimeter,thinSectors,thinShare:owned?Number((thinSectors/owned).toFixed(4)):null,
    perimeterPerSector:owned?Number((perimeter/owned).toFixed(4)):null},
  ...totals,
  activeSquadShare:total?Number((totals.activeSquadTicks/total).toFixed(4)):null,
  formations:game.squads.filter(s=>s.owner>0).length
},null,2));
