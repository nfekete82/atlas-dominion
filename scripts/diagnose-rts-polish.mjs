import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.argv[2]??'before',modulePath=resolve(process.argv[3]??'dist/src/engine/game.js');
const {Game,isSquadEmbarked}=await import(pathToFileURL(modulePath));
const g=new Game(20261022,49,'DE','balanced',true),losses={},orders={},recoveries={},fronts=new Map(),contactCauses={tower:0,armies:0};
const original=g.resolveSquadContacts.bind(g);
g.resolveSquadContacts=()=>{
 const before=g.squads.filter(u=>!isSquadEmbarked(u)).map(u=>({...u})),first=g.battleEvents.length;original();
 for(const event of g.battleEvents.slice(first))contactCauses[event.defending===0?'tower':'armies']+=event.attackerLost+event.defenderLost;
 const after=new Map(g.squads.map(u=>[u.id,u]));
 for(const u of before){
  const lost=u.troops-(after.get(u.id)?.troops??0);if(lost<=0)continue;
  const state=u.campaignTarget!=null?(u.campaignOwner===-1?'neutral campaign':'hostile campaign'):u.destination!==null?'march':'idle';
  losses[state]=(losses[state]??0)+lost;
  const k=u.owner+':'+u.index,info=fronts.get(k)??{owner:u.owner,index:u.index,losses:0,ticks:0,states:{}};
  info.losses+=lost;info.ticks++;info.states[state]=(info.states[state]??0)+lost;fronts.set(k,info);
 }
};
for(const name of ['orderSquad','orderSquadAttack']){
 const original=g[name].bind(g);g[name]=(...args)=>{
  const u=g.squads.find(u=>u.id===args[1]),previous=u?{...u}:null,result=original(...args);
  const k=name+':'+(result.ok?'accepted':result.reason);orders[k]=(orders[k]??0)+1;
  if(result.ok&&previous){
   const k=name==='orderSquad'?(previous.campaignTarget!=null?'campaign cancelled':previous.destination!==null?'march replaced':previous.index===u.destination?'hold current tile':'idle deployed'):'attack';
   recoveries[k]=(recoveries[k]??0)+1;
  }return result;
 };
}
for(let tick=0;tick<1000;tick++){g.status='playing';g.step();}
const report={phase,seed:20261022,ticks:g.tick,losses,contactCauses,orders,decisions:recoveries,fronts:[...fronts.values()].sort((a,b)=>b.losses-a.losses).slice(0,30)};
mkdirSync('docs/qa/final-polish-20261022',{recursive:true});
writeFileSync(`docs/qa/final-polish-20261022/${phase}-decisions.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
