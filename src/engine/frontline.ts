/** Economy and reinforcement rules are deliberately independent of rendering and RNG. */
/** Local fortified frontier strength increases with empire size and available reserves. */
export function frontierTarget(territory: number, reserve: number, capital: boolean, fortified: boolean): number {
  return (11 + 0.42 * Math.sqrt(Math.max(0, territory)) + 2.4 * Math.log1p(Math.max(0, reserve))
    + (capital ? 21 : 0)) * (fortified ? 1.4 : 1);
}

/** Preserve free reserves for offensive orders and emergency defensive reactions. */
export function frontierBudget(reserve: number, income: number): number {
  const safe = Math.max(45, income * 2);
  return Math.max(0, Math.min((reserve - safe) * 0.15, income * 2.4));
}

export function localDefenseStrength(garrison: number, stationed: number): number {
  return Math.max(0, garrison) + Math.max(0, stationed) * 1.7;
}

/** Large armies press a wider front, without jumping past captured neighbors. */
export function attackFrontWidth(committed: number, blitz: boolean, neutral: boolean): number {
  const base = blitz ? 6 : neutral ? 5 : 3;
  return Math.min(22, base + Math.floor(Math.sqrt(Math.max(0, committed)) / 3.2));
}
