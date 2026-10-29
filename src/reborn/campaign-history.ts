import type {Simulation} from './simulation.js';
import {validMatchStatistics,mostDeployed,type MatchStatistics,type FactionStatistics} from './match-statistics.js';
import type {UnitKind} from './catalog.js';

/** Pure tracking: real territory ownership changes, never inferred casualties. */
export type CampaignResult='running'|'victory'|'defeat'|'abandoned';
export interface CampaignReport {
 version:1;id:string;startedAt:string;updatedAt:string;endedAt?:string;
 seed:number;mapVersion:number;bastions:number;seconds:number;result:CampaignResult;
 enemyBastionsTaken:number;neutralBastionsTaken:number;ownBastionsLost:number;
 owners:number[];stats?:MatchStatistics;
}
const validDate=(s:unknown):s is string=>typeof s==='string'&&s.length<=40&&!Number.isNaN(Date.parse(s));
const nonnegative=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0;
export function validCampaignReport(raw:unknown):raw is CampaignReport{
 if(!raw||typeof raw!=='object')return false;
 const r=raw as CampaignReport;
 return r.version===1&&typeof r.id==='string'&&r.id.length>0&&r.id.length<110&&
 validDate(r.startedAt)&&validDate(r.updatedAt)&&(r.endedAt===undefined||validDate(r.endedAt))&&
 nonnegative(r.seed)&&nonnegative(r.mapVersion)&&r.mapVersion<=14&&
 nonnegative(r.bastions)&&r.bastions>=4&&r.bastions<=30&&
 Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<10000000&&
 ['running','victory','defeat','abandoned'].includes(r.result)&&
 [r.enemyBastionsTaken,r.neutralBastionsTaken,r.ownBastionsLost].every(nonnegative)&&
 Array.isArray(r.owners)&&r.owners.length===r.bastions&&r.owners.every(o=>[-1,0,1].includes(o))&&
 (r.stats===undefined||validMatchStatistics(r.stats));
}
let serial=0;
export function newCampaignReport(g:Simulation,now=new Date().toISOString()):CampaignReport{
 return {version:1,id:`${now}:${g.seed}:${++serial}`,startedAt:now,updatedAt:now,
  seed:g.seed>>>0,mapVersion:g.world.mapVersion,bastions:g.territories.length,
  seconds:g.time,result:'running',enemyBastionsTaken:0,neutralBastionsTaken:0,
  ownBastionsLost:0,owners:g.territories.map(t=>t.owner),stats:structuredClone(g.stats)};
}
export function observeCampaignReport(report:CampaignReport,g:Simulation,now=new Date().toISOString()):CampaignReport{
 if(report.result!=='running'||report.seed!==(g.seed>>>0)||report.mapVersion!==g.world.mapVersion||report.bastions!==g.territories.length)return report;
 // Loading an older save is a separate campaign session, not a second capture.
 if(g.time+.01<report.seconds)return report;
 for(let i=0;i<report.owners.length;i++){
  const from=report.owners[i],to=g.territories[i].owner;
  if(to===0&&from===1)report.enemyBastionsTaken++;
  else if(to===0&&from===-1)report.neutralBastionsTaken++;
  else if(from===0&&to===1)report.ownBastionsLost++;
  report.owners[i]=to;
 }
 report.seconds=g.time;report.updatedAt=now;report.stats=structuredClone(g.stats);
 if(g.status!=='playing')finishCampaignReport(report,g.status,now);
 return report;
}
export function finishCampaignReport(report:CampaignReport,result:Exclude<CampaignResult,'running'>,now=new Date().toISOString()):CampaignReport{
 if(report.result==='running'){report.result=result;report.updatedAt=now;report.endedAt=now;}
 return report;
}
export interface CampaignArchiveSummary {matches:number;victories:number;defeats:number;enemyCaptures:number;neutralCaptures:number;lostBastions:number}
export function summarizeCampaignArchive(reports:readonly CampaignReport[]):CampaignArchiveSummary{
 const completed=reports.filter(r=>r.result==='victory'||r.result==='defeat');
 return {matches:completed.length,victories:completed.filter(r=>r.result==='victory').length,
  defeats:completed.filter(r=>r.result==='defeat').length,
  enemyCaptures:reports.reduce((n,r)=>n+r.enemyBastionsTaken,0),
  neutralCaptures:reports.reduce((n,r)=>n+r.neutralBastionsTaken,0),
  lostBastions:reports.reduce((n,r)=>n+r.ownBastionsLost,0)};
}
const KEY='sandforge-campaign-reports-v1';
export function readCampaignReports():CampaignReport[]{
 try{const parsed:unknown=JSON.parse(localStorage.getItem(KEY)??'[]');
  return Array.isArray(parsed)?parsed.filter(validCampaignReport).slice(0,40):[];
 }catch{return [];}
}
export function writeCampaignReport(report:CampaignReport):void{
 if(!validCampaignReport(report))return;
 try{const reports=readCampaignReports().filter(r=>r.id!==report.id);
  reports.unshift({...report,owners:report.owners.slice(),stats:report.stats?structuredClone(report.stats):undefined});
  localStorage.setItem(KEY,JSON.stringify(reports.slice(0,40)));
 }catch{/* Browsers with disabled storage still permit normal gameplay. */}
}

/** Records can be compared between campaigns without treating missing old statistics as zero. */
export interface CampaignStatisticsRecords{
 topKind:{kind:UnitKind;count:number}|null;
 earnedTotal:number;producedTotal:number;
 bestCredits:{value:number;report:CampaignReport}|null;
 bestArmy:{value:number;report:CampaignReport}|null;
 bestProduction:{value:number;report:CampaignReport}|null;
 bestIncome:{value:number;report:CampaignReport}|null;
}
export function campaignStatisticsRecords(reports:readonly CampaignReport[],owner:0|1):CampaignStatisticsRecords{
 const valid=reports.filter(r=>r.stats&&validMatchStatistics(r.stats));
 const totals=new Map<UnitKind,number>();
 let earnedTotal=0,producedTotal=0;
 let bestCredits:CampaignStatisticsRecords['bestCredits']=null,
  bestArmy:CampaignStatisticsRecords['bestArmy']=null,
  bestProduction:CampaignStatisticsRecords['bestProduction']=null,
  bestIncome:CampaignStatisticsRecords['bestIncome']=null;
 for(const report of valid){
  const f=report.stats!.factions[owner];
  earnedTotal+=f.earnedCredits;producedTotal+=f.producedUnits;
  for(const kind of Object.keys(f.deployedUnits) as UnitKind[])totals.set(kind,(totals.get(kind)??0)+f.deployedUnits[kind]);
  if(!bestCredits||f.earnedCredits>bestCredits.value)bestCredits={value:f.earnedCredits,report};
  if(!bestArmy||f.peakArmy>bestArmy.value)bestArmy={value:f.peakArmy,report};
  if(!bestProduction||f.producedUnits>bestProduction.value)bestProduction={value:f.producedUnits,report};
  if(!bestIncome||f.peakIncome>bestIncome.value)bestIncome={value:f.peakIncome,report};
 }
 const top=valid.length?([...totals.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]):undefined;
 return {topKind:top&&top[1]>0?{kind:top[0],count:top[1]}:null,
  earnedTotal,producedTotal,bestCredits,bestArmy,bestProduction,bestIncome};
}
export function factionInReport(report:CampaignReport,owner:0|1):FactionStatistics|undefined{
 return report.stats?.factions[owner];
}
export {mostDeployed};
