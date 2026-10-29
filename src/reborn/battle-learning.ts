/** Bounded, deterministic per-save experience. Only observed opposing strength enters decisions. */
export type LessonTactic='overrun'|'siege'|'maneuver';
export interface Lesson {tactic:LessonTactic;guns:number;force:number;wins:number;losses:number;score:number}
export interface Experience {version:1;records:Lesson[];active?:{sector:number;tactic:LessonTactic;guns:number;force:number;at:number;initialUnits:number;initialHP:number;progress:number}}
export const newExperience=():Experience=>({version:1,records:[]});
export function forceBucket(n:number){return n>=16?3:n>=9?2:n>=5?1:0}
export function lessonScore(s:Experience,tactic:LessonTactic,guns:number,force:number):number {
 const bucket=Math.min(3,Math.max(0,guns)),strength=forceBucket(force);
 const matches=s.records.filter(r=>r.tactic===tactic&&r.guns===bucket&&r.force===strength);
 if(!matches.length)return 0;
 const r=matches[0],samples=r.wins+r.losses;
 return samples<2?Math.max(-.15,Math.min(.15,r.score/(samples+2))):Math.max(-.3,Math.min(.3,r.score/(samples+2)));
}
export function finishExperience(s:Experience,success:boolean,remainingHP:number):void {
 const a=s.active;if(!a)return;
 const guns=Math.min(3,a.guns),force=forceBucket(a.force);
 let r=s.records.find(v=>v.tactic===a.tactic&&v.guns===guns&&v.force===force);
 if(!r){r={tactic:a.tactic,guns,force,wins:0,losses:0,score:0};s.records.push(r);}
 const retained=Math.max(0,Math.min(1,remainingHP/Math.max(1,a.initialHP)));
 if(success)r.wins++;else r.losses++;
 r.score=Math.max(-20,Math.min(20,r.score+(success?1:-1)-(1-retained)*.75));
 s.records=s.records.slice(-36);s.active=undefined;
}
export function validExperience(raw:unknown,time:number,sectors:number):boolean {
 if(raw===undefined)return true;
 const s=raw as Experience,id=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0,
 num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,
 tactic=(t:unknown)=>['overrun','siege','maneuver'].includes(t as string);
 return !!s&&s.version===1&&Array.isArray(s.records)&&s.records.length<=36&&s.records.every(r=>tactic(r.tactic)&&id(r.guns)&&r.guns<=3&&id(r.force)&&r.force<=3&&id(r.wins)&&id(r.losses)&&typeof r.score==='number'&&Number.isFinite(r.score)&&Math.abs(r.score)<=20)
 &&(s.active===undefined||(id(s.active.sector)&&s.active.sector<sectors&&tactic(s.active.tactic)&&id(s.active.guns)&&id(s.active.force)&&num(s.active.at)&&s.active.at<=time+.001&&id(s.active.initialUnits)&&num(s.active.initialHP)&&num(s.active.progress)));
}
/** Expected attrition, not an unconditional headcount threshold. */
export function canOverrun(ownPower:number,enemyPower:number,units:number,guns:number,experience:Experience):boolean {
 if(!guns||units<7||ownPower<=0)return false;
 const multiplier=2.0-lessonScore(experience,'overrun',guns,units);
 return ownPower>=Math.max(1,enemyPower)*multiplier;
}
