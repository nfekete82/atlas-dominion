/** One terrain-level resolver for aircraft and vehicle maintenance visuals.
 * The 3D apron is a level structure anchored to the building's terrain height,
 * while regular actors continue to follow the actual dune heightfield.
 * No gameplay coordinates or damage/collision code is modified. */
const clamp=x=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a+(b-a)*clamp(t);

export const AIRFIELD_HANGAR_FLOOR_HEIGHT=3.2;
export const FACTORY_LIFT_HEIGHT=9.5;

export function serviceVisualGround(unit,terrain,baseTerrain,rangeToService=Infinity){
 if(!Number.isFinite(baseTerrain))return terrain;
 const airport=unit.airfieldService;
 if(airport){
  const phase=airport.phase,height=clamp(unit.flightHeight??1);
  if(phase==='approach')return terrain;
  if(phase==='landing')return mix(baseTerrain+AIRFIELD_HANGAR_FLOOR_HEIGHT,terrain,height);
  if(phase==='takeoff')return mix(baseTerrain+AIRFIELD_HANGAR_FLOOR_HEIGHT,terrain,height);
  return baseTerrain+AIRFIELD_HANGAR_FLOOR_HEIGHT;
 }
 const factory=unit.factoryService;
 if(factory){
  if(factory.phase==='approach')return terrain;
  const fixed=baseTerrain+FACTORY_LIFT_HEIGHT;
  if(factory.phase==='parking')return mix(fixed,terrain,clamp(rangeToService/85));
  return fixed;
 }
 return terrain;
}
/** A released ground vehicle lowers smoothly off its service lift. */
export function approachGroundHeight(previous,target,dt){
 if(!Number.isFinite(previous))return target;
 if(!(dt>0))return previous;
 const next=mix(previous,target,Math.min(1,dt*3));
 return Math.abs(next-target)<.03?target:next;
}
