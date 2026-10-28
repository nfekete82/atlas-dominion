import {UNITS,type UnitKind} from './catalog.js';
/** Retire the legacy gunship without dropping units, IDs, paid queues or AI state.
 * Work on a clone; subsequent strict save validation remains authoritative. */
export function migrateTransportRoster(raw:unknown):unknown {
 if(!raw||typeof raw!=='object')return raw;
 const save=structuredClone(raw) as Record<string,any>;
 // Migrate only known roster-bearing fields; orders, IDs and unrelated data are preserved.
 const replace=(value:any):any=>{
  if(value==='gunship')return 'scout';
  if(Array.isArray(value))return value.map(replace);
  if(value&&typeof value==='object'){
   const out:Record<string,any>={};
   for(const [key,v] of Object.entries(value)){
    const k=key==='gunship'?'scout':key,next=replace(v);
    if(k==='scout'&&typeof next==='number'&&typeof out[k]==='number')out[k]=Number.isSafeInteger(next)&&next>=0&&Number.isSafeInteger(out[k])&&out[k]>=0?out[k]+next:NaN;
    else out[k]=next;
   }return out;
  }return value;
 };
 if(Array.isArray(save.units))for(const unit of save.units){
  if(unit?.kind!=='gunship')continue;
  unit.kind='scout';unit.hp=unit.hp/380*360;
  // A legacy gunship fired single rounds; a transport uses three-round bursts.
  delete unit.burst;unit.cooldown=Math.max(unit.cooldown??0,.6);
  if(!save.rosterVersion)unit.hp=unit.hp/360*160;
 }
 if(Array.isArray(save.bases))for(const base of save.bases){
  if(!Array.isArray(base?.queueTypes)||!Array.isArray(base.queue))continue;
  // Preserve the original paid amount for cancellation/refund, including old saves.
  if(base.queueTypes.includes('gunship')&&!base.queueCosts)base.queueCosts=base.queueTypes.map((k:string)=>k==='gunship'?750:UNITS[k as UnitKind]?.cost);
  base.queueTypes.forEach((kind:string,i:number)=>{
   if(kind!=='gunship')return;
   // Only valid old durations are transformed. Invalid values still fail validation.
   if(base.queue[i]!==18)return;
   base.queue[i]=14;if(i===0)base.production=base.production/18*14;
   base.queueTypes[i]='scout';
  });
 }
 if(save.ai)save.ai=replace(save.ai);
 return save;
}
