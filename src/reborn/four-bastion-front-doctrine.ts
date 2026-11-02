import {distance,type Point} from './config.js';

/** Only opt-in experiments on the 4-bastion campaign. No resource, fog,
 * movement or damage changes; selectors consume only visible enemies and
 * publicly observable sector ownership. */
export type FrontDoctrine='classic'|'concentrated'|'sector-defense'|'tempo-only'|'sector-priority'|'tempo-sector'|'fortify-early'|'fair-start';
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
 return mapVersion===11&&sectors===4&&mode==='fair-start'?0:
  mapVersion===11&&sectors===4&&(mode==='tempo-only'||mode==='tempo-sector')?6:defaultDelay;
}

/** An observed safe neutral income point should beat an early frontal HQ raid,
 * but never override a known gun or a confirmed endgame objective. Score is
 * measured in campaign preference units, not extra resources. */
export function neutralExpansionPreference(input:{
 mode:FrontDoctrine;mapVersion:number;sectors:number;neutral:boolean;
 observedDefender:boolean;observedTurret:boolean;endgame:boolean;
}):number{
 const x=input;
 return x.mapVersion===11&&x.sectors===4&&
  (x.mode==='sector-priority'||x.mode==='tempo-sector')&&
  x.neutral&&!x.observedDefender&&!x.observedTurret&&!x.endgame?-1900:0;
}

/** Pay for a real forward turret once RED actually owns a border bastion.
 * A turret is not spawned for free; the existing safe build-site search,
 * worker order, construction time and budget rules still apply. */
export function considerEarlyBorderFortification(x:{
 mapVersion:number;sectors:number;mode:FrontDoctrine;time:number;
 ownedForwardBastions:number;fighters:number;barracksReady:boolean;
}):boolean{
 return x.mapVersion===11&&x.sectors===4&&x.mode==='fortify-early'&&
  x.time>=55&&x.ownedForwardBastions>=1&&x.fighters>=3&&x.barracksReady;
}
