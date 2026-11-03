/** Operational command layer: ONE strategic intention per macro pulse.
 * Outputs policies, not unit commands. Existing execution, recovery and
 * sight/combat systems remain the only authorities that move or attack.
 * Inputs contain only own forces, public sectors and RED-observed memories. */
export type OperationMode='expand'|'assault'|'siege'|'buildup'|'cleanup'|'defend';
export interface OperationSnapshot {mode:OperationMode;since:number;reason:string}
export interface OperationFront {
 sector:number;owner:number;income:number;routeLength:number;routeRisk:number;
 observedTower:boolean;observedHQ:boolean;visibleFighters:number;
 /** Positive RED sight on the capture point: fog is not proof of safety. */
 currentlyVisible:boolean;
}
export interface OperationView {
 at:number;livingFighters:number;hasArtillery:boolean;
 enemyHQEliminated:boolean;observedEnemyHQ:boolean;
 visibleHomeThreat:boolean;knownEnemyTowerCount:number;
 fronts:readonly OperationFront[];
}
export interface OperationDecision {next:OperationSnapshot;changed:boolean;openFront:number|null}
const isOpen=(f:OperationFront)=>f.owner!==1&&f.currentlyVisible&&!f.observedTower&&!f.observedHQ&&
 f.visibleFighters===0&&Number.isFinite(f.routeLength)&&f.routeLength>0&&
 f.routeLength<=2400&&Number.isFinite(f.routeRisk)&&f.routeRisk>=0&&f.routeRisk<7;
export function chooseOperation(view:OperationView,old?:OperationSnapshot):OperationDecision{
 const safe=view.fronts.filter(isOpen).sort((a,b)=>{
  const score=(f:OperationFront)=>f.routeLength+f.routeRisk*140-f.income*13-
   (f.owner===0?240:0);
  return score(a)-score(b)||a.sector-b.sector;
 });
 const front=safe[0]?.sector??null;
 let mode:OperationMode,reason:string;
 if(view.visibleHomeThreat){mode='defend';reason='observed-home-threat';}
 else if(view.enemyHQEliminated){mode='cleanup';reason='confirmed-hq-eliminated';}
 else if(view.livingFighters<2){mode='buildup';reason='no-viable-field-group';}
 else if(view.hasArtillery&&view.knownEnemyTowerCount>0){
  mode='siege';reason='paid-counter-ready';
 }
 else if(front!==null){
  mode='expand';reason='reachable-observed-open-front';
 }
 else if(view.observedEnemyHQ&&view.livingFighters>=5&&view.knownEnemyTowerCount===0){
  mode='assault';reason='observed-hq-and-strong-force';
 }
 else {mode='buildup';reason='await-paid-force-or-recon';}
 // A real threat, confirmed cleanup and paid siege counter are urgent. For
 // ordinary strategic switching avoid one-tick oscillation and mission churn.
 const urgent=mode==='defend'||mode==='cleanup'||mode==='siege';
 if(old&&old.mode!==mode&&!urgent&&view.at-old.since<24)
  return {next:old,changed:false,openFront:front};
 if(old?.mode===mode)return {next:old,changed:false,openFront:front};
 return {next:{mode,since:view.at,reason},changed:true,openFront:front};
}
export function operationBias(mode:OperationMode,candidate:{
 kind:'capture'|'structure'|'hunt';sector:number;objectiveKind?:string;
 exposedTower:boolean;openFront:boolean;
}):number{
 if(mode==='defend'||mode==='buildup')return 0;
 if(mode==='expand'){
  if(candidate.kind==='capture'&&candidate.openFront)return -3200;
  if(candidate.kind==='structure')return 1400;
 }
 if(mode==='siege'){
  if(candidate.kind==='structure'&&candidate.objectiveKind==='turret')return -2300;
  if(candidate.kind==='capture'&&candidate.exposedTower)return 1300;
 }
 if(mode==='assault'){
  if(candidate.kind==='structure'&&candidate.objectiveKind==='headquarters')return -2800;
 }
 if(mode==='cleanup'){
  if(candidate.kind==='structure'&&['factory','airfield','barracks'].includes(candidate.objectiveKind??''))return -1800;
 }
 return 0;
}
export function validOperation(raw:unknown,time:number):boolean{
 if(raw===undefined)return true;
 if(!raw||typeof raw!=='object')return false;
 const o=raw as Partial<OperationSnapshot>;
 return ['expand','assault','siege','buildup','cleanup','defend'].includes(o.mode??'')&&
  typeof o.since==='number'&&Number.isFinite(o.since)&&o.since>=0&&o.since<=time+.001&&
  typeof o.reason==='string'&&o.reason.length<=100;
}
