/** The only repair platform sits beside the original factory, clear of the
 * production doorway. Historic bay=1 saves remain readable. */
export type FactoryRepairBay=0|1;
export type FactoryRepairPhase='approach'|'parking'|'repair'|'ready';
export interface FactoryService {
 baseId:number;bay:FactoryRepairBay;phase:FactoryRepairPhase;
 paidHp:number;
}
export interface FactorySite {x:number;y:number;facing?:0|1|2|3}
export const FACTORY_REPAIR_BAYS=1;
export const FACTORY_REPAIR_HP_PER_CREDIT=5;
export const FACTORY_REPAIR_FRACTION_PER_SECOND=.012;
export function factoryRepairPoint(site:FactorySite,bay:FactoryRepairBay,approach=false){
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][site.facing??0]??0;
 // Both historical bay values resolve to the same compact side workshop;
 // only bay 0 can be reserved for new repairs.
 const x=192,z=approach?160:45,c=Math.cos(angle),s=Math.sin(angle);
 return {x:site.x+x*c+z*s,y:site.y-x*s+z*c};
}
export function validFactoryService(input:unknown):input is FactoryService {
 if(!input||typeof input!=='object')return false;
 const v=input as Partial<FactoryService>;
 return Number.isSafeInteger(v.baseId)&&v.baseId!>=0&&(v.bay===0||v.bay===1)&&
  ['approach','parking','repair','ready'].includes(v.phase??'')&&
  Number.isFinite(v.paidHp)&&v.paidHp!>=0&&v.paidHp!<FACTORY_REPAIR_HP_PER_CREDIT+1e-6;
}
