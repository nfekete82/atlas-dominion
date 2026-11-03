/** Opportunistic sector control while an ordinary *paid* artillery purchase
 * is being prepared for an observed tower. Not a hidden-info reconnaissance
 * oracle: only public sector ownership, RED-observed enemies and remembered
 * defensive structures are passed by the caller.
 *
 * No credit, queue, unit, defense, savegame or weapon changes. Only selects an
 * alternative mission for a group that would otherwise rally against an
 * unsiegeable observed structure. */
export interface ParallelCaptureFront {
 id:number;owner:number;income:number;routeLength:number;routeRisk:number;
 rememberedFortification:boolean;visibleEnemyFighters:number;
}
export interface ParallelSiegeInput {
 enabled:boolean;mapVersion:number;time:number;
 siegeMissionAge:number;confirmedObservedTower:boolean;
 observedObjectiveDamage:boolean;confirmedEnemyHQDefeated:boolean;
 fieldFighters:number;livingArtillery:boolean;
 visibleHomeThreat:boolean;fronts:readonly ParallelCaptureFront[];
}
export function chooseParallelCapture(x:ParallelSiegeInput):number|null{
 if(!x.enabled||x.mapVersion!==11||x.time<70||
   x.siegeMissionAge<36||!x.confirmedObservedTower||
   x.observedObjectiveDamage||x.confirmedEnemyHQDefeated||
   x.fieldFighters<3||x.livingArtillery||x.visibleHomeThreat)return null;
 const candidates=x.fronts.filter(t=>t.owner!==1&&
   t.visibleEnemyFighters===0&&!t.rememberedFortification&&
   Number.isFinite(t.routeLength)&&t.routeLength>0&&t.routeLength<=2400&&
   Number.isFinite(t.routeRisk)&&t.routeRisk>=0&&t.routeRisk<6);
 candidates.sort((a,b)=>{
  const score=t=>t.routeLength+t.routeRisk*125-t.income*13-(t.owner===0?280:0);
  return score(a)-score(b)||a.id-b.id;
 });
 return candidates[0]?.id??null;
}
