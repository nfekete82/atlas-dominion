import {distance,type Point} from './config.js';
import {UNITS,type UnitKind} from './catalog.js';
import type {Simulation} from './simulation.js';
import type {Loss} from './tactical-ai.js';
import type {BattleState} from './battle-response.js';
export type EnemyStrategy='unknown'|'tower'|'infantry'|'armor'|'air'|'expansion'|'attrition';
export interface AdaptiveState {
 version:1;strategy:EnemyStrategy;confidence:number;since:number;updatedAt:number;switches:number;
 counts:{infantry:number;armor:number;air:number;towers:number};
 sightings:{id:number;kind:UnitKind;seenAt:number}[];
 ownership:{at:number;enemy:number;own:number}[];
}
export const newAdaptive=():AdaptiveState=>({version:1,strategy:'unknown',confidence:0,since:0,updatedAt:0,switches:0,counts:{infantry:0,armor:0,air:0,towers:0},sightings:[],ownership:[]});
/** Observed roles are remembered briefly for strategy, never used as hidden
 * tactical targets or current enemy positions/HP. Territory control is public. */
export function updateAdaptive(g:Simulation,s:AdaptiveState,home:Point,losses:Loss[],battle?:BattleState):void{
 s.sightings=s.sightings.filter(v=>g.time-v.seenAt<=45);
 const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u));
 for(const u of visible){const old=s.sightings.find(v=>v.id===u.id);if(old){old.seenAt=g.time;old.kind=u.kind;}else s.sightings.push({id:u.id,kind:u.kind,seenAt:g.time});}
 s.sightings=s.sightings.slice(-96);
 const count=(k:UnitKind[])=>s.sightings.filter(u=>k.includes(u.kind)).length;
 const towers=g.memories[1].filter(b=>b.owner===0&&b.kind==='turret'&&b.hp>0).length;
 s.counts={infantry:count(['infantry','heavy']),armor:count(['rover','tank','artillery']),air:count(['gunship','bomber']),towers};
 const enemy=g.territories.filter(t=>t.owner===0).length,own=g.territories.filter(t=>t.owner===1).length;
 if(!s.ownership.length||g.time-s.ownership.at(-1)!.at>=10)s.ownership.push({at:g.time,enemy,own});s.ownership=s.ownership.filter(v=>g.time-v.at<=90).slice(-10);
 const recent=s.ownership.find(v=>g.time-v.at<=40),growth=recent?Math.max(0,enemy-recent.enemy):0;
 const pressure=visible.some(u=>distance(u,home)<750)?1.6:1;
 const failures=battle?.fronts.filter(f=>g.time-f.at<90).reduce((n,f)=>n+Math.max(0,f.failures-1),0)??0;
 const recentLosses=losses.filter(l=>g.time-l.at<60).length;
 const scores:Record<EnemyStrategy,number>={unknown:0,tower:towers>=2?towers*2.5:towers,
  infantry:s.counts.infantry>=3?s.counts.infantry*pressure:0,armor:s.counts.armor>=1?s.counts.armor*2.8*pressure:0,
  air:s.counts.air*4,expansion:growth>=2||enemy>=own+2?growth*3+Math.max(0,enemy-own)*2:0,
  attrition:failures>=2&&recentLosses>=3?failures*2+recentLosses:0};
 const best=(Object.keys(scores) as EnemyStrategy[]).sort((a,b)=>scores[b]-scores[a]||a.localeCompare(b))[0];
 const candidate=scores[best]>0?best:'unknown',current=scores[s.strategy];
 if(candidate!==s.strategy&&(s.strategy==='unknown'||g.time-s.since>=12&&(scores[candidate]>current+1.5||current===0))){s.strategy=candidate;s.since=g.time;s.switches++;}
 s.confidence=scores[s.strategy]?Math.min(.95,scores[s.strategy]/(scores[s.strategy]+3)):0;s.updatedAt=g.time;
}
export function validAdaptive(raw:unknown,time:number):boolean{
 if(raw===undefined)return true;const s=raw as AdaptiveState,num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0,at=(v:unknown)=>num(v)&&(v as number)<=time+.001,id=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0;
 return !!s&&s.version===1&&['unknown','tower','infantry','armor','air','expansion','attrition'].includes(s.strategy)&&num(s.confidence)&&s.confidence<=1&&at(s.since)&&at(s.updatedAt)&&id(s.switches)
  &&!!s.counts&&['infantry','armor','air','towers'].every(k=>id(s.counts[k as keyof typeof s.counts]))
  &&Array.isArray(s.sightings)&&s.sightings.length<=96&&s.sightings.every(v=>id(v.id)&&Object.hasOwn(UNITS,v.kind)&&at(v.seenAt))
  &&Array.isArray(s.ownership)&&s.ownership.length<=10&&s.ownership.every(v=>at(v.at)&&id(v.enemy)&&id(v.own));
}

export interface MissionRatingInput {base:number;distance:number;income:number;missingCredits:number;ownHP:number;foeDPS:number;visiblePower:number;ownPower:number;towers:number;siege:boolean;age:number;failures:number;capture:boolean;enemyOwned:boolean}
/** Utility costs are in travel-equivalent units. A counter's real purchase and
 * travel time matters more than a nominal building prize when a siege is unready. */
export function rateMission(p:MissionRatingInput,strategy:EnemyStrategy):{score:number;expectedLoss:number;budgetCost:number}{
 const closing=p.towers?(p.siege ? .6 : 4):1.5;
 const expectedLoss=Math.min(1,p.foeDPS*closing/Math.max(100,p.ownHP));
 const budgetCost=p.missingCredits/Math.max(1,p.income)*10;
 const superiority=Math.max(0,p.visiblePower-p.ownPower)/Math.max(1,p.ownPower);
 const unsuitable=p.towers>=2&&!p.siege?1400:0;
 const score=p.base+expectedLoss*900+budgetCost*6+Math.min(700,superiority*500)+unsuitable+Math.min(500,p.age*2)+p.failures*450
  -(strategy==='expansion'&&p.capture&&p.enemyOwned?650:0)-(strategy==='attrition'&&p.capture?350:0);
 return {score,expectedLoss,budgetCost};
}
