/** Cosmetic wrecks are ephemeral, not part of the saved or navigable world.
 * Keep strict caps and use age-based cleanup to avoid months of black debris.
 */
export const WRECK_LIFETIME_SECONDS=21;
export const WRECK_CAP=24;
export const WRECK_CAP_LITE=12;
export const CRASH_LIFETIME_SECONDS=1.45;
export const CRASH_CAP=6;
export const isWreckableUnit=kind=>
 ['tank','rover','artillery','scout','bomber'].includes(kind);
export const isAircraftWreck=kind=>kind==='scout'||kind==='bomber';
export function addWreckRecord(records,unit,max=WRECK_CAP){
 if(!isWreckableUnit(unit.kind)||!Number.isFinite(unit.x)||!Number.isFinite(unit.y))return false;
 records.push({kind:unit.kind,x:unit.x,y:unit.y,yaw:unit.angle||0,
  age:0,ttl:WRECK_LIFETIME_SECONDS});
 if(records.length>max)records.shift();
 return true;
}
export function advanceWreckRecords(records,dt){
 if(!(dt>0))return false;
 let updated=false;
 for(const wreck of records){wreck.age+=dt;updated=true;}
 for(let i=records.length-1;i>=0;i--)
  if(records[i].age>=records[i].ttl)records.splice(i,1);
 return updated;
}
export const wreckSink=record=>{
 const left=record.ttl-record.age;
 return left<2?Math.max(0,2-left)*4:0;
};
