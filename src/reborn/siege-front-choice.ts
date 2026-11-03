/** Choose a legitimate *other* front before paying for a blocked siege.
 * Pure RED-side inputs: public owner/adjacency, routes, and remembered/visible
 * threats. Never implies that an unexplored route is genuinely undefended. */
export interface UnblockedFront{
 id:number;owner:number;income:number;adjacent:boolean;
 observedTowerCover:boolean;visibleDefenders:number;
 routeLength:number;routeRisk:number;
}
export function choosePreSiegeOpenFront(x:{
 enabled:boolean;mapVersion:number;time:number;
 missionKind:string;missionAge:number;progressAge:number;
 coveringObservedTower:boolean;hasArtillery:boolean;queuedArtillery:boolean;
 confirmedEndgame:boolean;homeThreat:boolean;fighters:number;
 fronts:readonly UnblockedFront[];
}):number|null{
 if(!x.enabled||x.mapVersion!==11||x.time<40||x.time>330||
  x.missionKind!=='structure'||x.missionAge<12||x.progressAge<12||
  !x.coveringObservedTower||x.hasArtillery||x.queuedArtillery||
  x.confirmedEndgame||x.homeThreat||x.fighters<4)return null;
 const open=x.fronts.filter(f=>f.owner!==1&&f.adjacent&&
  !f.observedTowerCover&&f.visibleDefenders===0&&
  Number.isFinite(f.routeLength)&&f.routeLength>0&&f.routeLength<=3000&&
  Number.isFinite(f.routeRisk)&&f.routeRisk>=0&&f.routeRisk<8);
 open.sort((a,b)=>
  (a.routeLength+a.routeRisk*110-a.income*10-(a.owner===0?260:0))-
  (b.routeLength+b.routeRisk*110-b.income*10-(b.owner===0?260:0))
  ||a.id-b.id);
 return open[0]?.id??null;
}
