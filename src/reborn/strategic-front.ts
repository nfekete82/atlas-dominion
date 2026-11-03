/** Small-map front discipline. The policy never changes unit statistics,
 * credits, fog, income, or the game's capture/attack rules.
 * It only decides how to assign real, existing troops.
 */
export type FrontPolicy='classic'|'concentrated';
export const concentrateFront=(version:number,policy:FrontPolicy):boolean=>version===11&&policy==='concentrated';

/** Capturing a second front with two detached soldiers is a bad trade if it
 * leaves too little strength for a defended primary sector. */
export function allowDetachedRaid(x:{small:boolean;available:number;front:number;observedThreat:number}):boolean{
 if(!x.small)return true;
 return x.available>=9&&x.front>=6&&x.observedThreat===0;
}
/** Keep an accessible strategic reserve only in proportion to forces and real
 * observed threats. Never empty the HQ during a known emergency. */
export function strategicReserve(x:{small:boolean;count:number;enemyNearHome:boolean}):number{
 if(!x.small)return x.count>=8?2:x.count>=5?1:0;
 if(x.enemyNearHome)return Math.min(3,Math.ceil(x.count*.35));
 return x.count>=8?1:0;
}
/** Avoid repeated orders and unprotected trickles into the front. A paid
 * reinforcement joins on arrival; until then it rallies behind the army. */
export function frontReinforcementDistance(small:boolean):number{return small?210:280;}
export function frontStrengthRequired(x:{small:boolean;defended:boolean;readyCount:number;selectedCount:number;hasArmor:boolean;observedThreat:number}):boolean{
 if(!x.small)return true;
 if(x.selectedCount===0||x.readyCount===0)return false;
 if(!x.defended)return x.readyCount>=Math.min(2,x.selectedCount);
 return x.readyCount>=Math.min(5,x.selectedCount)&&
   x.readyCount>=Math.min(3,x.selectedCount)&&
   (x.hasArmor||x.readyCount>=4||x.observedThreat<=0);
}
