/** Observable, deterministic battle decisions; no hidden enemies, free healing,
 * health boosts or invisible target IDs. Applied only after ordinary range,
 * team, line-of-sight and visibility checks. */
export type SquadTargetMode='classic'|'coordinated';
export type InfantrySurvivalMode='classic'|'adaptive';

export interface FocusObservation {
  hp:number;
  maxHp:number;
  ownDamage:number;
  // Number of living nearby allies which are already targeting this opponent.
  assigned:number;
  alliedDps:number;
}
/** Return a distance-equivalent modifier; negative is preferred. A damaged
 * enemy is attractive if the next legitimate shot can finish it. Avoid the
 * opposite extreme where six shooters all overkill one nearly dead target. */
export function focusFireDistanceAdjustment(x:FocusObservation):number{
 const hp=Math.max(0,x.hp),damage=Math.max(0,x.ownDamage);
 const assigned=Math.max(0,Math.min(5,Math.trunc(x.assigned)));
 if(hp<=0||damage<=0)return 0;
 const finish=hp<=damage*1.15?-38:hp/x.maxHp<.38?-22:0;
 const saturation=x.alliedDps>=hp*1.65?76:0;
 return finish-Math.min(66,assigned*22)+saturation;
}
/** Only pull an actual damaged infantryman out of combat when a living medic
 * can realistically receive him, other frontline fighters remain and the
 * unit is not already under a deliberate tactical withdrawal. */
export function shouldWithdrawInfantry(input:{
 kind:string; hp:number;maxHp:number;medicWithin:number;
 friendlyScreen:number;underFire:boolean;alreadyRecovering:boolean;
}):boolean{
 if(!['infantry','heavy'].includes(input.kind)||input.hp<=0||input.maxHp<=0
   ||input.alreadyRecovering||!input.underFire
   ||input.medicWithin>500||input.friendlyScreen<2)return false;
 const ratio=input.hp/input.maxHp;
 return ratio<(input.kind==='heavy'?.31:.45);
}
