import type {GroundDetail} from './battlefield-atmosphere.js';
import type {Simulation} from './simulation.js';
import {PropAtlas} from './prop-atlas.js';
import {environmentPropVisible} from './prop-placement.js';

export const PALM_ART_SCALE=1.34;
export interface PalmViewport {left:number;right:number;top:number;bottom:number}
/** Retained deterministic wind phase for presentation consumers. */
export function palmCrownSway(time:number,x:number,y:number,variant=0,reducedMotion=false):number {
 if(reducedMotion||!Number.isFinite(time))return 0;
 const phase=x*.021+y*.013+variant*6.28;
 return Math.sin(time*.74+phase)*.023+Math.sin(time*1.27+phase*.8)*.009;
}
/** True 3D palm renders, with their original ground pivot and fixed sunlight. */
export class PalmGrove {
 private trees:GroundDetail[]=[];
 private game:Simulation|null=null;
 constructor(readonly atlas=new PropAtlas()){}
 get count():number{return this.trees.length;}
 get fallenCount():number{return 0;}
 get initiallyFallenCount():number{return 0;}
 reset(details:readonly GroundDetail[],game:Simulation):void{this.trees=details.filter(d=>d.kind==='palm');this.game=game;}
 update(_game:Simulation):void{}
 /** Visible static trees, in world coordinates. Keep the ground foot as depth anchor. */
 visibleTrees(view?:PalmViewport):GroundDetail[]{
  return this.trees.filter(d=>{
   const extent=d.radius*3.55*PALM_ART_SCALE;
   if(view&&(d.x+extent<view.left||d.x-extent>view.right||d.y+extent<view.top||d.y-extent>view.bottom))return false;
   return !this.game||environmentPropVisible(d,this.game);
  });
 }
 /** Draw a single tree; renderer can depth-sort it alongside soldiers and buildings. */
 drawOne(c:CanvasRenderingContext2D,d:GroundDetail):void{
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  this.atlas.draw(c,'palm-tree',d,d.radius*3.3,Math.floor(d.variant*4));c.restore();
 }
 draw(c:CanvasRenderingContext2D,_time:number,view?:PalmViewport,_reducedMotion=false):void{
  for(const d of this.visibleTrees(view))this.drawOne(c,d);
 }
}
