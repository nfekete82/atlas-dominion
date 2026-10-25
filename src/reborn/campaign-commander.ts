import {distance,type Point} from './config.js';
import type {Memory,Simulation,Unit} from './simulation.js';

export type CampaignPhase='opening'|'expansion'|'buildup'|'offensive'|'siege'|'endgame'|'emergencyDefense';
export interface WarMission extends Point {kind:'capture'|'structure'|'hunt';sector:number;objective:number|null;since:number;progressAt:number;distance:number;hp:number}
export interface ReconTask extends Point {unit:number;since:number}
export interface CampaignState {version:1;phase:CampaignPhase;phaseSince:number;mission?:WarMission;recon:ReconTask[];survey:{x:number;y:number;at:number}[];intel:{id:number;seenAt:number}[];aborted:number}
export const newCampaign=():CampaignState=>({version:1,phase:'opening',phaseSince:0,recon:[],survey:[],intel:[],aborted:0});
export function campaignPhase(s:CampaignState,phase:CampaignPhase,time:number):void{if(s.phase!==phase){s.phase=phase;s.phaseSince=time;}}
/** The commander's inputs are own possessions, public sectors, fog and observed
 * memories. Never resolve an unseen enemy ID against the live simulation. */
export function knownBuildings(g:Simulation):Memory[]{return g.memories[1].filter(m=>m.owner===0&&m.hp>0);}
export function refreshIntelligence(g:Simulation,s:CampaignState):void{
 const known=knownBuildings(g);
 s.intel=s.intel.filter(i=>known.some(m=>m.id===i.id));
 for(const m of known)if(g.canSee(1,m)){
  const i=s.intel.find(i=>i.id===m.id);if(i)i.seenAt=g.time;else s.intel.push({id:m.id,seenAt:g.time});
 }
 s.survey=s.survey.filter(p=>g.time-p.at<180).slice(-64);
}
/** Stable goals survive captures: a remembered HQ in an already owned sector
 * remains a war objective until its destruction has actually been observed. */
export function chooseMission(g:Simulation,s:CampaignState,origin:Point):WarMission|undefined{
 const buildings=knownBuildings(g),old=s.mission;
 if(old){
  const remembered=old.objective===null?undefined:buildings.find(b=>b.id===old.objective);
  const enemy=old.kind==='hunt'?g.units.find(u=>u.id===old.objective&&u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)):undefined;
  const valid=old.kind==='capture'?g.territories[old.sector]?.owner!==1:old.kind==='structure'?!!remembered:!!enemy;
  if(valid&&g.time-old.progressAt<100){
   if(remembered){old.x=remembered.x;old.y=remembered.y;if(remembered.hp<old.hp){old.progressAt=g.time;old.hp=remembered.hp;}}
   if(enemy){old.x=enemy.x;old.y=enemy.y;}
   // A newly observed tower covering an HQ approach is a concrete reason to
   // interrupt that mission; ordinary score fluctuations are not.
   const blocker=old.kind==='capture'?buildings.find(b=>b.territory===old.sector&&b.kind==='headquarters'||b.kind==='turret'&&distance(b,old)<660)
    :old.kind==='structure'&&remembered?.kind!=='turret'?buildings.find(b=>b.kind==='turret'&&distance(b,old)<660):undefined;
   if(!blocker)return old;
   return s.mission={kind:'structure',x:blocker.x,y:blocker.y,sector:blocker.territory,objective:blocker.id,hp:blocker.hp,since:g.time,progressAt:g.time,distance:distance(origin,blocker)};
  }else if(valid)s.aborted++;
 }
 const owned=g.territories.filter(t=>t.owner===1).length;
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind));
 const fieldArmy=army.length>=5&&army.some(u=>['tank','artillery','gunship'].includes(u.kind));
 const choices:{kind:WarMission['kind'];p:Point;sector:number;objective:number|null;hp:number;score:number}[]=[];
 for(const b of buildings){
  const blocking=b.kind==='turret'&&buildings.some(other=>['headquarters','barracks','factory','airfield'].includes(other.kind??'')&&distance(other,b)<660);
  const value=blocking?2100:b.kind==='headquarters'?1900:b.kind==='turret'?1200:['barracks','factory','airfield'].includes(b.kind??'')?1450:700;
  choices.push({kind:'structure',p:b,sector:b.territory,objective:b.id,hp:b.hp,score:distance(origin,b)-value});
 }
 for(const t of g.territories)if(t.owner!==1&&t.neighbors.some(id=>g.territories[id].owner===1))
  choices.push({kind:'capture',p:t.point,sector:t.id,objective:null,hp:0,score:distance(origin,t.point)-t.income*10+(t.owner===0?(fieldArmy&&owned>=2?-900:1300):0)});
 if(!choices.length)for(const u of g.units)if(u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u))
  choices.push({kind:'hunt',p:u,sector:g.territories.reduce((a,b)=>distance(u,a.point)<distance(u,b.point)?a:b).id,objective:u.id,hp:u.hp,score:distance(origin,u)});
 choices.sort((a,b)=>a.score-b.score||a.sector-b.sector||(a.objective??0)-(b.objective??0));
 const next=choices[0];
 return s.mission=next?{kind:next.kind,x:next.p.x,y:next.p.y,sector:next.sector,objective:next.objective,hp:next.hp,since:g.time,progressAt:g.time,distance:distance(origin,next.p)}:undefined;
}
/** Coarse, deterministic fog frontiers. Sampling terrain is public navigation
 * knowledge; importance uses public territory control, never hidden bases. */
export function reconGoal(g:Simulation,s:CampaignState,u:Unit,danger:(p:Point)=>number):Point|undefined{
 const task=s.recon.find(t=>t.unit===u.id);
 if(task&&g.time-task.since<65&&!g.canSee(1,task)&&danger(task)<3)return task;
 if(task){s.survey.push({x:task.x,y:task.y,at:g.time});s.survey=s.survey.slice(-64);s.recon=s.recon.filter(t=>t!==task);}
 const candidates:{p:Point;score:number}[]=[],step=g.world.size/12;
 for(let y=step/2;y<g.world.size;y+=step)for(let x=step/2;x<g.world.size;x+=step){
  const p={x,y};if(g.canSee(1,p)||danger(p)>3||s.recon.some(t=>distance(t,p)<step*1.5)||s.survey.some(t=>distance(t,p)<step*.7))continue;
  if(!g.world.walkable(p,[],0)&&!['scout','gunship'].includes(u.kind))continue;
  const sector=g.territories.reduce((a,b)=>distance(p,a.point)<distance(p,b.point)?a:b);
  const stale=s.intel.some(i=>g.time-i.seenAt>90&&knownBuildings(g).some(b=>b.id===i.id&&distance(b,p)<500));
  candidates.push({p,score:distance(u,p)+(g.hasExplored(1,p)?2500:0)-(sector.owner===0?1800:0)-(stale?350:0)});
 }
 candidates.sort((a,b)=>a.score-b.score||a.p.y-b.p.y||a.p.x-b.p.x);
 const goal=candidates[0]?.p;if(goal)s.recon.push({...goal,unit:u.id,since:g.time});return goal;
}
export function validCampaign(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):boolean{
 if(raw===undefined)return true;const s=raw as CampaignState,num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,at=(n:unknown)=>num(n)&&(n as number)<=time+.001,id=(n:unknown)=>Number.isInteger(n)&&(n as number)>=0;
 return !!s&&s.version===1&&['opening','expansion','buildup','offensive','siege','endgame','emergencyDefense'].includes(s.phase)&&at(s.phaseSince)&&id(s.aborted)
  &&Array.isArray(s.recon)&&s.recon.length<=16&&s.recon.every(t=>point(t)&&id(t.unit)&&at(t.since))
  &&Array.isArray(s.survey)&&s.survey.length<=65&&s.survey.every(p=>point(p)&&at(p.at))
  &&Array.isArray(s.intel)&&s.intel.length<=128&&s.intel.every(i=>id(i.id)&&at(i.seenAt))
  &&(s.mission===undefined||(point(s.mission)&&['capture','structure','hunt'].includes(s.mission.kind)&&id(s.mission.sector)&&s.mission.sector<sectors&&(s.mission.objective===null||id(s.mission.objective))&&at(s.mission.since)&&at(s.mission.progressAt)&&num(s.mission.distance)&&num(s.mission.hp)));
}
