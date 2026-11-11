import type {Point,MapVersion} from './config.js';
import type {CanyonRuin} from './canyon-front.js';

/** Navigable, gentle 3D-only high ground. Visual height and gameplay bonuses
 * share the same deterministic field; no World.blocked or path grid mutation. */
export interface RollingHill extends Point { radius:number; peak:number }
/** Modest, symmetric ground-unit sight bonus on actual elevated positions.
 * A source still needs unobstructed line of sight: never reveals through cliffs.
 * Enabled only for the WebGL campaign's high-ground rules.
 */
export const HIGH_GROUND_SIGHT_MULTIPLIER=1.16;
const randomFor=(seed:number)=>{
 let state=(seed^0x67b9e517)>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const ease=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export function generateRollingHills(seed:number,version:MapVersion,size:number,
 sites:readonly Point[],ruins:readonly CanyonRuin[]):RollingHill[]{
 if(version<19)return [];
 const random=randomFor(seed),hills:RollingHill[]=[];
 // Sparse low relief between objectives; all climbs remain walkable.
 for(let trial=0;trial<280&&hills.length<10;trial++){
  const p={x:size*(.085+random()*.83),y:size*(.085+random()*.83)};
  const radius=175+random()*95,peak=26+random()*21;
  if(sites.some(site=>distance(p,site)<radius+165)||
     ruins.some(ruin=>distance(p,ruin)<radius+Math.hypot(ruin.width,ruin.depth)*.5+50)||
     hills.some(h=>distance(p,h)<radius+h.radius+110))continue;
  hills.push({...p,radius,peak});
 }
 return hills;
}
export function rollingHillHeight(hills:readonly RollingHill[],x:number,y:number):number{
 let height=0;
 for(const hill of hills){
  const d=Math.hypot(x-hill.x,y-hill.y);
  if(d>=hill.radius)continue;
  height=Math.max(height,hill.peak*ease(1-d/hill.radius));
 }
 return height;
}
export function standsOnHill(hills:readonly RollingHill[],p:Point):boolean{
 return hills.some(h=>Math.hypot(p.x-h.x,p.y-h.y)<h.radius*.42);
}
