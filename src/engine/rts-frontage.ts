/** Deterministic physical RTS frontage. All losses are paid by living squads. */
export function rtsFrontWidth(troops:number):number {
  return Math.max(1,Math.min(30,Math.floor(Math.max(0,troops)/12)));
}
/** A defender holding its own territory benefits from cover and cohesion.
 * Strength affects casualties through actual adjacent participating squads,
 * not fictitious reserve troops.
 */
export function rtsContactLoss(attackerTroops:number,defenderTroops:number,
  defenderHome:boolean):{attackerLost:number;defenderLost:number} {
  const attackers=Math.max(0,attackerTroops),defenders=Math.max(0,defenderTroops);
  if(attackers<=0||defenders<=0)return {attackerLost:0,defenderLost:0};
  const cover=defenderHome?1.25:1;
  return {
    attackerLost:Math.min(attackers,Math.max(.25,defenders*.085*cover)),
    defenderLost:Math.min(defenders,Math.max(.25,attackers*.085/cover))
  };
}
