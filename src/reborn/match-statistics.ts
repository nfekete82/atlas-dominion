import {unitKinds,type UnitKind} from './catalog.js';
import type {Faction} from './config.js';

/** Authoritative counts independent of spending, score and graphics. */
export interface FactionStatistics {
 earnedCredits:number;
 peakIncome:number;
 producedUnits:number;
 deployedUnits:Record<UnitKind,number>;
 peakArmy:number;
}
export interface MatchStatistics {version:1;partial?:boolean;factions:[FactionStatistics,FactionStatistics]}
const zero=():Record<UnitKind,number>=>Object.fromEntries(unitKinds.map(k=>[k,0])) as Record<UnitKind,number>;
const faction=():FactionStatistics=>({earnedCredits:0,peakIncome:0,producedUnits:0,deployedUnits:zero(),peakArmy:0});
export const newMatchStatistics=():MatchStatistics=>({version:1,factions:[faction(),faction()]});
export const countDeployed=(s:MatchStatistics,owner:Faction,kind:UnitKind,concurrent:number):void=>{
 const record=s.factions[owner];record.deployedUnits[kind]++;
 record.peakArmy=Math.max(record.peakArmy,concurrent);
};
export const countProduced=(s:MatchStatistics,owner:Faction):void=>{s.factions[owner].producedUnits++;};
export const countIncome=(s:MatchStatistics,owner:Faction,credits:number):void=>{
 const record=s.factions[owner];record.earnedCredits+=credits;record.peakIncome=Math.max(record.peakIncome,credits);
};
export const mostDeployed=(stat:FactionStatistics):{kind:UnitKind;count:number}|null=>{
 const entries=unitKinds.map(kind=>({kind,count:stat.deployedUnits[kind]}))
  .sort((a,b)=>b.count-a.count||unitKinds.indexOf(a.kind)-unitKinds.indexOf(b.kind));
 return entries[0]?.count?entries[0]:null;
};
const safe=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0&&(n as number)<=1e9;
export function validMatchStatistics(s:unknown):s is MatchStatistics{
 if(!s||typeof s!=='object')return false;
 const data=s as MatchStatistics;
 return data.version===1&&(data.partial===undefined||typeof data.partial==='boolean')&&Array.isArray(data.factions)&&data.factions.length===2&&
 data.factions.every(f=>f&&safe(f.earnedCredits)&&safe(f.peakIncome)&&safe(f.producedUnits)&&safe(f.peakArmy)&&
   f.peakArmy<=96&&f.peakIncome<=f.earnedCredits&&f.deployedUnits&&typeof f.deployedUnits==='object'&&
   unitKinds.every(k=>safe(f.deployedUnits[k]))&&
   f.producedUnits<=unitKinds.reduce((n,k)=>n+f.deployedUnits[k],0));
}
