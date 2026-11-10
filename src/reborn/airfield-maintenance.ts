/** Deterministic, simulation-owned flightline and two-bay hangar geometry.
 * Local +Z is the apron/front of the hangar, matching buildingFacingAngle.
 * No Three.js dependency: saved aircraft retain their exact docking positions. */
export type AirfieldBay=0|1;
export type AirfieldPhase='approach'|'landing'|'taxi'|'repair'|'ready'|'takeoff';
export interface AirfieldPoint {x:number;y:number}
export interface AirfieldSite extends AirfieldPoint {facing?:0|1|2|3}
export interface AirfieldService {
  baseId:number;bay:AirfieldBay;phase:AirfieldPhase;elapsed:number;
  /** World-space start of the current landing leg. */
  from?:AirfieldPoint;
  /** Previously paid-for HP remaining; no free repairs between credits. */
  paidHp:number;
}
export const AIRFIELD_BAYS=2;
export const AIRFIELD_REPAIR_HP_PER_CREDIT=4;
export const AIRFIELD_REPAIR_FRACTION_PER_SECOND=.01;
export const AIRFIELD_LANDING_SECONDS=3.4;
export const AIRFIELD_TAXI_SECONDS=6;
export const AIRFIELD_TAKEOFF_SECONDS=6;
const headings=[0,Math.PI,Math.PI/2,Math.PI*1.5] as const;
const dockX=(bay:AirfieldBay)=>bay===0?-151:-26;
export type AirfieldWaypoint='approach'|'touchdown'|'taxi'|'door'|'dock'|'departure';
export function airfieldPoint(base:AirfieldSite,waypoint:AirfieldWaypoint,bay:AirfieldBay=0):AirfieldPoint {
 const local={
  // The visible asphalt continues well beyond the hangars, so aircraft
  // land on the long strip before taxiing onto the side apron.
  approach:{x:132,z:505},touchdown:{x:132,z:212},
  taxi:{x:132,z:24},door:{x:dockX(bay),z:24},
  dock:{x:dockX(bay),z:-88},departure:{x:132,z:505}
 }[waypoint];
 const yaw=headings[base.facing??0],c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:base.x+local.x*c+local.z*s,y:base.y-local.x*s+local.z*c};
}
export function airfieldLerp(a:AirfieldPoint,b:AirfieldPoint,t:number):AirfieldPoint {
 const f=Math.max(0,Math.min(1,t));
 return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
export function airfieldTaxiPoint(base:AirfieldSite,bay:AirfieldBay,fraction:number,depart=false):AirfieldPoint {
 const t=Math.max(0,Math.min(1,fraction));
 const sections:AirfieldWaypoint[]=depart
  ?['dock','door','taxi','departure']:['touchdown','taxi','door','dock'];
 const stops=[0,.34,.70,1];
 const i=t<stops[1]?0:t<stops[2]?1:2;
 return airfieldLerp(airfieldPoint(base,sections[i],bay),
  airfieldPoint(base,sections[i+1],bay),(t-stops[i])/(stops[i+1]-stops[i]));
}
export function validAirfieldService(service:unknown,size:number):service is AirfieldService {
 if(!service||typeof service!=='object')return false;
 const s=service as Partial<AirfieldService>;
 const point=(p:AirfieldPoint)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=0&&p.y>=0&&p.x<=size&&p.y<=size;
 return Number.isSafeInteger(s.baseId)&&s.baseId!>=0&&(s.bay===0||s.bay===1)&&
  ['approach','landing','taxi','repair','ready','takeoff'].includes(s.phase??'')&&
  Number.isFinite(s.elapsed)&&s.elapsed!>=0&&s.elapsed!<=12&&
  Number.isFinite(s.paidHp)&&s.paidHp!>=0&&s.paidHp!<AIRFIELD_REPAIR_HP_PER_CREDIT+1e-6&&
  (s.from===undefined||point(s.from));
}
