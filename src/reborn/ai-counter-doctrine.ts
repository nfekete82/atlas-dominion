import {UNITS,type UnitKind} from './catalog.js';
import {distance,type Point} from './config.js';

/** Paid production demand derived only from Red's OWN roster and sightings.
 * Queued units count toward the quota. Never reads unseen player actors. */
export function rocketInfantryQuota(input:{
 fighters:number;time:number;vehicles:number;air:number;
 barracksReady:boolean;underAttack:boolean;
}):number{
 if(!input.barracksReady)return 0;
 // One token anti-air squad is ineffective once a real armored/air force
 // arrives. Maintain a *paid*, bounded specialist screen (including queues).
 // Only currently sighted or recently sighted threats may raise the quota.
 const baseline=input.fighters>=6&&input.time>=100?2:
  input.fighters>=4&&input.time>=65?1:0;
 const armor=input.vehicles>0?Math.min(4,1+input.vehicles):0;
 const aa=input.air>0?Math.min(4,1+input.air):0;
 return Math.max(baseline,armor,aa);
}

/** Bomber is an expensive anti-armor investment, not an opening prerequisite.
 * A functional airfield and an actual funded screen are required; observed
 * hostile air defers the bomber until AA coverage is dealt with. */
export function bomberAntiArmorQuota(input:{
 airfieldReady:boolean;income:number;fighters:number;groundVehicles:number;
 enemyArmor:number;enemyAir:number;underAttack:boolean;finishing:boolean;
}):number{
 if(!input.airfieldReady||input.income<40||input.fighters<5||
    input.groundVehicles<2||input.underAttack)return 0;
 // Bombers are expensive and defenseless against enemy fixed-wing fighters;
 // a single transport helicopter does NOT invalidate the anti-tank mission.
 if(input.enemyAir>=2)return 0;
 if(input.enemyArmor>=3)return input.enemyAir?1:2;
 if(input.enemyArmor>=1)return 1;
 return 0;
}

export interface ObservedCounterTarget extends Point {id:number;kind:UnitKind;hp:number}
export type CounterRole='rocket'|'bomber';

/** Only feed this function units independently verified by Red vision.
 * Aircraft bomb ground armor; shoulder rockets engage air and armor.
 * A modest distance penalty prevents distant targets from hijacking local
 * defenses. Tie-breaking by id guarantees deterministic replay/save-load. */
export function selectObservedCounterTarget(role:CounterRole,source:Point,
 seen:readonly ObservedCounterTarget[],maxDistance:number,
 mission?:Point):ObservedCounterTarget|undefined{
 return seen.filter(u=>u.hp>0&&
   (role==='rocket'&&(UNITS[u.kind].flying||UNITS[u.kind].group==='Fahrzeuge')||
    role==='bomber'&&!UNITS[u.kind].flying&&UNITS[u.kind].group==='Fahrzeuge')&&
   distance(source,u)<=maxDistance&&
   (!mission||distance(mission,u)<850||distance(source,u)<500))
  .slice().sort((a,b)=>{
   const priority=(u:ObservedCounterTarget)=>{
    if(role==='rocket')
     return u.kind==='bomber'?0:u.kind==='scout'?1:u.kind==='artillery'?2:u.kind==='tank'?3:4;
    return u.kind==='tank'?0:u.kind==='artillery'?1:2;
   };
   const aScore=priority(a)*130+distance(source,a);
   const bScore=priority(b)*130+distance(source,b);
   return aScore-bScore||a.id-b.id;
  })[0];
}
