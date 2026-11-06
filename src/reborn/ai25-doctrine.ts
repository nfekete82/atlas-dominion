import {distance,type Point} from './config.js';

/** Tactical AI 2.5: rank only positions already certified by caller as
 * navigable, within weapon range, and with an unobstructed firing line.
 * The risk value comes only from observed/remembered threats. */
export interface SiegeShot {gunId:number;at:Point;travel:number;risk:number;gunHp:number;primary:boolean}
export function chooseSiegeShot(shots:readonly SiegeShot[]):SiegeShot|undefined {
 return shots.filter(s=>s.gunHp>0&&Number.isFinite(s.travel)&&s.travel>=0&&Number.isFinite(s.risk)&&s.risk>=0
   &&Number.isFinite(s.at.x)&&Number.isFinite(s.at.y))
  .slice().sort((a,b)=>{
    const score=(s:SiegeShot)=>s.travel*.45+s.risk*95+Math.min(1400,s.gunHp)*.09-(s.primary?100:0);
    return score(a)-score(b)||Number(b.primary)-Number(a.primary)||a.gunId-b.gunId
      ||a.at.y-b.at.y||a.at.x-b.at.x;
  })[0];
}
export interface RaidFront extends Point {id:number;owner:number;income:number;routeLength:number;routeRisk:number;observedThreat:boolean}
export function chooseRaidFront(fronts:readonly RaidFront[],mainSector:number):RaidFront|undefined {
 return fronts.filter(t=>t.id!==mainSector&&t.owner!==1&&!t.observedThreat
    &&Number.isFinite(t.routeLength)&&t.routeLength>0&&Number.isFinite(t.routeRisk)&&t.routeRisk<8)
  .slice().sort((a,b)=>{
    const score=(t:RaidFront)=>t.routeLength+t.routeRisk*110-(t.owner===-1?180:0)-t.income*7;
    return score(a)-score(b)||a.id-b.id;
  })[0];
}
/** Break mission stickiness only after real recorded losses or repeated
 * failed fronts. A successful recent hit on an observed building wins. */
export function replanAfterLoss(x:{
 elapsed:number;freshDamage:boolean;progressAge:number;recentLosses:number;frontFailures:number;frontAge:number
}):boolean {
 if(x.elapsed<35||x.freshDamage||x.progressAge<12)return false;
 return x.recentLosses>=3||(x.frontFailures>=2&&x.frontAge<100);
}
/** A raid is allowed only if an already paid squad leaves a viable main
 * attack AND it doesn't steal an engaged combatant or strategic guard. */
export function allowSecondaryPressure(total:number,mainAvailable:number,mainEngaged:number,alreadyAssigned:number):boolean {
 return total>=10&&mainAvailable>=7&&mainEngaged>=5&&alreadyAssigned>=2;
}
