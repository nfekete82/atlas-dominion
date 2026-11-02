import {distance,type Point} from './config.js';
import {canAttack,unitSpec,type UnitKind} from './catalog.js';

/** Pure unit allocation: never reads unseen enemies, game state or global RNG. */
export interface SquadMember extends Point {id:number;hp:number;kind:UnitKind}
export interface ObservedThreat extends Point {id:number;hp:number;kind:UnitKind}
/** Keep costly rockets, medics and engineers out of a close-range pursuit. */
export function assignScreen(members:readonly SquadMember[],threat:ObservedThreat):number[] {
 const front=members.filter(u=>u.hp>0&&['infantry','heavy','tank','rover'].includes(u.kind)&&canAttack(u,threat));
 if(!front.length)return [];
 // Keep a viable assault reserve while assigning enough strength to avoid
 // a two-soldier screen being immediately wiped out by a guarded position.
 const n=Math.min(front.length>=6?3:2,Math.max(1,front.length-1));
 return front.slice().sort((a,b)=>distance(a,threat)-distance(b,threat)||
  unitSpec(b).hp-unitSpec(a).hp||a.id-b.id).slice(0,n).map(u=>u.id);
}
/** Mobile escort can use a second approach without taking an emergency screen away. */
export function assignFlank(members:readonly SquadMember[],screen:readonly number[]):number[] {
 const used=new Set(screen);
 const candidates=members.filter(u=>u.hp>=unitSpec(u).hp*.65&&!used.has(u.id)&&
  ['rover','tank','heavy','infantry'].includes(u.kind));
 // Leave at least two combatants holding the primary axis; otherwise a
 // tempting two-man flank would strip the entire assault group bare.
 if(candidates.length<4)return [];
 const priority=(kind:UnitKind)=>kind==='rover'?4:kind==='tank'?3:kind==='heavy'?2:1;
 return candidates.slice().sort((a,b)=>priority(b.kind)-priority(a.kind)||
  unitSpec(b).speed-unitSpec(a).speed||a.id-b.id).slice(0,2).map(u=>u.id);
}

/** Distance plus exposure on the actual planned approach, sampled against
 * *observed* enemies only. No world state, fog lookups or random choices. */
export function flankRouteScore(origin:Point,route:readonly Point[],observed:readonly ObservedThreat[]):number {
 if(!route.length)return Number.POSITIVE_INFINITY;
 let score=0,from=origin;
 for(const next of route){
  const length=distance(from,next);
  if(!Number.isFinite(length))return Number.POSITIVE_INFINITY;
  const samples=Math.max(1,Math.ceil(length/80));
  for(let i=1;i<=samples;i++){
   const p={x:from.x+(next.x-from.x)*i/samples,y:from.y+(next.y-from.y)*i/samples};
   for(const enemy of observed){
    if(enemy.hp<=0||!Number.isFinite(enemy.x)||!Number.isFinite(enemy.y))continue;
    const spec=unitSpec(enemy),d=distance(p,enemy);
    const exposure= Math.max(0,Math.min(1,(spec.range+70-d)/Math.max(1,spec.range*.65)));
    // Range matters, but do not prefer a kilometer-long detour to avoid
    // a single brief rifle contact.
    score+=exposure*(spec.damage/spec.cooldown)*.50*(length/samples/80);
   }
  }
  score+=length;from=next;
 }
 return score;
}

/** A temporary incoming hit must not erase a queued two-leg flank. Actual
 * retreat/recovery authority stays with the higher-level director. */
export function isContinuingFlank(orders:readonly {kind:string;tactical?:{group:number;mode:string}}[],groupId:number):boolean {
 return orders.length>=2&&orders[0].kind==='attackMove'&&orders[1].kind==='attackMove'
  &&orders[0].tactical?.mode==='assault'&&orders[1].tactical?.mode==='assault'
  &&orders[0].tactical.group===groupId&&orders[1].tactical.group===groupId;
}

/** Limit a siege counterattack to a real mobile escort, instead of ordering
 * every rifleman into an enemy firing lane. Receives only our own combatants
 * and one legally visible enemy. At least one soldier remains at the battery
 * when the screen has two or more members. No unit is conjured or buffed. */
export function selectSiegeInterceptors(members:readonly SquadMember[],threat:ObservedThreat):number[]{
 const attackers=members.filter(u=>u.hp>0&&['infantry','heavy','tank','rover'].includes(u.kind)&&canAttack(u,threat));
 if(!attackers.length)return [];
 // A critically wounded fighter should not become the first to intercept
 // just because its position happens to be slightly closer.
 const healthy=attackers.filter(u=>u.hp>=unitSpec(u).hp*.45);
 const candidates=healthy.length?healthy:attackers;
 const role=(kind:UnitKind)=>kind==='tank'?4:kind==='heavy'?3:kind==='rover'?2:1;
 const size=Math.min(candidates.length,attackers.length===1?1:Math.max(1,Math.min(attackers.length-1,attackers.length>=6?3:2)));
 return candidates.slice().sort((a,b)=>role(b.kind)-role(a.kind)
   ||b.hp/unitSpec(b).hp-a.hp/unitSpec(a).hp
   ||distance(a,threat)-distance(b,threat)||a.id-b.id).slice(0,size).map(u=>u.id);
}
