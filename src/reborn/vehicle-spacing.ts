import {unitSpec,type UnitKind} from './catalog.js';
import {distance,type Point} from './config.js';

/** Units keep a wider formation by default instead of creating destinations
 * inside one another. In a restricted passage this is only a preference:
 * collision/pathfinding can use the actual radius without the extra gap. */
export function formationSlotPitch(members:readonly {kind:UnitKind}[]):number{
 const largest=members.reduce((span,u)=>{
  const spec=unitSpec(u);
  if(spec.flying||spec.group!=='Fahrzeuge')return span;
  return Math.max(span,spec.width*1.17);
 },27);
 return Math.min(124,Math.max(27,largest));
}
export function vehicleSpacingGap(a:{kind:UnitKind},b:{kind:UnitKind}){
 const aa=unitSpec(a),bb=unitSpec(b);
 const hard=aa.radius+bb.radius+1;
 const vehicles=aa.group==='Fahrzeuge'&&bb.group==='Fahrzeuge'&&!aa.flying&&!bb.flying;
 // Soft comfort padding, never a pathfinding obstacle.
 return {hard,comfortable:hard+(vehicles?Math.min(42,Math.max(23,Math.min(aa.width,bb.width)*.42)):0)};
}
/** Do not push a vehicle backwards away from its current route just to
 * preserve cosmetic spacing. Hard radius overlap still gets resolved. */
export function preservesVehicleProgress(unit:Point&{moving:boolean;path:Point[];orders:Point[]},
 delta:Point):boolean {
 if(!unit.moving)return true;
 const goal=unit.path[0]??unit.orders[0];
 if(!goal)return true;
 const dx=goal.x-unit.x,dy=goal.y-unit.y;
 const forward=dx*delta.x+dy*delta.y;
 return forward>=-Math.hypot(dx,dy)*Math.hypot(delta.x,delta.y)*.12;
}

/** A legal sideways waypoint around a blocking stationary vehicle.
 * The caller supplies real collision and line-of-sight navigation checks;
 * this function never tunnels through rock/building geometry. */
export function vehicleYieldWaypoint(
 at:Point,target:Point,blocker:Point,gap:number,
 valid:(p:Point)=>boolean
):Point|null {
 const dx=target.x-at.x,dy=target.y-at.y,length=Math.hypot(dx,dy);
 if(length<5)return null;
 const forward={x:dx/length,y:dy/length};
 const side={x:-forward.y,y:forward.x};
 const span=Math.max(58,Math.min(115,gap*1.18));
 const ahead=Math.min(100,Math.max(45,gap*.9));
 const candidates=[-1,1].map(sign=>({
  x:at.x+side.x*span*sign+forward.x*ahead,
  y:at.y+side.y*span*sign+forward.y*ahead
 })).filter(p=>distance(p,blocker)>=gap*.85&&valid(p));
 if(!candidates.length)return null;
 // Prefer the side that puts more distance between the tank and obstacle,
 // tie-break deterministically by order, not Math.random().
 return candidates.sort((a,b)=>distance(b,blocker)-distance(a,blocker))[0];
}
