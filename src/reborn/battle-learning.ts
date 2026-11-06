/** Local, bounded campaign experience. Tactical inputs must be observed or public. */
import type {Point} from './config.js';
export type LessonTactic='overrun'|'siege'|'maneuver'|'flank'|'defense';
export interface Lesson {tactic:LessonTactic;guns:number;force:number;wins:number;losses:number;score:number;unsupportedSiegeLosses?:number}
export interface ActiveLesson {sector:number;tactic:LessonTactic;guns:number;force:number;at:number;initialUnits:number;initialHP:number;progress:number;siegeWeapons?:number;objective?:number|null;target?:Point}
export interface Experience {version:1;records:Lesson[];active?:ActiveLesson;held?:number[];lastLostSector?:number}
export const newExperience=():Experience=>({version:1,records:[]});
const tactics:readonly LessonTactic[]=['overrun','siege','maneuver','flank','defense'];
export function forceBucket(n:number){return n>=16?3:n>=9?2:n>=5?1:0}
const gunBucket=(n:number)=>Math.min(3,Math.max(0,Math.floor(n)));
export function lessonScore(s:Experience,tactic:LessonTactic,guns:number,force:number):number {
 const bucket=gunBucket(guns),strength=forceBucket(force);
 const r=s.records.find(r=>r.tactic===tactic&&r.guns===bucket&&r.force===strength);
 if(!r)return 0;
 const samples=r.wins+r.losses;
 return samples<2?Math.max(-.15,Math.min(.15,r.score/(samples+2))):Math.max(-.3,Math.min(.3,r.score/(samples+2)));
}
/** Track only actual outcomes, never infer combat from unseen enemy units. */
export function recordLesson(s:Experience,tactic:LessonTactic,guns:number,force:number,success:boolean,retained=1):void {
 const bucket=gunBucket(guns),strength=forceBucket(force);
 let r=s.records.find(v=>v.tactic===tactic&&v.guns===bucket&&v.force===strength);
 if(!r){r={tactic,guns:bucket,force:strength,wins:0,losses:0,score:0};s.records.push(r);}
 if(success)r.wins++;else r.losses++;
 const left=Math.max(0,Math.min(1,retained));
 r.score=Math.max(-20,Math.min(20,r.score+(success?1:-1)-(1-left)*.75));
 s.records=s.records.slice(-36);
}
export function finishExperience(s:Experience,success:boolean,remainingHP:number):void {
 const a=s.active;if(!a)return;
 const retained=Math.max(0,Math.min(1,remainingHP/Math.max(1,a.initialHP)));
 recordLesson(s,a.tactic,a.guns,a.force,success,retained);
 // Count only a witnessed failed attack against known guns with no paid
 // artillery. Older saves without siegeWeapons provide no such evidence.
 if(!success&&a.guns>0&&a.siegeWeapons===0){
  const record=s.records.find(r=>r.tactic===a.tactic&&r.guns===gunBucket(a.guns)&&r.force===forceBucket(a.force));
  if(record)record.unsupportedSiegeLosses=Math.min(20,(record.unsupportedSiegeLosses??0)+1);
 }
 s.active=undefined;
}
/** Public territory ownership can reveal that a defended bastion was lost;
 * no fogged troops or hidden structures are consulted or stored. */
export function observeOwnedLosses(s:Experience,owned:readonly number[],force:number):number[]{
 const next=[...new Set(owned)].sort((a,b)=>a-b),before=s.held;
 s.held=next;
 if(!before)return [];
 const lost=before.filter(id=>!next.includes(id));
 for(const id of lost){recordLesson(s,'defense',0,force,false);s.lastLostSector=id;}
 return lost;
}
/** A small, bounded strategic bias, never an override of route or safety checks. */
export function learnedMissionBias(s:Experience,tactic:'siege'|'maneuver',guns:number,force:number):number {
 return -650*lessonScore(s,tactic,guns,force);
}
export function defenseLessonsLost(s:Experience):number {
 return s.records.filter(r=>r.tactic==='defense').reduce((n,r)=>n+r.losses,0);
}
/** Transfer *only* anonymized numerical results, no map IDs, orders or units. */
export function portableExperience(s:Experience|undefined):Experience {
 return {version:1,records:s?.records.map(r=>({...r})).slice(-36)??[]};
}
export function readPortableExperience(raw:unknown):Experience|undefined {
 if(!raw||typeof raw!=='object')return undefined;
 const p=raw as Experience;
 if(p.active!==undefined||p.held!==undefined||p.lastLostSector!==undefined||!validExperience(p,0,64))return undefined;
 return portableExperience(p);
}
export function validExperience(raw:unknown,time:number,sectors:number,withinWorld:(p:Point)=>boolean=(p)=>p.x<=3762&&p.y<=3762):boolean {
 if(raw===undefined)return true;
 const s=raw as Experience,id=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0,
 num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,
 tactic=(t:unknown)=>tactics.includes(t as LessonTactic),
 point=(p:Point|undefined)=>p===undefined||!!p&&num(p.x)&&num(p.y)&&withinWorld(p);
 return !!s&&s.version===1&&Array.isArray(s.records)&&s.records.length<=36&&s.records.every(r=>tactic(r.tactic)&&id(r.guns)&&r.guns<=3&&id(r.force)&&r.force<=3&&id(r.wins)&&id(r.losses)&&typeof r.score==='number'&&Number.isFinite(r.score)&&Math.abs(r.score)<=20&&(r.unsupportedSiegeLosses===undefined||(id(r.unsupportedSiegeLosses)&&r.unsupportedSiegeLosses<=20)))
 &&(s.held===undefined||(Array.isArray(s.held)&&s.held.length<=sectors&&new Set(s.held).size===s.held.length&&s.held.every(v=>id(v)&&v<sectors)))
 &&(s.lastLostSector===undefined||(id(s.lastLostSector)&&s.lastLostSector<sectors))
 &&(s.active===undefined||(id(s.active.sector)&&s.active.sector<sectors&&tactic(s.active.tactic)&&id(s.active.guns)&&id(s.active.force)&&num(s.active.at)&&s.active.at<=time+.001&&id(s.active.initialUnits)&&num(s.active.initialHP)&&num(s.active.progress)&&(s.active.siegeWeapons===undefined||(id(s.active.siegeWeapons)&&s.active.siegeWeapons<=64))&&point(s.active.target)&&(s.active.objective===undefined||s.active.objective===null||id(s.active.objective))));
}
/** Prior losses raise the required conventional overmatch; wins lower it. */
/** Recorded failed unsupported assaults raise the bar for repeating a rush.
 * The AI may still attack with overwhelming real strength, never with hidden intel. */
export function unsupportedSiegeLosses(s:Experience):number {
 return s.records.reduce((total,r)=>total+(r.unsupportedSiegeLosses??0),0);
}
export function canOverrun(ownPower:number,enemyPower:number,units:number,guns:number,experience:Experience):boolean {
 if(!guns||units<7||ownPower<=0)return false;
 const multiplier=2.0+Math.min(1.25,unsupportedSiegeLosses(experience)*.75)-lessonScore(experience,'overrun',guns,units);
 return ownPower>=Math.max(1,enemyPower)*multiplier;
}
