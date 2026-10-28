import {unitSpec,type UnitKind} from './catalog.js';

export const VETERANCY_THRESHOLDS=[0,100,250,500] as const;
export const VETERANCY_NAMES=['Rekrut','Veteran','Elite','Held'] as const;
/** Rates reward applied work, not animation events. XP remains cumulative at max rank. */
export const XP_RULES={damage:.1,kill:20,heal:.25,repair:.2,build:2,completion:20,max:1_000_000_000} as const;
export type XpReason='damage'|'kill'|'heal'|'repair'|'build'|'completion';
export interface Experienced {kind?:UnitKind;xp?:number}
export function sanitizeXp(value:unknown):number{return typeof value==='number'&&Number.isFinite(value)?Math.min(XP_RULES.max,Math.max(0,value)):0;}
export function getVeterancyLevel(xp:unknown):0|1|2|3 {const n=sanitizeXp(xp);return n>=500?3:n>=250?2:n>=100?1:0;}
export function gainUnitXp(unit:Experienced,amount:number,_reason:XpReason):void {
 if(Number.isFinite(amount)&&amount>0)unit.xp=sanitizeXp(sanitizeXp(unit.xp)+amount);
}
export interface VeterancyModifiers {fireRate:number;damage:number;healRate:number;healRange:number;repairRate:number;buildRate:number}
// Frozen rank tables avoid allocations in combat/support hot paths. Base catalog values never change.
const modifiers=(fireRate=1,damage=1,healRate=1,healRange=1,repairRate=1,buildRate=1):Readonly<VeterancyModifiers>=>Object.freeze({fireRate,damage,healRate,healRange,repairRate,buildRate});
const infantry=[modifiers(),modifiers(1.08),modifiers(1.12,1.08),modifiers(1.16,1.12)];
const vehicles=[modifiers(),modifiers(1.04),modifiers(1.06,1.03),modifiers(1.08,1.05)];
const medics=[modifiers(),modifiers(1,1,1.1),modifiers(1,1,1.15,1.1),modifiers(1,1,1.2,1.15)];
const engineers=[modifiers(),modifiers(1,1,1,1,1.1),modifiers(1,1,1,1,1.15,1.1),modifiers(1,1,1,1,1.2,1.15)];
export function getVeterancyModifiers(unit:Experienced):Readonly<VeterancyModifiers> {
 return (unit.kind==='medic'?medics:unit.kind==='engineer'?engineers:unitSpec(unit).group==='Infanterie'?infantry:vehicles)[getVeterancyLevel(unit.xp)];
}
export function veterancyBonuses(unit:Experienced):string {
 const m=getVeterancyModifiers(unit),parts:string[]=[];
 const add=(n:number,label:string)=>{if(n>1)parts.push(`+${Math.round((n-1)*100)} % ${label}`);};
 add(m.fireRate,'Feuerrate');add(m.damage,'Schaden');add(m.healRate,'Heilrate');add(m.healRange,'Heilreichweite');add(m.repairRate,'Reparaturrate');add(m.buildRate,'Bautempo');return parts.join(' · ')||'Noch keine Rangboni';
}
