import {RULES,distance,type Point} from './config.js';
import type {World} from './world.js';
export interface VisionSource extends Point {key:string;sight:number;close:number;air:boolean}
interface Entry {source:VisionSource;cells?:Uint16Array}
/** Derived, bounded cache of exact stationary sight masks. No enemy entities,
 * exploration, memory or visibility from a previous tick is reused. */
export class VisionCache {
 private terrain:Uint8Array|undefined;
 private sources=[new Map<string,Entry>(),new Map<string,Entry>()];
 invalidate():void{this.sources[0].clear();this.sources[1].clear();this.terrain=undefined;}
 update(world:World,owner:0|1,sources:VisionSource[],visible:Uint8Array):void{
  let changed=!this.terrain;
  if(this.terrain)for(let i=0;i<world.opaque.length;i++)if(this.terrain[i]!==world.opaque[i]){changed=true;break;}
  if(changed){this.sources[0].clear();this.sources[1].clear();this.terrain=world.opaque.slice();}
  const cache=this.sources[owner],active=new Set(sources.map(s=>s.key));
  for(const key of cache.keys())if(!active.has(key))cache.delete(key);
  visible.fill(0);
  for(const s of sources){
   const old=cache.get(s.key),same=old&&old.source.x===s.x&&old.source.y===s.y&&old.source.sight===s.sight&&old.source.close===s.close&&old.source.air===s.air;
   if(same&&old.cells){for(const i of old.cells)visible[i]=1;continue;}
   // Build a complete mask only after the source has actually stayed still.
   // Moving sources retain the original overlap-skipping ray cast.
   const cells:number[]|undefined=same?[]:undefined;
   const gx=Math.floor(s.x/world.cell),gy=Math.floor(s.y/world.cell),r=Math.ceil(s.sight/world.cell);
   for(let y=Math.max(0,gy-r);y<=Math.min(RULES.grid-1,gy+r);y++)for(let x=Math.max(0,gx-r);x<=Math.min(RULES.grid-1,gx+r);x++){
    const i=y*RULES.grid+x;if(!cells&&visible[i])continue;
    const p=world.center(i),d=distance(s,p);
    if(d<=s.sight&&(s.air||d<=s.close||world.sightLine(s,p))){visible[i]=1;cells?.push(i);}
   }
   const own=world.index(s);if(own>=0){visible[own]=1;cells?.push(own);}
   cache.set(s.key,{source:{...s},...(cells?{cells:Uint16Array.from(cells)}:{})});
  }
 }
}
