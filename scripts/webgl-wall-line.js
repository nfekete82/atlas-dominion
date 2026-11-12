/** Single-click and drag-to-build concrete walls, grid-free and deterministic.
 * Native wall runs along its local X axis; facing 2 rotates it 90 degrees.
 * The small seam between 108-unit slabs leaves precisely 4 units for posts.
 * All costs/placement/worker paths remain authoritative in Simulation.build.
 */
export const WALL_SEGMENT_SPACING=112;
export const WALL_DRAG_MAX_SEGMENTS=18;
/** Pixel motion to switch from one-wall click to a multi-wall drag. */
export const WALL_DRAG_SLOP=9;
export function wallLinePlacements(start,end,max=WALL_DRAG_MAX_SEGMENTS){
 if(!start||!end||!Number.isFinite(start.x)||!Number.isFinite(start.y)||
    !Number.isFinite(end.x)||!Number.isFinite(end.y))return [];
 const dx=end.x-start.x,dy=end.y-start.y;
 const horizontal=Math.abs(dx)>=Math.abs(dy);
 const distance=horizontal?Math.abs(dx):Math.abs(dy);
 const sign=Math.sign(horizontal?dx:dy)||1;
 const count=Math.max(1,Math.min(max,Math.floor((distance+36)/WALL_SEGMENT_SPACING)+1));
 const facing=horizontal?0:2;
 return Array.from({length:count},(_,i)=>({
  point:{x:start.x+(horizontal?sign*i*WALL_SEGMENT_SPACING:0),
   y:start.y+(horizontal?0:sign*i*WALL_SEGMENT_SPACING)},
  facing,index:i
 }));
}

/** Turret-to-wall join at a small visible gap, outside the turret collider. */
export const WALL_TOWER_ENDPOINT_OFFSET=104;
export const WALL_TOWER_CORNER_OFFSET=75;
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const signed=(a,b)=>Math.sign(b-a)||1;
const leg=(from,to,facing,max)=>{
 const axis=facing===0?'x':'y',cross=facing===0?'y':'x';
 const distance=Math.abs(to[axis]-from[axis]);
 const count=Math.min(max,Math.floor(distance/WALL_SEGMENT_SPACING)+1);
 if(count<1)return [];
 const step=count>1?distance/(count-1):0;
 const first=count>1?from[axis]:(from[axis]+to[axis])/2;
 const direction=signed(from[axis],to[axis]);
 return Array.from({length:count},(_,i)=>({
  point:{[axis]:first+i*step*direction,[cross]:from[cross]},
  facing,index:i
 }));
};
/** Aim the run toward a turret but stop before its physical foundation.
 * The ordinary buildError() still decides whether the connecting slab is
 * legal (terrain, units, credits, enemy towers, etc.).
 */
export function wallLineFromTurret(tower,end,max=WALL_DRAG_MAX_SEGMENTS){
 if(!finitePoint(tower)||!finitePoint(end))return [];
 const horizontal=Math.abs(end.x-tower.x)>=Math.abs(end.y-tower.y);
 const axis=horizontal?'x':'y';
 const start={x:tower.x,y:tower.y};
 start[axis]+=signed(tower[axis],end[axis])*WALL_TOWER_ENDPOINT_OFFSET;
 return wallLinePlacements(start,end,max);
}
export function wallLineToTurret(start,tower,max=WALL_DRAG_MAX_SEGMENTS){
 if(!finitePoint(tower)||!finitePoint(start))return [];
 const horizontal=Math.abs(tower.x-start.x)>=Math.abs(tower.y-start.y);
 const axis=horizontal?'x':'y';
 const end={x:tower.x,y:tower.y};
 end[axis]-=signed(start[axis],tower[axis])*WALL_TOWER_ENDPOINT_OFFSET;
 return wallLinePlacements(start,end,max);
}
/** Two owned turrets become wall endpoints. Small X/Z offsets use one
 * straight wall; general placements take a right-angled L route because
 * gameplay walls support only cardinal facings. Corner geometry never
 * overlaps, so the authoritative collision test remains unchanged.
 */
export function wallLineBetweenTurrets(a,b,max=WALL_DRAG_MAX_SEGMENTS){
 if(!finitePoint(a)||!finitePoint(b)||a.id!=null&&a.id===b.id)return [];
 const dx=b.x-a.x,dy=b.y-a.y,adx=Math.abs(dx),ady=Math.abs(dy);
 if(adx<2*WALL_TOWER_ENDPOINT_OFFSET&&ady<2*WALL_TOWER_ENDPOINT_OFFSET)return [];
 const sx=signed(a.x,b.x),sy=signed(a.y,b.y),end=WALL_TOWER_ENDPOINT_OFFSET;
 const makeLeg=(from,to,facing)=>leg(from,to,facing,Math.max(0,max));
 let parts=[];
 if(ady<=26&&adx>2*end){
  const y=(a.y+b.y)*.5;
  parts=makeLeg({x:a.x+sx*end,y},{x:b.x-sx*end,y},0);
 }else if(adx<=26&&ady>2*end){
  const x=(a.x+b.x)*.5;
  parts=makeLeg({x,y:a.y+sy*end},{x,y:b.y-sy*end},2);
 }else{
  const corner=WALL_TOWER_CORNER_OFFSET;
  if(adx>=ady){
   // Horizontal from the first turret, then vertical into the second.
   if(adx>end+corner)
    parts.push(...makeLeg({x:a.x+sx*end,y:a.y},
     {x:b.x-sx*corner,y:a.y},0));
   if(ady>end+corner)
    parts.push(...makeLeg({x:b.x,y:a.y+sy*corner},
     {x:b.x,y:b.y-sy*end},2));
  }else{
   // Vertical first, then turn along X to the destination turret.
   if(ady>end+corner)
    parts.push(...makeLeg({x:a.x,y:a.y+sy*end},
     {x:a.x,y:b.y-sy*corner},2));
   if(adx>end+corner)
    parts.push(...makeLeg({x:a.x+sx*corner,y:b.y},
     {x:b.x-sx*end,y:b.y},0));
  }
 }
 return parts.slice(0,max).map((part,index)=>({...part,index}));
}
