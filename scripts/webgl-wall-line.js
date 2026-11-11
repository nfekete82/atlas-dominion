/** Single-click and drag-to-build concrete walls, grid-free and deterministic.
 * Native wall runs along its local X axis; facing 2 rotates it 90 degrees.
 * The small seam between 108-unit slabs leaves precisely 4 units for posts.
 * All costs/placement/worker paths remain authoritative in Simulation.build.
 */
export const WALL_SEGMENT_SPACING=112;
export const WALL_DRAG_MAX_SEGMENTS=18;
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
