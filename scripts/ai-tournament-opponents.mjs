/**
 * Deterministic BLUE sparring controllers for four-bastion matches.
 * They use only ordinary paid Simulation APIs and publicly known territory
 * ownership. Enemies are considered only if actually visible to BLUE.
 * Never change health, credits, map rules, or spawn free units.
 */
import {blueDefense} from './benchmark-ai-opponent.mjs';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

export const OPPONENTS=Object.freeze(['guarded','pressure','expansion','armored']);
const fighters=g=>g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
 ['infantry','heavy','tank','rover','artillery'].includes(u.kind)).sort((a,b)=>a.id-b.id);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const homeBase=g=>g.bases.find(b=>b.owner===0&&b.hp>0&&b.kind==='headquarters');
function sectorTarget(g,home,kind){
 // Ownership is public; never inspect unseen RED bases to choose a target.
 const choices=g.territories.filter(t=>t.owner!==0);
 if(!choices.length)return null;
 choices.sort((a,b)=>{
  const score=t=>(kind==='pressure'&&t.owner===1?-250:0)+
   (kind==='expansion'&&t.owner===-1?-500:0)+near(home,t.point)-
   (t.income??0)*1.5;
  return score(a)-score(b)||a.id-b.id;
 });
 return choices[0];
}
function freeSite(g,kind,home){
 for(const radius of [250,330,420,510,620])for(let i=0;i<20;i++){
  const angle=i*Math.PI/10,p={x:home.x+Math.cos(angle)*radius,y:home.y+Math.sin(angle)*radius};
  if(!g.buildError(0,kind,p))return p;
 }
 return null;
}
function paidArmor(g,home){
 const own=g.bases.filter(b=>b.owner===0&&b.hp>0),worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 const factory=own.find(b=>b.kind==='factory'&&b.buildRemaining===0);
 if(!factory&&worker&&!own.some(b=>b.kind==='factory')&&
   !own.some(b=>b.buildRemaining>0)&&g.credits[0]>=BUILDINGS.factory.cost){
  const site=freeSite(g,'factory',home);
  if(site)g.build(0,'factory',site,[worker.id]);
 }
 if(factory&&factory.queue.length<2){
  const roster=g.units.filter(u=>u.owner===0&&u.hp>0),queued=own.reduce((n,b)=>n+b.queueTypes.filter(k=>k==='rover'||k==='tank').length,0);
  if(roster.filter(u=>u.kind==='rover'||u.kind==='tank').length+queued<3){
   const kind=g.credits[0]>=UNITS.tank.cost?'tank':'rover';
   if(g.credits[0]>=UNITS[kind].cost)g.recruit(factory.id,kind);
  }
 }
}
export function scriptedBlueTurn(g,kind){
 if(!OPPONENTS.includes(kind))throw Error('Unknown BLUE sparring strategy: '+kind);
 blueDefense(g);
 if(kind==='guarded'||g.status!=='playing')return;
 const home=homeBase(g);if(!home)return;
 if(kind==='armored')paidArmor(g,home);
 if(g.time<(kind==='expansion'?35:kind==='pressure'?55:80))return;
 const troops=fighters(g);
 if(troops.length<(kind==='expansion'?2:3))return;
 const objective=sectorTarget(g,home,kind);
 if(!objective)return;
 const defend=troops[0],attackers=troops.filter(u=>u.id!==defend.id);
 // Do not rewrite active routes unless their objective really changed.
 const units=attackers.filter(u=>!u.orders.some(o=>
  (o.kind==='attackMove'||o.kind==='move')&&near(o,objective.point)<95));
 if(units.length)g.command(units.map(u=>u.id),{...objective.point,kind:'attackMove'});
}
