import { BUILDINGS, BUILDING_CODES } from '../engine/economy.js';

export interface BuildingMarkerStyle {
  readonly label:string;
  readonly symbol:string;
  readonly color:string;
}

/** Only cities can be built. Capital labels already mark starting cities. */
export const BUILDING_MARKER_STYLES:Readonly<Record<number,BuildingMarkerStyle>> = {
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

/** CSS pixels, independent of map scale and device pixel ratio. */
export const CITY_MARKER_SIZE=30;
export const CITY_BADGE_FONT_SIZE=10;
export interface ScreenRect {x:number;y:number;width:number;height:number}
export function cityMarkerBounds(x:number,y:number):ScreenRect {
  return {x:x-15,y:y-15,width:CITY_MARKER_SIZE,height:CITY_MARKER_SIZE};
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

let skyline:Path2D|undefined;

/** Vector skyline; no bitmap resampling, enclosing plate, glow or shadow. */
export function drawCityMarker(c:CanvasRenderingContext2D,x:number,y:number,level:number,owner:number):void {
  const n=Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)));
  const style=cityLevelStyle(n);
  c.save();c.translate(x,y);c.globalAlpha=owner===0?1:.94;
  c.lineJoin='round';c.lineCap='round';
  skyline??=new Path2D('M-13 10V-3H-6V-11H-3V-13H1V-11H5V-6H11V-1H13V10Z');
  c.strokeStyle='#10212a';c.lineWidth=3;c.stroke(skyline);
  c.fillStyle=style.fill;c.fill(skyline);
  c.strokeStyle=style.border;c.lineWidth=1;c.stroke(skyline);
  c.fillStyle=style.text;
  for(const [wx,wy] of [[-10,-.5],[-10,4],[-3,-7],[1,-7],[-3,-2],[1,-2],[8,-2],[8,3]])c.fillRect(wx,wy,2,2.5);
  c.fillRect(-2,5,3,5);
  if(n>0){
    c.beginPath();c.roundRect(1,1,13,13,3);
    c.fillStyle='#10212a';c.fill();c.strokeStyle=style.border;c.lineWidth=1;c.stroke();
    c.fillStyle=style.border;c.font=`800 ${CITY_BADGE_FONT_SIZE}px system-ui`;
    c.textAlign='center';c.textBaseline='middle';c.fillText(String(n),7.5,7.8);
  }
  c.restore();
}

/** Readable map encoding: 0–2 bronze, 3–4 silver, 5 gold. */
export function cityLevelStyle(level:number):{fill:string;border:string;text:string}{
  const n=Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)));
  return n===5 ? {fill:'#efbd42',border:'#fff2b4',text:'#281a0b'}
    : n>=3 ? {fill:'#bbc8d4',border:'#f0f6fd',text:'#192b38'}
    : {fill:'#bf8550',border:'#f3d4a4',text:'#26180f'};
}
