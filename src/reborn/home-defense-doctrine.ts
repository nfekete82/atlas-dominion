/** Modern desert AI: protect real production before sacrificing paid infantry.
 * Pure policy: observed pressure, own losses and recorded failed fronts only.
 * No opponent roster, fog query, resources or free reinforcements.
 */
export interface HomeDefenseInput {
 fighters:number;time:number;recentLosses:number;recentFailures:number;
 lastFailureAt:number;observedHomePressure:boolean;defendedTarget:boolean;
 confirmedEndgame:boolean;
}
export interface HomeDefensePlan {
 guards:number;minimumReady:number;notBefore:number;allowSecondaryRaids:boolean;
 mode:'cleanup'|'defense'|'recover'|'buildup'|'probe';
}
export function homeDefensePlan(x:HomeDefenseInput):HomeDefensePlan {
 if(x.confirmedEndgame)return {guards:0,minimumReady:0,notBefore:0,allowSecondaryRaids:true,mode:'cleanup'};
 const fighters=Math.max(0,Math.floor(x.fighters));
 const failures=Math.max(0,Math.floor(x.recentFailures));
 const losses=Math.max(0,Math.floor(x.recentLosses));
 const setback=failures>0||losses>=2;
 const early=x.time<180;
 const base=fighters>=14?5:fighters>=9?4:fighters>=6?3:fighters>=3?2:fighters;
 // A beaten force needs surviving screens at the headquarters; a visible
 // intruder earns more guards, never imaginary instant defenders.
 const guards=Math.min(fighters,Math.max(early?2:1,base)+(setback?1:0)+(x.observedHomePressure?2:0));
 const minimumReady=setback?(x.defendedTarget?6:5):x.defendedTarget?5:4;
 const cooldown=failures?Math.max(0,x.lastFailureAt)+Math.min(75,32+failures*13):
  losses>=2?x.time+12:0;
 return {
  guards,minimumReady,
  notBefore:Math.max(early?65:0,cooldown),
  allowSecondaryRaids:!early&&!setback&&!x.observedHomePressure&&fighters>=12,
  mode:x.observedHomePressure?'defense':setback?'recover':early?'buildup':'probe'
 };
}
