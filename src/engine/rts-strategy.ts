/** Pure, deterministic RTS target evaluation. Strategic value never creates units. */
export interface RTSTargetIntel {
  neutral:boolean;
  enemyTroops:number;
  friendlyTroops:number;
  distance:number;
  capital:boolean;
  barracks:boolean;
  tower:boolean;
  city:boolean;
  factory:boolean;
  committedAttackers:number;
}
/** Negative scores are intentionally permitted: a well-defended target is undesirable. */
export function scoreRTSTarget(t:RTSTargetIntel):number {
  const asset=(t.capital?95:0)+(t.barracks?65:0)+(t.city?38:0)+(t.factory?26:0);
  const defense=Math.max(0,t.enemyTroops-t.committedAttackers*.65);
  const expectedRisk=defense/Math.max(10,t.friendlyTroops);
  return (t.neutral?75:36)+asset-(t.tower?40:0)
    -Math.min(170,expectedRisk*65)-Math.max(0,t.distance)*.8
    +(t.committedAttackers>0?Math.min(30,t.committedAttackers*.24):0);
}
