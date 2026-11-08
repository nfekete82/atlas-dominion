/** Shared camera/terrain-edge policy for the 3D renderer; never changes simulation bounds. */
export const edgeOverscan=size=>Math.min(160,Math.max(80,size*.025));
export const cameraEdgeReach=size=>Math.min(140,Math.max(70,size*.022));
/** For hard-black WebGL maps, let the CAMERA centre travel over the void.
 * Unit movement, minimap orders and the actual playable square stay fixed.
 * Capped so the user cannot lose the entire map through excessive panning. */
export const cameraBlackOverscan=size=>Math.min(750,Math.max(350,size*.145));

/** A right-click slightly beyond the visible sand should still select a legal
 * destination. Far-out clicks stay invalid, as do nonfinite intersections.
 * Obstacles/connected components are still resolved by Simulation.command(). */
export function snapToPlayableEdge(point,size,overscan=edgeOverscan(size)){
 if(!point||!Number.isFinite(size)||size<=24||!Number.isFinite(point.x)||!Number.isFinite(point.y))
  return null;
 if(point.x< -overscan||point.y< -overscan||
    point.x>size+overscan||point.y>size+overscan)return null;
 const limit=12;
 return {x:Math.min(size-limit,Math.max(limit,point.x)),
  y:Math.min(size-limit,Math.max(limit,point.y))};
}

/** Convert a camera ground-plane corner into a minimap coordinate.
 * Camera X/Z and simulation X/Y share exactly one world origin at size/2. */
export function worldToMinimap(x,z,size,width,height){
 return {x:(x+size/2)*width/size,y:(z+size/2)*height/size};
}
