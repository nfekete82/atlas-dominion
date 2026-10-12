/** Deterministic risk/reward rules shared by the AI and defensive combat. */
export interface InvasionFactors {
  attackerTroops: number;
  attackerIncome: number;
  defenderTroops: number;
  defenderIncome: number;
  garrison: number;
  capital: boolean;
  neutral: boolean;
  threatenedBorders: number;
  /** Relative national power effect on real damage. 1 means evenly matched. */
  relativePower?: number;
  riskTolerance?: number;
}
export interface InvasionAssessment {
  worthwhile: boolean;
  advantage: number;
  reserveFloor: number;
}

/** Keep a strategic home reserve when the AI is exposed to hostile neighbours. */
export function assessInvasion(f: InvasionFactors): InvasionAssessment {
  const risk=Math.max(0,Math.min(.22,f.riskTolerance ?? 0));
  const reserveFloor=Math.max(24-risk*25,
    Math.min(f.attackerTroops*(f.threatenedBorders?.30:.15),f.attackerIncome*4+45));
  const deployable=Math.max(0,f.attackerTroops-reserveFloor);
  if(f.neutral)return {worthwhile:deployable>=10,advantage:deployable/Math.max(8,f.garrison),reserveFloor};
  const attackingPower=(deployable+f.attackerIncome*2)*(f.relativePower??1);
  const defendingPower=f.defenderTroops*.90+f.defenderIncome*2+Math.max(10,f.garrison)*1.8;
  const advantage=attackingPower/Math.max(1,defendingPower);
  const threshold=(f.capital?1.48:1.16)-risk;
  return {worthwhile:deployable>=Math.max(20,32-risk*50)&&advantage>=threshold,advantage,reserveFloor};
}

export interface Interception {
  used: number;
  blocked: number;
}

/** Real defenders automatically spend only free troops, never a hidden infinite garrison.
 * Strengthening the defensive doctrine increases the efficiency of each deployed soldier.
 */
export function interceptAttack(available: number, incomingDamage: number, fortified: boolean, capital: boolean): Interception {
  if (available <= 0 || incomingDamage <= 0) return { used: 0, blocked: 0 };
  const commitment = incomingDamage * (capital ? 0.88 : 0.65) * (fortified ? 1.18 : 1);
  const used = Math.max(0, Math.min(available, commitment));
  const blocked = Math.min(incomingDamage * 0.88, used * (fortified ? 1.12 : 0.84));
  return { used, blocked };
}

/** Real combat casualties, distinct from temporary engagement/effort.
 * Neutral expansion costs campaigning effort but no lives; low-resistance
 * hostile territory has small losses, defended capitals are expensive.
 * Numbers are bounded by the actual soldiers engaged.
 */
export function attackerCasualties(
  engaged: number,
  resisted: number,
  neutral: boolean,
  capital: boolean,
  relativePower = 1,
  fallenDefenders = 0,
): number {
  if(neutral || engaged<=0)return 0;
  const pressure=Math.max(0,resisted)/Math.max(1,engaged);
  // Combat always has a visible cost on HOSTILE land. The ordinary sector
  // garrison represents resistance even when no mobile soldiers were there.
  const fraction=Math.min(.58,(capital?.15:.085)+Math.min(.36,pressure*.22));
  const powerPenalty=1+Math.max(0,1-relativePower)*1.5;
  // Assaults are harder than defending: typically ~1.8 attacker deaths per
  // actual defender death. Cap at 85% of the soldiers engaged per strike.
  const exchangeLoss=Math.max(0,fallenDefenders)*1.8*powerPenalty;
  return Math.max(0,Math.min(engaged*.85,Math.max(engaged*fraction*powerPenalty,exchangeLoss)));
}

/** Remaining survivors are soldiers and inhabitants, not expended resources.
 * A finite marching budget keeps infinite free neutral captures impossible.
 */
export function campaignEffort(people: number): number {
  return Math.max(0,people)*1.65;
}

/** Approximate national military power from citizens (including soldiers
 * currently defending and deployed), strategic depth, and developed cities.
 * All factions use the same formula; geography supports but cannot outweigh
 * a much larger active population. The small base avoids divide-by-zero.
 */
export function empirePower(population:number, territory:number, cities:number):number {
  const people=Math.max(0,Number.isFinite(population)?population:0);
  const land=Math.max(0,Number.isFinite(territory)?territory:0);
  const urban=Math.max(0,Number.isFinite(cities)?cities:0);
  return (people+32)*(1+.065*Math.log1p(land/100))*(1+.025*Math.sqrt(urban));
}

/** Offensive effectiveness based on relative entire-empire power.
 * 1 = even sides; 0.80 = 20% less damage; 1.20 = 20% more.
 * Capped to prevent invincible large empires and hopeless small ones.
 */
export function relativeAttackEffect(attackerPower:number,defenderPower:number):number {
  const attacker=Math.max(1,Number.isFinite(attackerPower)?attackerPower:1);
  const defender=Math.max(1,Number.isFinite(defenderPower)?defenderPower:1);
  const ratio=attacker/defender;
  return Math.max(.80,Math.min(1.20,Math.pow(ratio,.18)));
}
