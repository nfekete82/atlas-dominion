import {buildingProps} from './building-decor.js';
import {propSiteClear} from './prop-placement.js';
import type {Simulation} from './simulation.js';

/** Keep the renderer's visibility/placement decisions authoritative without
 * requiring gameplay to import any texture or DOM presentation modules.
 * Only completed, live, visible service-yard props obstruct ground vehicles. */
export function visibleBasePropColliders(g:Simulation):{x:number;y:number;radius:number}[]{
 const obstacles:{x:number;y:number;radius:number}[]=[];
 for(const b of g.bases){
  if(b.hp<=0||b.buildRemaining>0)continue;
  for(const p of buildingProps(b.kind,b,b.radius,b.id,g.seed,b.facing??0))
   if(propSiteClear(p,p.size,g,{base:b.id}))
    obstacles.push({x:p.x,y:p.y,radius:p.size*.43});
 }
 return obstacles;
}
