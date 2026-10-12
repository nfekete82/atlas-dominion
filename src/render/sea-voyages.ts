import {routeDistance,segmentKm} from '../engine/navigation.js';
import {MAP_WIDTH,WORLD_WIDTH,MAP_HEIGHT,WORLD_HEIGHT} from '../data/europe.js';
import type {AttackOrder,Point} from '../engine/game.js';

export interface VoyageGeometry {points:Point[];km:number[];length:number;}
export function voyageGeometry(cells:readonly number[]):VoyageGeometry {
  const points=cells.map(i=>({x:(i%MAP_WIDTH+.5)*WORLD_WIDTH/MAP_WIDTH,y:(Math.floor(i/MAP_WIDTH)+.5)*WORLD_HEIGHT/MAP_HEIGHT}));
  const km=[0];for(let i=1;i<cells.length;i++)km.push(km[i-1]+segmentKm(cells[i-1],cells[i]));
  return {points,km,length:routeDistance(cells)};
}
/** Only authoritative simulation ticks move ships, including on reduced motion.
 * Pausing and save/load therefore preserve the exact visible location.
 */
export function voyagePosition(order:AttackOrder,tick:number,geometry:VoyageGeometry):Point {
  const started=order.startedTick??tick,duration=Math.max(1,(order.arrivalTick??started+1)-started);
  let progress=(tick-started)/duration;
  if(order.returning){
    const turn=order.returnStartedTick??tick,end=order.returnArrivalTick??turn+1;
    progress=Math.min(1,(turn-started)/duration)*(1-Math.max(0,(tick-turn)/Math.max(1,end-turn)));
  }
  const distance=Math.max(0,Math.min(1,progress))*geometry.length;
  let end=1;while(end<geometry.km.length-1&&geometry.km[end]<distance)end++;
  const a=geometry.points[end-1],b=geometry.points[end];
  const t=(distance-geometry.km[end-1])/Math.max(.001,geometry.km[end]-geometry.km[end-1]);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
