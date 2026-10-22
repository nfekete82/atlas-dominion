import {formatCompact} from './format.js';
import type {Game} from './engine/game.js';

/** Presentation data shared by labels, hover details and a future military overlay.
 * Residents and soldiers are one pool; deployed survivors must be counted once. */
export interface MilitarySummary {
  total:number; mobile:number; border:number; deployed:number; fronts:number;
  cities:number; averageCityLevel:number; income:number; growth:number;
}
export const STRENGTH_COLORS={weaker:'#9df0b1',similar:'#ffe18a',stronger:'#ffaaa4'} as const;
const percentageFormat=new Intl.NumberFormat('de-DE',{maximumFractionDigits:1});
export function relativeStrength(total:number,playerTotal:number) {
  const ratio=playerTotal>0?total/playerTotal:total>0?Infinity:1;
  const danger=ratio<.9?'weaker':ratio>1.1?'stronger':'similar';
  return {ratio,danger,color:STRENGTH_COLORS[danger],
    text:Number.isFinite(ratio)?`${percentageFormat.format(ratio*100)} %`:'∞ %'};
}
export function strengthLabel(total:number):string {
  return `⚔ ${formatCompact(Math.floor(total))}`;
}
/** Only uncommitted reserves can be sent on a new offensive.
 * The cyan map label is deliberately distinct from total military power. */
export function mobileStrengthLabel(mobile:number):string {
  return `● ${formatCompact(Math.floor(Math.max(0,mobile)))} mobil`;
}
/** Called on the existing territory refresh, using its already accumulated borders
 * and building list. No grid scan or formatting in the animation loop. */
export function militarySummaries(game:Game,borders:ArrayLike<number>,
  buildings:ReadonlyArray<{index:number;code:number;owner:number}>):MilitarySummary[] {
  const summaries=game.factions.map(f=>({total:f.troops+borders[f.id],mobile:f.troops,
    border:borders[f.id],deployed:0,fronts:0,cities:0,averageCityLevel:0,
    income:f.moneyIncome,growth:game.rtsRecruitment?0:f.income}));
  for(const city of game.cities){
    const id=game.owner[city.index];
    if(id>=0)summaries[id].cities++;
  }
  for(const building of buildings)if(building.code===1&&building.owner>=0){
    const summary=summaries[building.owner];summary.cities++;
    summary.averageCityLevel+=game.cityUpgrades[building.index];
  }
  for(const order of game.attackOrders){
    const summary=summaries[order.factionId];
    summary.total+=order.remaining;summary.deployed+=order.remaining;
    // Returning armies and fleets still at sea count in strength, but are not active fronts.
    if(!order.returning&&(!order.landing||game.tick>=(order.arrivalTick??Infinity)))summary.fronts++;
  }
  // Physical formations, including embarked survivors, are bound soldiers.
  // Their port bookkeeping marker must never make them mobile a second time.
  for(const unit of game.squads??[]){
    const summary=summaries[unit.owner];
    summary.total+=unit.troops;summary.deployed+=unit.troops;
  }
  // Mutual-defense soldiers travelling between allies still belong to the
  // donor until arrival; they are bound and must never count as mobile reserves.
  for(const convoy of game.defenseAid??[]){
    const summary=summaries[convoy.from];
    if(!summary)continue;
    summary.total+=convoy.troops;
    summary.deployed+=convoy.troops;
  }
  for(const summary of summaries)summary.averageCityLevel=summary.cities?summary.averageCityLevel/summary.cities:0;
  return summaries;
}
