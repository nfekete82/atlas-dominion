import type {GroundDetail,GroundSpriteVariant} from './battlefield-atmosphere.js';
import {groundSprite} from './battlefield-atmosphere.js';
import type {Simulation} from './simulation.js';

export const PALM_ART_SCALE=1.34;
export interface PalmViewport {left:number;right:number;top:number;bottom:number}

/** Gentle, seeded canopy movement in radians. It never changes the physical trunk or shade. */
export function palmCrownSway(time:number,x:number,y:number,variant=0,reducedMotion=false):number {
 if(reducedMotion||!Number.isFinite(time))return 0;
 const phase=x*.021+y*.013+variant*6.28;
 return Math.sin(time*.74+phase)*.023+Math.sin(time*1.27+phase*.8)*.009;
}
type Layers={trunk:HTMLCanvasElement;crown:HTMLCanvasElement};
function splitSprite(source:CanvasImageSource):Layers {
 const size=(source as HTMLCanvasElement).width||640;
 const make=(crown:boolean)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d')!;
  c.drawImage(source,0,0,size,size);
  const mask=c.createLinearGradient(0,size*.46,0,size*.72);
  if(crown){mask.addColorStop(0,'#fff');mask.addColorStop(1,'#000');}
  else{mask.addColorStop(0,'#000');mask.addColorStop(1,'#fff');}
  c.globalCompositeOperation='destination-in';c.fillStyle=mask;c.fillRect(0,0,size,size);
  c.globalCompositeOperation='source-over';
  return canvas;
 };
 return {trunk:make(false),crown:make(true)};
}
/** Render-only palm foliage: the high-resolution trunk and baked ground shadow stay still. */
export class PalmGrove {
 private trees:GroundDetail[]=[];
 private layers=new WeakMap<object,Layers>();
 get count():number{return this.trees.length;}
 get fallenCount():number{return 0;}
 get initiallyFallenCount():number{return 0;}
 reset(details:readonly GroundDetail[],_game:Simulation):void{this.trees=details.filter(d=>d.kind==='palm');}
 update(_game:Simulation):void{}
 draw(c:CanvasRenderingContext2D,sprites:GroundSpriteVariant,time:number,view?:PalmViewport,reducedMotion=false):void {
  for(const d of this.trees){
   const extent=d.radius*3.55*PALM_ART_SCALE;
   if(view&&(d.x+extent<view.left||d.x-extent>view.right||d.y+extent<view.top||d.y-extent>view.bottom))continue;
   const sprite=groundSprite(sprites,d.variant);
   // Headless Node test canvases have no document. Preserve one stable upright
   // silhouette there; actual browsers get separate wind-animated crown layers.
   if(typeof document==='undefined'){
    const w=d.radius*3.55*PALM_ART_SCALE,h=d.radius*3.5*PALM_ART_SCALE;
    c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
    c.drawImage(sprite,-w*.5,-h*.58,w,h);c.restore();
    continue;
   }
   let layers=this.layers.get(sprite);
   if(!layers){layers=splitSprite(sprite);this.layers.set(sprite,layers);}
   const w=d.radius*3.55*PALM_ART_SCALE,h=d.radius*3.5*PALM_ART_SCALE;
   c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
   c.globalAlpha=.96;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
   c.drawImage(layers.trunk,-w*.5,-h*.58,w,h);
   const sway=palmCrownSway(time,d.x,d.y,d.variant,reducedMotion);
   c.translate(0,-h*.29);c.rotate(sway);
   c.drawImage(layers.crown,-w*.5,-h*.29,w,h);
   c.restore();
  }
 }
}
