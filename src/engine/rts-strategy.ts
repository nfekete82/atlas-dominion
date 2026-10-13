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

/** A theater objective shared by independent physical formations. Units remain
 * separate, travel legally and can be redirected to immediate defense.
 */
export interface RTSOperation {
  target:number;
  committed:number;
  formations:number;
  distance:number;
  threat:number;
}
export function chooseRTSOperation(operations:readonly RTSOperation[]):RTSOperation|null {
  if(!operations.length)return null;
  let best:RTSOperation|null=null;
  let bestScore=-Infinity;
  for(const operation of operations){
    if(!Number.isInteger(operation.target)||operation.target<0||
       !Number.isFinite(operation.committed)||operation.committed<20||
       !Number.isFinite(operation.distance)||operation.distance<0||
       !Number.isFinite(operation.threat)||operation.threat<0)continue;
    const score=operation.committed*.22+operation.formations*18
      -operation.distance*.65-operation.threat*.32;
    if(score>bestScore||(score===bestScore&&best!==null&&operation.target<best.target)){
      bestScore=score;best=operation;
    }
  }
  return best;
}

/** Select the next operational posture from observable local facts. */
export type RTSPosture='defend'|'recover'|'reinforce'|'expand'|'invade'|'redeploy';
export interface RTSPostureIntel {
  localThreat:number;
  availableTroops:number;
  activeCampaigns:number;
  neutralFrontier:boolean;
  hostileFrontier:boolean;
}
export function chooseRTSPosture(s:RTSPostureIntel):RTSPosture {
  if(s.localThreat>0&&s.availableTroops<s.localThreat*1.4)return 'defend';
  if(s.availableTroops<20)return 'recover';
  if(s.activeCampaigns>0)return 'reinforce';
  if(s.neutralFrontier)return 'expand';
  if(s.hostileFrontier)return 'invade';
  return 'redeploy';
}

/** Persistent campaigns live in squad.campaignTarget (already save-compatible).
 * This chooses the next joint objective only when no valid campaign exists.
 * Defensive infrastructure increases value; physical enemy soldiers increase risk.
 */
export interface RTSTheaterTarget {
  tile:number;
  neutral:boolean;
  defenderStrength:number;
  assaultStrength:number;
  distance:number;
  strategicValue:number;
  committed:number;
}
export function chooseRTSTheaterTarget(targets:readonly RTSTheaterTarget[]):number|null {
  let chosen:number|null=null,score=-Infinity;
  for(const target of targets){
    if(!Number.isInteger(target.tile)||target.tile<0||
      !Number.isFinite(target.assaultStrength)||target.assaultStrength<20||
      !Number.isFinite(target.defenderStrength)||target.defenderStrength<0||
      !Number.isFinite(target.distance)||target.distance<0)continue;
    const threat=target.defenderStrength/Math.max(20,target.assaultStrength+target.committed*.5);
    const value=(target.neutral?55:35)+target.strategicValue+
      Math.min(35,target.committed*.15)-Math.min(240,threat*95)-
      target.distance*.9;
    if(value>score||(value===score&&(chosen===null||target.tile<chosen))){
      chosen=target.tile;score=value;
    }
  }
  return score>=-20?chosen:null;
}

/** Preference for broad, connected neutral gains rather than narrow spikes. */
export function scoreRTSNeutralFront(input:{
  adjacentNeutral:number;secondRingNeutral:number;friendlySides:number;
  distance:number;otherCommitments:number;
}):number {
  const {adjacentNeutral,secondRingNeutral,friendlySides,distance,otherCommitments}=input;
  if(![adjacentNeutral,secondRingNeutral,friendlySides,distance,otherCommitments]
      .every(Number.isFinite))return -Infinity;
  return adjacentNeutral*11+secondRingNeutral*3+
    friendlySides*17-distance*1.8-otherCommitments*55;
}
