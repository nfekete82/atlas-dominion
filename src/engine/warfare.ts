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
  const attackingPower = deployable + f.attackerIncome * 2;
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
