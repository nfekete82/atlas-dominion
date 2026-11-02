import {distance,type Point} from './config.js';

/** Only opt-in experiments on the 4-bastion campaign. No resource, fog,
 * movement or damage changes; selectors consume only visible enemies and
 * publicly observable sector ownership. */
export type FrontDoctrine='classic'|'concentrated'|'sector-defense'|'tempo-only';
export function isCompactBattle(mapVersion:number,sectors:number,mode:FrontDoctrine):boolean{
 return mapVersion===11&&sectors===4&&(mode==='concentrated'||mode==='sector-defense');
}
export interface OwnedSector extends Point {id:number;owner:number}
export interface ObservedThreat extends Point {id:number;kind:string}
/** Compare threats at controlled bases with assaults on remote owned points.
 * Do not reveal enemies: caller must pass only ordinary visible enemy units. */
export function sectorDefenseAnchor(input:{
 territories:readonly OwnedSector[];
 visibleEnemies:readonly ObservedThreat[];
 home:Point;
 minFighters:number;
 engagedAttack:boolean;
}):Point|undefined{
 if(input.engagedAttack||input.minFighters<4)return;
 const sectors=input.territories.filter(t=>t.owner===1&&distance(t,input.home)>180);
 const options=sectors.flatMap(t=>input.visibleEnemies
  .filter(e=>distance(e,t)<255)
  .map(e=>({sector:t,enemy:e,score:distance(e,t)-distance(e,input.home)*.05})));
 options.sort((a,b)=>a.score-b.score||a.sector.id-b.sector.id||a.enemy.id-b.enemy.id);
 return options[0]?.sector;
}

/** Isolate earlier macro planning from the old failed barracks-first experiment.
 * The normal paid generator-first economy and all battle logic remain intact. */
export function fourBastionPlanningDelay(mapVersion:number,sectors:number,mode:FrontDoctrine,defaultDelay:number):number{
 return mapVersion===11&&sectors===4&&mode==='tempo-only'?6:defaultDelay;
}
