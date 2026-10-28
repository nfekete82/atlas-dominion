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
