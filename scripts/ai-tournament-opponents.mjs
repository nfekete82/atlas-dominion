/** Deterministic BLUE opponents for paired RED AI tournament.
 * All troops, buildings and production are paid for through regular APIs.
 * BLUE chooses objectives using public bastion ownership and its OWN assets,
 * never hidden RED units, invisible structures, private resources or memory.
 */
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {blueDefense} from './benchmark-ai-opponent.mjs';

export const TOURNAMENT_OPPONENTS=Object.freeze(['guarded','rush','expansion','armor','siege']);
export function placementCandidates(home){
 const sites=[];
 for(const radius of [250,320,400,490,590,700]){
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12;
   sites.push({x:home.x+Math.cos(a)*radius,y:home.y+Math.sin(a)*radius});
  }
 }
 return sites;
}
export function publicSectorGoal(profile,territories,home){
 const candidates=territories.filter(t=>t.owner!==0);
 if(!candidates.length)return null;
 const score=t=>{
  const d=Math.hypot(t.point.x-home.x,t.point.y-home.y);
  if(profile==='expansion')return d+(t.owner===-1?-700:0)-t.income*5;
  if(profile==='rush')return d+(t.owner===1?-350:0);
  if(profile==='siege')return d+(t.owner===1?-550:150);
  return d+(t.owner===-1?-170:0);
 };
 return candidates.slice().sort((a,b)=>score(a)-score(b)||a.id-b.id)[0];
}
export function plannedConstruction(profile,own){
 const has=kind=>own.some(b=>b.kind===kind&&b.hp>0);
 const order=profile==='armor'?['factory','barracks','generator']:
  profile==='siege'?['factory','barracks','generator']:
  profile==='expansion'?['barracks','generator','factory']:
  profile==='rush'?['barracks']:
  ['barracks','factory','generator'];
 return order.find(kind=>!has(kind))??null;
}
export function blueTournamentOpponent(game,profile){
 if(!TOURNAMENT_OPPONENTS.includes(profile))throw Error('Unknown BLUE strategy '+profile);
 if(profile==='guarded'){blueDefense(game);return;}
 if(game.status!=='playing')return;
 const owner=0,own=game.bases.filter(b=>b.owner===owner&&b.hp>0);
 const home=own.find(b=>b.kind==='headquarters');
 if(!home)return;
 const workers=game.units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
 if(!workers.length){
  if(home.buildRemaining<=0&&home.queue.length<2&&game.credits[owner]>=UNITS.engineer.cost)
   game.recruit(home.id,'engineer');
  return;
 }
 const unfinished=own.some(b=>b.buildRemaining>0);
 if(!unfinished&&!workers.some(u=>u.orders.some(o=>o.kind==='build'))){
  const next=plannedConstruction(profile,own);
  if(next&&game.credits[owner]>=BUILDINGS[next].cost){
   const site=placementCandidates(home).find(p=>!game.buildError(owner,next,p));
   if(site)game.build(owner,next,site,[workers[0].id]);
  }
 }
 const infantry=game.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier);
 const queued=kind=>own.reduce((n,b)=>n+b.queueTypes.filter(k=>k===kind).length,0);
 const count=kind=>infantry.filter(u=>u.kind===kind).length+queued(kind);
 const barracks=own.find(b=>b.kind==='barracks'&&b.buildRemaining<=0&&b.queue.length<2);
 if(barracks){
  const limit=profile==='armor'?6:profile==='siege'?6:profile==='rush'?12:9;
  const men=count('infantry')+count('heavy');
  const kind=profile==='rush'&&count('infantry')>=5&&count('heavy')<2?'heavy':
   profile==='expansion'&&count('heavy')<2&&count('infantry')>=4?'heavy':'infantry';
  if(men<limit&&game.credits[owner]>=UNITS[kind].cost)game.recruit(barracks.id,kind);
 }
 const factory=own.find(b=>b.kind==='factory'&&b.buildRemaining<=0&&b.queue.length<2);
 if(factory&&['armor','siege'].includes(profile)){
  const kind=profile==='armor'?(count('rover')<2?'rover':'tank'):'artillery';
  const limit=profile==='armor'?5:3;
  if(count('rover')+count('tank')+count('artillery')<limit&&game.credits[owner]>=UNITS[kind].cost)
   game.recruit(factory.id,kind);
 }
 const goal=publicSectorGoal(profile,game.territories,home);
 if(!goal)return;
 const soldiers=infantry.filter(u=>['infantry','heavy','rover','tank','artillery'].includes(u.kind))
  .sort((a,b)=>a.id-b.id);
 const minForce=profile==='rush'?2:profile==='expansion'?2:profile==='armor'?3:4;
 if(soldiers.length<minForce)return;
 const attackers=profile==='siege'?soldiers.filter(u=>u.kind!=='artillery'||count('infantry')>=2):soldiers;
 const need=attackers.filter(u=>{
  const o=u.orders[0];
  return !o||o.kind!=='attackMove'||Math.hypot(o.x-goal.point.x,o.y-goal.point.y)>125;
 });
 if(need.length){
  // Leave one defender whenever affordable; never issue commands to RED.
  const guard=soldiers[0];
  const active=need.filter(u=>u.id!==guard.id);
  if(active.length)game.command(active.map(u=>u.id),{...goal.point,kind:'attackMove'});
 }
}
