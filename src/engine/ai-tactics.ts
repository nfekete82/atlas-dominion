import type {AIStyle} from './ai-strategy.js';

/** AI commanders execute more genuine attacks per simulation tick without
 * being awarded extra soldiers or ignoring actual combat casualties.
 * Their separate stamina pool regenerates over time, with a capped bonus from
 * the empire's real recruitment income.
 */
export function aiMarchRecovery(income:number,style:AIStyle):number {
  const tempo=style==='aggressive'?1.20:style==='expansion'?1.17:style==='opportunist'?1.11:1;
  return Math.max(12,Math.min(90,Math.max(0,income)*4.2))*tempo;
}

export function aiAttacksPerTick(territory:number,style:AIStyle):number {
  const base=5+Math.floor(Math.sqrt(Math.max(0,territory))/3);
  return Math.min(20,base+(style==='aggressive'?3:style==='expansion'?2:style==='opportunist'?1:0));
}

/** Stronger armies launch a more decisive attack. Never spend more soldiers
 * than actually exist and preserve a minimum mobile defensive reserve.
 */
export function aiStrikeSize(reserve:number,neutral:boolean,style:AIStyle):number {
  if(reserve<8)return 0;
  const desired=neutral?17:style==='aggressive'?34:style==='opportunist'?31:29;
  const affordable=Math.max(8,Math.floor(reserve*.43));
  return Math.min(desired,affordable,reserve);
}

/** Reinforcement is a TRANSFER from real mobile units, not spawned troops.
 * Defended borders get priority without draining every army completely.
 */
export function aiDefenseAllocation(reserve:number,income:number,existingBudget:number):number {
  const available=Math.max(0,reserve-30);
  return Math.max(0,Math.min(available*.25,Math.max(8,Math.max(0,income)*5.2),existingBudget*3+2));
}

/** Distinct personalities, but all are willing to press a clear advantage. */
export function aiRiskTolerance(style:AIStyle):number {
  return style==='aggressive'?.20:style==='opportunist'?.14:style==='expansion'?.10:.06;
}
