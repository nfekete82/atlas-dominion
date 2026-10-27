/** Landscape roster portraits match the actual production-card viewport. */
export const ROSTER_IMAGE_WIDTH=192;
export const ROSTER_IMAGE_HEIGHT=120;
export interface PortraitRect {x:number;y:number;w:number;h:number}
export function rosterImageRect(sourceWidth:number,sourceHeight:number,margin=3):PortraitRect{
  const w=Math.max(1,sourceWidth),h=Math.max(1,sourceHeight);
  const scale=Math.min((ROSTER_IMAGE_WIDTH-2*margin)/w,(ROSTER_IMAGE_HEIGHT-2*margin)/h);
  const dw=w*scale,dh=h*scale;
  return {x:(ROSTER_IMAGE_WIDTH-dw)/2,y:(ROSTER_IMAGE_HEIGHT-dh)/2,w:dw,h:dh};
}
