import type {GroundDetail,GroundSpriteVariant} from './battlefield-atmosphere.js';
import {groundSprite} from './battlefield-atmosphere.js';
import type {Simulation} from './simulation.js';

/** Only upright palms belong to the regular desert decorations. */
// Native palm atlas is high resolution; render larger without upscaling the source texture.
export const PALM_ART_SCALE=1.34;
export interface PalmViewport {left:number;right:number;top:number;bottom:number}

/**
 * Decorative, non-blocking palms. The old pre-fallen silhouettes and
 * vehicle-induced knockdown are intentionally retired: they looked detached
 * from the ground and obscured infantry. No savegame or physics changes.
 */
export class PalmGrove {
  private trees:GroundDetail[]=[];
  get count():number{return this.trees.length;}
  /** Compatibility with older debug probes: no palm can be rendered fallen. */
  get fallenCount():number{return 0;}
  get initiallyFallenCount():number{return 0;}

  reset(details:readonly GroundDetail[],_game:Simulation):void {
    this.trees=details.filter(d=>d.kind==='palm');
  }

  /** No visual state transition on vehicle movement. */
  update(_game:Simulation):void {}

  draw(c:CanvasRenderingContext2D,sprites:GroundSpriteVariant,_time:number,view?:PalmViewport):void {
    for(const d of this.trees){
      const extent=d.radius*3.55*PALM_ART_SCALE;
      if(view&&(d.x+extent<view.left||d.x-extent>view.right||
        d.y+extent<view.top||d.y-extent>view.bottom))continue;
      const sprite=groundSprite(sprites,d.variant);
      const w=d.radius*3.55*PALM_ART_SCALE,h=d.radius*3.5*PALM_ART_SCALE;
      c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
      c.globalAlpha=.96;
      c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      c.drawImage(sprite,-w*.5,-h*.58,w,h);
      c.restore();
    }
  }
}
