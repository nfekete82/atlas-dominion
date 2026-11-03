/** A secondary raid is worth doing only if real, healthy, already-paid
 * combatants remain on the main line. The old emergency comeback rule
 * detached 2 of 5 fighters whenever behind by 2 sectors; that is often
 * exactly when a force cannot afford to split. */
export interface RaidReadiness {
  fighters:number;
  mainScreen:number;
  eligibleRaiders:number;
  normalDoctrine:boolean;
  behindByTwoSectors:boolean;
  observedHomeThreat:boolean;
}
export function selectiveRaidAllowed(x:RaidReadiness):boolean{
 if(x.observedHomeThreat||x.eligibleRaiders<2)return false;
 if(x.normalDoctrine)return x.mainScreen>=5;
 // Do not turn economic deficit into a suicidal two-soldier mission.
 // The safe comeback exception still permits an opportunistic flank.
 return x.behindByTwoSectors&&x.fighters>=8&&x.mainScreen>=5;
}
