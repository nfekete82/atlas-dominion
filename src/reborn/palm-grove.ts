import type {GroundDetail} from './battlefield-atmosphere.js';
import type {Simulation} from './simulation.js';
import {PropAtlas} from './prop-atlas.js';
import {environmentPropVisible} from './prop-placement.js';
import {seededRandom} from './world-generation.js';

export const PALM_ART_SCALE=1.34;
export type PalmDetail=GroundDetail&{mirrored?:boolean};
/** A deterministic presentation-only grove: 46% singles, 29% pairs, 25% trios.
 * Does not affect the terrain seed, saved simulation, obstacles or pathfinding.
 * Siblings have independent scale, flip and atlas frame selection. */
export function palmGroup(center:GroundDetail,seed:number,mapSize:number):PalmDetail[]{
 if(center.kind!=='palm')return [];
 const hash=(Math.imul(Math.round(center.x),73856093)^Math.imul(Math.round(center.y),19349663)^seed)>>>0;
 const random=seededRandom(hash),roll=random(),count=roll<.46?1:roll<.75?2:3;
 const first:PalmDetail={...center,radius:center.radius*(.89+random()*.27),variant:random(),mirrored:random()<.5};
 const trees:PalmDetail[]=[first];
 const heading=random()*Math.PI*2;
 for(let i=1;i<count;i++){
  const radius=center.radius*(.51+random()*.25),angle=heading+(i-1)*2.48+(random()-.5)*.6;
  const offset=center.radius*(1.45+random()*.38)+radius*.68;
  const x=center.x+Math.cos(angle)*offset,y=center.y+Math.sin(angle)*offset;
  // Trees never wrap off the world; an invalid sibling is simply omitted.
  if(x-radius*1.8<0||y-radius*1.8<0||x+radius*1.8>=mapSize||y+radius*1.8>=mapSize)continue;
  trees.push({...center,x,y,radius,rotation:random()*Math.PI*2,variant:random(),mirrored:random()<.5});
 }
 return trees;
}
export interface PalmViewport {left:number;right:number;top:number;bottom:number}
/** Retained deterministic wind phase for presentation consumers. */
export function palmCrownSway(time:number,x:number,y:number,variant=0,reducedMotion=false):number {
 if(reducedMotion||!Number.isFinite(time))return 0;
 const phase=x*.021+y*.013+variant*6.28;
 return Math.sin(time*.74+phase)*.023+Math.sin(time*1.27+phase*.8)*.009;
}
/** True 3D palm renders, with their original ground pivot and fixed sunlight. */
export class PalmGrove {
 private trees:PalmDetail[]=[];
 private game:Simulation|null=null;
 constructor(readonly atlas=new PropAtlas()){}
 get count():number{return this.trees.length;}
 get fallenCount():number{return 0;}
 get initiallyFallenCount():number{return 0;}
 reset(details:readonly GroundDetail[],game:Simulation):void{
  this.trees=details.filter(d=>d.kind==='palm').flatMap(d=>palmGroup(d,game.seed,game.world.size))
    .filter(d=>game.world.index(d)>=0&&!game.world.blocked[game.world.index(d)]);
  this.game=game;
 }
 update(_game:Simulation):void{}
 /** Visible static trees, in world coordinates. Keep the ground foot as depth anchor. */
 visibleTrees(view?:PalmViewport):PalmDetail[]{
  return this.trees.filter(d=>{
   const extent=d.radius*3.55*PALM_ART_SCALE;
   if(view&&(d.x+extent<view.left||d.x-extent>view.right||d.y+extent<view.top||d.y-extent>view.bottom))return false;
   return !this.game||environmentPropVisible(d,this.game);
  });
 }
 /** Draw a single tree; renderer can depth-sort it alongside soldiers and buildings. */
 drawOne(c:CanvasRenderingContext2D,d:GroundDetail):void{
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  if((d as PalmDetail).mirrored){c.translate(d.x*2,0);c.scale(-1,1);}
  this.atlas.draw(c,'palm-tree',d,d.radius*3.3,Math.floor(d.variant*4));c.restore();
 }
 draw(c:CanvasRenderingContext2D,_time:number,view?:PalmViewport,_reducedMotion=false):void{
  for(const d of this.visibleTrees(view))this.drawOne(c,d);
 }
}
