import {distance,type Point} from './config.js';
import type {Territory} from './world.js';

/** Only callers' actually visible enemy units can enter the candidate list.
 * No inspection of hidden combatants, memories, or enemy economy. */
export interface ObservedEnemy extends Point {id:number;hp:number}
export interface SectorThreat {sector:number;enemy:number;at:Point;income:number;distance:number}
/** An opponent within the outer capture approach of an owned bastion may
 * steal income without ever threatening a headquarters. Defend it early. */
export function threatenedOwnedSectors(territories:readonly Territory[],
 visibleEnemies:readonly ObservedEnemy[],owner:number):SectorThreat[]{
 const out:SectorThreat[]=[];
 for(const t of territories){
  if(t.owner!==owner)continue;
  for(const e of visibleEnemies){
   if(e.hp<=0)continue;
   const d=distance(t.point,e);
   if(d>265)continue;
   out.push({sector:t.id,enemy:e.id,at:{x:e.x,y:e.y},income:t.income,distance:d});
  }
 }
 return out.sort((a,b)=>a.distance-b.distance||b.income-a.income||a.sector-b.sector||a.enemy-b.enemy);
}
/** Preserve immediate HQ urgency. An enemy entering the actual sector
 * capture circle is more urgent than a distant attacker merely approaching. */
export function sectorThreatScore(e:ObservedEnemy,threats:readonly SectorThreat[],home:Point):number{
 if(distance(e,home)<280)return -1500+distance(e,home);
 const match=threats.filter(t=>t.enemy===e.id)
  .sort((a,b)=>a.distance-b.distance||b.income-a.income)[0];
 if(!match)return distance(e,home);
 return match.distance<=100?-900+match.distance:-350+match.distance;
}
