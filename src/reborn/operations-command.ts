import type {UnitKind} from './catalog.js';

export type OperationPhase='assemble'|'commit'|'rebuild';
export type OperationRoster=Partial<Record<UnitKind,number>>;
export interface OperationOrder {
 version:1;
 sector:number;
 objective:number|null;
 phase:OperationPhase;
 since:number;
 wave:number;
 /** Desired counts include units already paid for in production queues. */
 roster:OperationRoster;
}
/** One durable task-force requirement shared by economics and command.
 * Mission inputs must come from public sectors / observed enemy intelligence. */
export function requiredTaskForce(defended:boolean,observedTowers:number):OperationRoster {
 if(observedTowers>0)return {infantry:3,heavy:1,medic:1,artillery:Math.min(2,observedTowers)};
 if(defended)return {infantry:3,heavy:1,medic:1,tank:1};
 return {infantry:3};
}
/** Mutates no state; consumers explicitly persist its result in the saved AI. */
export function advanceOperation(
 prior:OperationOrder|undefined,
 mission:{sector:number;objective:number|null},
 time:number,defended:boolean,observedTowers:number,
 phase:'gather'|'regroup'|'attack'|'defend'
):OperationOrder {
 const roster=requiredTaskForce(defended,observedTowers);
 if(!prior||prior.sector!==mission.sector||prior.objective!==mission.objective)
  return {version:1,sector:mission.sector,objective:mission.objective,phase:'assemble',since:time,wave:0,roster};
 const stage:OperationPhase=phase==='attack'?'commit':prior.phase==='commit'?'rebuild':prior.phase;
 return {...prior,roster,phase:stage,
  since:stage===prior.phase?prior.since:time,
  wave:stage==='commit'&&prior.phase!=='commit'?prior.wave+1:prior.wave};
}
/** Worker and emergency anti-air recruitment remain higher priority in the caller.
 * Never request a unit without an actual compatible, completed producer. */
export function nextTaskForcePurchase(
 order:OperationOrder|undefined,
 counts:Readonly<Partial<Record<UnitKind,number>>>,
 available:(kind:UnitKind)=>boolean
):UnitKind|null {
 if(!order)return null;
 for(const kind of ['infantry','heavy','artillery','medic','tank'] as const)
  if((counts[kind]??0)<(order.roster[kind]??0)&&available(kind))return kind;
 return null;
}
export function validOperation(x:unknown,time:number,sectors:number):boolean {
 if(x===undefined)return true;
 if(!x||typeof x!=='object')return false;
 const o=x as OperationOrder;
 if(o.version!==1||!Number.isInteger(o.sector)||o.sector<0||o.sector>=sectors
  ||o.objective!==null&&(!Number.isSafeInteger(o.objective)||o.objective<0)
  ||!['assemble','commit','rebuild'].includes(o.phase)
  ||!Number.isFinite(o.since)||o.since<0||o.since>time+.001
  ||!Number.isInteger(o.wave)||o.wave<0||o.wave>1000000
  ||!o.roster||typeof o.roster!=='object'||Array.isArray(o.roster))return false;
 const allowed=['infantry','heavy','artillery','medic','tank'];
 return Object.entries(o.roster).every(([kind,n])=>allowed.includes(kind)
  &&Number.isSafeInteger(n)&&n>=0&&n<=8);
}
