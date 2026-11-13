/** Rotated real navigation blockers matching one 108-wide concrete wall.
 * Extra samples close the gaps between the ends while retaining existing
 * circular building collision and backwards compatible saves.
 */
export type WallFacing=0|1|2|3;
export function wallColliderSamples(p:{x:number;y:number;facing?:WallFacing},
 facing:WallFacing=p.facing??0,radius=24):{x:number;y:number;radius:number}[]{
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return [-33,0,33].map(offset=>({
  x:p.x+offset*c,y:p.y-offset*s,radius
 }));
}
