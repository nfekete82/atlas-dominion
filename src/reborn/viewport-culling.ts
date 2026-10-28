import type {Point} from './config.js';

/** Loose camera bounds keep tall GLB sprites visible while skipping distant draw calls. */
export interface RenderViewport {left:number;right:number;top:number;bottom:number}
export function visibleInViewport(p:Point,view:RenderViewport,margin=0):boolean {
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  const pad=Math.max(0,margin);
  return p.x>=view.left-pad&&p.x<=view.right+pad&&p.y>=view.top-pad&&p.y<=view.bottom+pad;
}
