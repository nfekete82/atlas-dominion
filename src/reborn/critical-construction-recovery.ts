/** A deterministic stall detector for one already paid factory construction.
 * No building purchases or production permission changes; issuing a build order
 * remains the Simulation's ordinary paid command. This policy does not read
 * hidden opponents or decide whether a red attack should be launched.
 */
export interface ConstructionMonitor {
 buildingId:number;
 remaining:number;
 progressAt:number;
 issuedAt:number;
}
export interface ConstructionStatus {
 time:number;
 factoryId:number|null;
 remaining:number;
 observedSiege:boolean;
 livingArtillery:boolean;
 underAttack:boolean;
 urgentDefense:boolean;
 workerAvailable:boolean;
 workerAlreadyBuilding:boolean;
 workerHasActivePath:boolean;
}
export interface ConstructionRecovery {
 monitor?:ConstructionMonitor;
 retryBuild:boolean;
 reason:'no-factory'|'not-needed'|'progressing'|'watching'|'protected-work'|'en-route'|'retry-build';
}
export function criticalConstructionRecovery(status:ConstructionStatus,monitor?:ConstructionMonitor):ConstructionRecovery {
 const {time,factoryId,remaining}=status;
 if(factoryId===null||!Number.isFinite(remaining)||remaining<=0)
  return {retryBuild:false,reason:'no-factory'};
 const fresh=!monitor||monitor.buildingId!==factoryId||remaining<monitor.remaining-.001;
 const next:ConstructionMonitor=fresh
  ?{buildingId:factoryId,remaining,progressAt:time,issuedAt:0}
  :{...monitor,remaining};
 const reply=(reason:ConstructionRecovery['reason']):ConstructionRecovery=>({monitor:next,retryBuild:false,reason});
 if(fresh)return reply('progressing');
 if(!status.observedSiege||status.livingArtillery)return reply('not-needed');
 if(status.underAttack||status.urgentDefense||!status.workerAvailable)return reply('protected-work');
 if(time-next.progressAt<24||time-next.issuedAt<24)return reply('watching');
 if(status.workerAlreadyBuilding&&status.workerHasActivePath&&time-next.progressAt<90)return reply('en-route');
 return {monitor:{...next,issuedAt:time},retryBuild:true,reason:'retry-build'};
}
export function validConstructionMonitor(m:unknown,time:number):boolean{
 if(m===undefined)return true;
 if(!m||typeof m!=='object')return false;
 const o=m as Partial<ConstructionMonitor>;
 return Number.isSafeInteger(o.buildingId)&&(o.buildingId??-1)>=0&&
  typeof o.remaining==='number'&&Number.isFinite(o.remaining)&&o.remaining>0&&
  typeof o.progressAt==='number'&&Number.isFinite(o.progressAt)&&o.progressAt>=0&&o.progressAt<=time+.001&&
  typeof o.issuedAt==='number'&&Number.isFinite(o.issuedAt)&&o.issuedAt>=0&&o.issuedAt<=time+.001;
}
