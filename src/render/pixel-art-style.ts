import {spriteFrame} from './sprite-atlas.js';
export const PIXEL_PALETTE={grass:'#86B476',forest:'#467857',ridge:'#D1BE9F',
  water:'#315A74',stone:'#E1CFAD',blue:'#4474BB',red:'#C85258'} as const;
export const TERRAIN_LOD={strategic:1.25,tactical:1.8} as const;
export function visualHash(x:number,y:number,salt=0):number {
  let h=Math.imul(x^salt,374761393)^Math.imul(y,668265263);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function buildingSpriteName(code:number,level:number,index=0):string {
  if(code===1)return `city-${Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)))}-${index%2}`;
  return code===3?'factory':code===4?'barracks':'tower';
}
export function buildingSpriteScale(code:number,level:number,zoom:number):number {
  const frame=spriteFrame('buildings',buildingSpriteName(code,level))!;
  return zoom>=1.8?1.5:zoom>=1.25?1:(code===1?30:26)/frame.width;
}
export function buildingSpriteBounds(x:number,y:number,code:number,level:number,zoom:number,index=0):{
  x:number;y:number;width:number;height:number;
} {
  const frame=spriteFrame('buildings',buildingSpriteName(code,level,index))!;
  const scale=buildingSpriteScale(code,level,zoom);
  return {x:Math.round(x)+(frame.inkX-frame.pivotX)*scale,y:Math.round(y)+(frame.inkY-frame.pivotY)*scale,
    width:frame.inkWidth*scale,height:frame.inkHeight*scale};
}
