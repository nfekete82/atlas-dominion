import {distance,type Point} from './config.js';

/** Strategic reward, not a combat shortcut. Only PUBLIC sector ownership,
 * actual territory income and ALREADY VISIBLE nearby threats may enter.
 * No concealed enemy units, credits or building coordinates. */
export type EconomyPolicy='classic'|'frontier';
export interface SectorOpportunity {
  owner:number;income:number;distance:number;
  observedEnemies:number;knownTurrets:number;
}
export function captureOpportunityAdjustment(x:SectorOpportunity):number {
 if(x.owner===1||x.income<=0||!Number.isFinite(x.distance))return 0;
 // Reward captures which can sustain a larger army. A neutral zone that can
 // be safely taken now is often worth more than a premature HQ assault.
 const economicReward=Math.min(720,x.income*15);
 const neutralBonus=x.owner===-1?270:0;
 const knownDanger=x.observedEnemies*150+x.knownTurrets*500;
 return -economicReward-neutralBonus+knownDanger;
}
/** A commander should never abandon a current fight just because its
 * strategic score changed slightly on the next three-second pulse. */
export function enoughToRetarget(current:number,next:number,engaged:boolean):boolean{
 return !engaged&&next<current-450;
}
export function observedSectorThreats(p:Point,visible:readonly Point[]):number {
 return visible.filter(e=>distance(p,e)<350).length;
}
