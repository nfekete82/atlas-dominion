import {Game} from '../dist/src/engine/game.js';

const ticks=Number(process.argv[2]??250);
if(!Number.isInteger(ticks)||ticks<1||ticks>5000)throw Error('Ticks must be 1..5000');
const seed=Number(process.argv[3]??20261013);
if(!Number.isInteger(seed))throw Error('Seed must be an integer');
const game=new Game(seed,8,'DE','balanced',true);
const initial=game.factions.map(f=>f.territory);
const totals={idleSquadTicks:0,activeSquadTicks:0,aiCaptures:0,aiTerritoryDelta:0};
let previous=game.factions.map(f=>f.territory);
for(let i=0;i<ticks;i++){
  game.step();
  for(const squad of game.squads){
    if(squad.owner===0)continue;
    if(squad.destination!=null||squad.attackTarget!=null||
      squad.campaignTarget!=null||squad.seaRoute?.length)
      totals.activeSquadTicks++;
    else totals.idleSquadTicks++;
  }
  for(let id=1;id<game.factions.length;id++)
    totals.aiCaptures+=Math.max(0,game.factions[id].territory-previous[id]);
  previous=game.factions.map(f=>f.territory);
}
totals.aiTerritoryDelta=game.factions.slice(1).reduce((sum,f)=>sum+
  f.territory-initial[f.id],0);
const total=totals.idleSquadTicks+totals.activeSquadTicks;
console.log(JSON.stringify({
  ticks,seed,
  ...totals,
  activeSquadShare:total?Number((totals.activeSquadTicks/total).toFixed(4)):null,
  formations:game.squads.filter(s=>s.owner>0).length
},null,2));
