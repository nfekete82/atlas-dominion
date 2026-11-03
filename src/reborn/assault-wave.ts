import {distance,type Point} from './config.js';

/** Deterministic readiness gate for paid, already selected units. The caller
 * supplies only its own roster plus observations. No fog or enemy lookup. */
export interface WaveReadiness {
 defended:boolean;
 selectedGround:number;
 readyGround:number;
 elapsed:number;
 /** Paid, living ground-force strength. Legacy callers may omit these. */
 selectedStrength?:number;
 readyStrength?:number;
 /** Known turrets require artillery or a separately validated overrun. */
 siegeSupported?:boolean;
}
export interface WaveDecision {ready:boolean;required:number;reason:'open-front'|'small-force'|'assembled'|'combat-ready'|'bounded-wait'|'assembling'}
export function assaultWaveDecision(x:WaveReadiness):WaveDecision {
 const planned=Math.max(0,Math.floor(x.selectedGround));
 const ready=Math.max(0,Math.floor(x.readyGround));
 if(!x.defended)return {ready:true,required:0,reason:'open-front'};
 // Three or four units cannot wait for hypothetical reinforcements that do
 // not exist. Base assault doctrine still decides if they can attack at all.
 if(planned<5)return {ready:true,required:0,reason:'small-force'};
 const required=Math.min(planned,Math.max(4,Math.ceil(planned*.7)));
 if(ready>=required)return {ready:true,required,reason:'assembled'};
 // A ready armored vanguard can carry most of the army's paid firepower.
 // Do not delay it for distant light units, but never bypass siege safety.
 if(x.siegeSupported===true&&ready>=4&&
   Number.isFinite(x.selectedStrength)&&Number.isFinite(x.readyStrength)&&
   (x.selectedStrength??0)>0&&
   (x.readyStrength??0)>=Math.max(8,(x.selectedStrength??0)*.8))
  return {ready:true,required,reason:'combat-ready'};
 // No permanent stalemate: leave after a bounded rally if base combat
 // assessment already judges the *arrived* force sufficient.
 if(x.elapsed>=42)return {ready:true,required,reason:'bounded-wait'};
 return {ready:false,required,reason:'assembling'};
}

/** Stage independent reinforcements behind the moving main force. The
 * existing attack-move order retains defensive fire; it is not a silent move.
 * No unit positions except own active group are consumed. */
export function reinforcementStagingPoint(front:Point,objective:Point,home:Point):Point {
 const d=distance(front,objective);
 if(!Number.isFinite(d)||d<220)return {...front};
 const vx=(objective.x-front.x)/d,vy=(objective.y-front.y)/d;
 const rear={x:front.x-vx*170,y:front.y-vy*170};
 // Avoid sending reinforcements back across their HQ when the column has
 // barely left home. Rejoin at the active line in that case.
 return distance(home,rear)>=distance(home,front)+150?{...front}:rear;
}

/** Launch a healthy, already-forward paid squad on an adjacent, publicly neutral
 * bastion instead of ordering it BACK to a rear-area rally. Only own-unit
 * positions and observed enemy threats are inputs; no fog-hidden inference.
 * Fortified or enemy-owned sectors must keep the full siege/assault doctrine. */
export interface ForwardCaptureMember {
 id:number; ground:boolean; healthFraction:number;
 distanceToMission:number; distanceToRally:number;
}
export interface ForwardCaptureReadiness {
 enabled:boolean; mapVersion:number; time:number; phase:string; phaseSeconds:number;
 missionKind:string; sectorOwner:number; knownGunCover:boolean;
 observedDefenders:number; homeUnderAttack:boolean;
 members:readonly ForwardCaptureMember[];
}
export function forwardCaptureVanguard(x:ForwardCaptureReadiness):number[]{
 if(!x.enabled||x.mapVersion!==11||x.time<40||x.time>330||
  !['gather','regroup'].includes(x.phase)||
  x.phase==='regroup'&&x.phaseSeconds<6||
  x.missionKind!=='capture'||x.sectorOwner!==-1||
  x.knownGunCover||x.observedDefenders>0||x.homeUnderAttack)return [];
 const front=x.members.filter(m=>m.ground&&m.healthFraction>=.6&&
   m.distanceToMission<=520&&m.distanceToMission>=60&&
   m.distanceToRally>350&&m.distanceToRally>m.distanceToMission+80)
  .sort((a,b)=>a.distanceToMission-b.distanceToMission||a.id-b.id);
 // Do not trick the assault doctrine into sending a lone scout or tank;
 // at least three healthy, PAID ground combatants must already be forward.
 return front.length>=3?front.slice(0,8).map(m=>m.id):[];
}
