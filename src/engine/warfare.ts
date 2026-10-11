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
}
export interface InvasionAssessment {
  worthwhile: boolean;
  advantage: number;
  reserveFloor: number;
}

/** Keep a strategic home reserve when the AI is exposed to hostile neighbours. */
export function assessInvasion(f: InvasionFactors): InvasionAssessment {
  const reserveFloor = Math.max(24, Math.min(f.attackerTroops * (f.threatenedBorders ? 0.30 : 0.15), f.attackerIncome * 4 + 45));
  const deployable = Math.max(0, f.attackerTroops - reserveFloor);
  if (f.neutral) return { worthwhile: deployable >= 10, advantage: deployable / Math.max(8, f.garrison), reserveFloor };
  // Income is forward-looking reinforcement, but present troops dominate.
  // Capturing a capital is lucrative, yet costs more than taking open terrain.
  const attackingPower = (deployable + f.attackerIncome * 2) * (f.relativePower ?? 1);
  const defendingPower = f.defenderTroops * 0.90 + f.defenderIncome * 2 + Math.max(10, f.garrison) * 1.8;
  const advantage = attackingPower / Math.max(1, defendingPower);
  const threshold = f.capital ? 1.48 : 1.16;
  return { worthwhile: deployable >= 32 && advantage >= threshold, advantage, reserveFloor };
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
): number {
  if(neutral || engaged<=0)return 0;
  const pressure=Math.max(0,resisted)/Math.max(1,engaged);
  const fraction=Math.min(.52,(capital?.10:.035)+Math.min(.39,pressure*.21));
  // An underpowered attacker must pay a disproportionate price. Strong
  // opponents increase the casualty fraction but never invent more deaths
  // than the troops engaged.
  const powerPenalty=1+Math.max(0,1-relativePower)*1.5;
  return Math.max(0,Math.min(engaged,engaged*Math.min(.70,fraction*powerPenalty)));
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
 * 1 = even sides; 0.70 = 30% less damage; 1.30 = 30% more.
 * Capped to prevent invincible large empires and hopeless small ones.
 */
export function relativeAttackEffect(attackerPower:number,defenderPower:number):number {
  const attacker=Math.max(1,Number.isFinite(attackerPower)?attackerPower:1);
  const defender=Math.max(1,Number.isFinite(defenderPower)?defenderPower:1);
  const ratio=attacker/defender;
  return Math.max(.70,Math.min(1.30,Math.pow(ratio,.18)));
}
