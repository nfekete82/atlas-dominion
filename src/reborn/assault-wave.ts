import {distance,type Point} from './config.js';

/** Deterministic readiness gate for paid, already selected units. The caller
 * supplies only its own roster plus observations. No fog or enemy lookup. */
export interface WaveReadiness {
 defended:boolean;
 selectedGround:number;
 readyGround:number;
 elapsed:number;
}
export interface WaveDecision {ready:boolean;required:number;reason:'open-front'|'small-force'|'assembled'|'bounded-wait'|'assembling'}
export function assaultWaveDecision(x:WaveReadiness):WaveDecision {
 const planned=Math.max(0,Math.floor(x.selectedGround));
 const ready=Math.max(0,Math.floor(x.readyGround));
 if(!x.defended)return {ready:true,required:0,reason:'open-front'};
 // Three or four units cannot wait for hypothetical reinforcements that do
 // not exist. Base assault doctrine still decides if they can attack at all.
 if(planned<5)return {ready:true,required:0,reason:'small-force'};
 const required=Math.min(planned,Math.max(4,Math.ceil(planned*.7)));
 if(ready>=required)return {ready:true,required,reason:'assembled'};
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
