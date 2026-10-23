import { BUILDINGS, BUILDING_CODES } from '../engine/economy.js';
import {drawSprite,spriteFrame} from './sprite-atlas.js';
import {buildingSpriteName,buildingSpriteScale,buildingSpriteBounds} from './pixel-art-style.js';

export interface BuildingMarkerStyle {
  readonly label:string;
  readonly symbol:string;
  readonly color:string;
}

/** Every locally existing building class has its own pixel silhouette. */
export const BUILDING_MARKER_STYLES:Readonly<Record<number,BuildingMarkerStyle>> = {
  [BUILDING_CODES.tower]:{label:'Abwehrturm',symbol:'♜',color:'#b4d9e9'},
  [BUILDING_CODES.factory]:{label:'Fabrik',symbol:'⚙',color:'#ecc792'},
  [BUILDING_CODES.barracks]:{label:'Kaserne',symbol:'⚑',color:'#a8d3eb'},
  [BUILDING_CODES.city]: {
    label:BUILDINGS[0].name,
    symbol:'▣',
    color:'#f7e1b1',
  },
};
export function buildingMarkerFor(code:number):BuildingMarkerStyle|null {
  return BUILDING_MARKER_STYLES[code] ?? null;
}
export function showBuildingMarker(owner:number,zoom:number):boolean {
  return owner>=0 && Number.isFinite(zoom) && zoom>=0.8;
}

/** Strategic overview displays developed settlements first; tactical zoom
 * restores every ordinary town. Never changes city existence or hitboxes. */
export function cityVisibleAtZoom(owner:number,level:number,zoom:number,hovered=false):boolean {
  if(!showBuildingMarker(owner,zoom))return false;
  // A newly constructed player city starts at level 0 and must be visible
  // immediately, including at the default strategic zoom.
  if(owner===0||hovered||zoom>=1.8)return true;
  if(zoom>=1.25)return level>=2;
  return level>=3;
}

/** CSS pixels, independent of map scale and device pixel ratio. */
export const CITY_MARKER_SIZE=30;
export const CITY_BADGE_FONT_SIZE=10;
export interface ScreenRect {x:number;y:number;width:number;height:number}
export function cityMarkerBounds(x:number,y:number,level=0,zoom=1):ScreenRect {
  return buildingSpriteBounds(x,y,1,level,zoom);
}
export function rectanglesOverlap(a:ScreenRect,b:ScreenRect,gap=0):boolean {
  return a.x<b.x+b.width+gap && a.x+a.width+gap>b.x &&
    a.y<b.y+b.height+gap && a.y+a.height+gap>b.y;
}

/** Spatial hash bounds collision work even with thousands of settlements. */
export class ScreenOccupancy {
  private buckets=new Map<string,ScreenRect[]>();
  private keys(rect:ScreenRect,gap=0):string[] {
    const keys:string[]=[];
    for(let x=Math.floor((rect.x-gap)/64);x<=Math.floor((rect.x+rect.width+gap)/64);x++)
      for(let y=Math.floor((rect.y-gap)/64);y<=Math.floor((rect.y+rect.height+gap)/64);y++)keys.push(`${x}:${y}`);
    return keys;
  }
  clear():void {this.buckets.clear();}
  reserve(rect:ScreenRect):void {
    for(const key of this.keys(rect)){
      const bucket=this.buckets.get(key)??[];bucket.push(rect);this.buckets.set(key,bucket);
    }
  }
  intersects(rect:ScreenRect,gap=3):boolean {
    return this.keys(rect,gap).some(key=>this.buckets.get(key)?.some(other=>rectanglesOverlap(rect,other,gap)));
  }
}

/** Retained small fallback for an unavailable atlas; normal play uses PNGs. */
function drawCityFallback(c:CanvasRenderingContext2D,x:number,y:number,level:number,owner:number):void {
  const n=Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)));
  const style=cityLevelStyle(n);
  c.save();
  c.translate(x,y);c.globalAlpha=owner===0?1:.95;
  c.lineJoin='round';c.lineCap='round';
  // Two layers give the buildings depth without glowing blobs around them.
  c.fillStyle='rgba(3,14,20,.52)';
  c.fillRect(-13,11,26,2);
  const building=(bx:number,by:number,w:number,h:number,roof:number)=>{
    c.fillStyle='#11232b';c.fillRect(bx-1,by-1,w+2,h+2);
    c.fillStyle=style.fill;c.fillRect(bx,by,w,h);
    c.fillStyle=style.border;
    c.beginPath();c.moveTo(bx-1,by);
    c.lineTo(bx+w/2,by-roof);c.lineTo(bx+w+1,by);
    c.closePath();c.fill();
    c.strokeStyle='#0e2530';c.lineWidth=.7;c.stroke();
    c.fillStyle=style.text;
    if(w>=5)c.fillRect(bx+Math.floor(w/2)-1,by+Math.min(3,h-2),2,2);
  };
  if(n<=2){
    // Villages have irregular small houses rather than a miniature castle.
    building(-11,-1,9,11,5);
    building(1,-4,10,14,5);
    if(n===2)building(-3,-8,6,7,3);
  }else if(n<=4){
    // Town wall and watchtower, growing into a taller civic center.
    c.fillStyle=style.border;c.fillRect(-13,5,26,6);
    building(-11,-5,8,14,4);
    building(-1,-9,9,18,5);
    building(8,-3,5,12,3);
    if(n===4)building(-5,-10,7,8,3);
  }else{
    // Level-five skyline is visibly taller and gold without extra labels.
    c.fillStyle=style.border;c.fillRect(-13,4,26,7);
    building(-12,-5,7,14,4);
    building(-5,-10,9,19,4);
    building(5,-8,8,17,4);
    c.fillStyle=style.border;c.fillRect(-2,-12,2,3);
    c.fillStyle='#fff6cf';c.fillRect(-1,-14,1,2);
  }
  if(n>0){
    // Keep the existing 10px tier badge and true 30px painting envelope.
    c.fillStyle='#10212a';c.beginPath();c.roundRect(1,1,13,13,3);c.fill();
    c.strokeStyle=style.border;c.lineWidth=1;c.stroke();
    c.fillStyle=style.border;c.font=`800 ${CITY_BADGE_FONT_SIZE}px system-ui`;
    c.textAlign='center';c.textBaseline='middle';c.fillText(String(n),7.5,7.8);
  }
  c.restore();
}

/** PNG atlas drawing and hit testing use the same native frame and foot pivot. */
export function drawBuildingMarker(c:CanvasRenderingContext2D,x:number,y:number,code:number,
  level:number,owner:number,zoom=1,index=0,color=owner===0?'#e6b653':'#b9ced0'):void {
  const name=buildingSpriteName(code,level,index),scale=buildingSpriteScale(code,level,zoom);
  if(!drawSprite(c,'buildings',name,x,y,scale)){
    const bounds=buildingSpriteBounds(x,y,code,level,zoom,index);
    if(code===1){
      c.save();c.beginPath();c.rect(bounds.x,bounds.y,bounds.width,bounds.height);c.clip();
      c.translate(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
      c.scale(bounds.width/30,bounds.height/30);drawCityFallback(c,0,0,level,owner);c.restore();
    }
    else {c.save();c.fillStyle='#a4a697';c.fillRect(bounds.x+4,bounds.y+8,bounds.width-8,bounds.height-10);c.restore();}
    return;
  }
  // Only a small pennant changes faction color; all materials keep their palette.
  const frame=spriteFrame('buildings',name)!;
  const origin={x:Math.round(x)-frame.pivotX*scale,y:Math.round(y)-frame.pivotY*scale};
  const n=Math.max(0,Math.min(5,Math.floor(level)));
  const [fx,fy]=code===1?(n===0?[23,12]:n===1?[24,8]:n===2?[25,8]:n<5?[28,3]:[32,3])
    :code===3?[29,8]:code===4?[28,3]:[27,2];
  c.save();c.fillStyle=color;
  c.fillRect(origin.x+(fx+1)*scale,origin.y+fy*scale,5*scale,3*scale);
  c.fillStyle='#f4e6c8';c.fillRect(origin.x+(fx+1)*scale,origin.y+fy*scale,scale,scale);
  c.restore();
}

export function drawCityMarker(c:CanvasRenderingContext2D,x:number,y:number,level:number,owner:number):void {
  drawBuildingMarker(c,x,y,1,level,owner);
}

/** Readable map encoding: 0–2 bronze, 3–4 silver, 5 gold. */
export function cityLevelStyle(level:number):{fill:string;border:string;text:string}{
  const n=Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)));
  return n===5 ? {fill:'#efbd42',border:'#fff2b4',text:'#281a0b'}
    : n>=3 ? {fill:'#bbc8d4',border:'#f0f6fd',text:'#192b38'}
    : {fill:'#bf8550',border:'#f3d4a4',text:'#26180f'};
}
