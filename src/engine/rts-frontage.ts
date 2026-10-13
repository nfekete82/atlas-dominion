/** Deterministic physical RTS frontage. All losses are paid by living squads. */
export function rtsFrontWidth(troops:number):number {
  return Math.max(1,Math.min(30,Math.floor(Math.max(0,troops)/12)));
}
/** A defender holding its own territory benefits from cover and cohesion.
 * Strength affects casualties through actual adjacent participating squads,
 * not fictitious reserve troops.
 */
export function rtsContactLoss(attackerTroops:number,defenderTroops:number,
  defenderHome:boolean,attackerHome=false):{attackerLost:number;defenderLost:number} {
  const attackers=Math.max(0,attackerTroops),defenders=Math.max(0,defenderTroops);
  if(attackers<=0||defenders<=0)return {attackerLost:0,defenderLost:0};
  const defenderCover=defenderHome?1.25:1;
  const attackerCover=attackerHome?1.25:1;
  return {
    attackerLost:Math.min(attackers,Math.max(.25,defenders*.085*defenderCover/attackerCover)),
    defenderLost:Math.min(defenders,Math.max(.25,attackers*.085*attackerCover/defenderCover))
  };
}

/** A defeated fractional remainder is a real casualty as well. */
export function rtsActualLoss(troops:number,requested:number):number {
  if(requested<=0)return 0;
  const loss=Math.min(troops,requested);
  return troops-loss<1?troops:loss;
}
