import {PIXEL_ART_SPRITES} from './pixel-art-manifest.js';

export type AtlasName=keyof typeof PIXEL_ART_SPRITES;
export interface SpriteFrame {
  readonly x:number;readonly y:number;readonly width:number;readonly height:number;
  readonly pivotX:number;readonly pivotY:number;readonly state:string;
  readonly inkX:number;readonly inkY:number;readonly inkWidth:number;readonly inkHeight:number;
  readonly frame:number;readonly duration:number;
}
const manifests:Readonly<Record<AtlasName,Readonly<Record<string,SpriteFrame>>>>=PIXEL_ART_SPRITES;
const urls:Record<AtlasName,string>={
  terrain:new URL('../assets/pixel-art/terrain.png',import.meta.url).href,
  buildings:new URL('../assets/pixel-art/buildings.png',import.meta.url).href,
  soldiers:new URL('../assets/pixel-art/soldiers.png',import.meta.url).href,
  effects:new URL('../assets/pixel-art/effects.png',import.meta.url).href,
};
// One shared image per atlas, including across new games and renderer instances.
const images=new Map<AtlasName,HTMLImageElement>();
let preload:Promise<void>|undefined;
export function loadPixelArt():Promise<void> {
  return preload??=Promise.all((Object.keys(urls) as AtlasName[]).map(name=>new Promise<void>(resolve=>{
    const img=new Image();images.set(name,img);
    img.onload=()=>resolve();img.onerror=()=>resolve();img.src=urls[name];
  }))).then(()=>{});
}
export function spriteFrame(atlas:AtlasName,name:string):SpriteFrame|undefined {return manifests[atlas][name];}

/** Shared pivot and nearest-neighbour sampling for all original pixel assets. */
export function drawSprite(c:CanvasRenderingContext2D,atlas:AtlasName,name:string,
  x:number,y:number,scale=1,mirror=false):boolean {
  const sprite=spriteFrame(atlas,name),img=images.get(atlas);
  if(!sprite||!img?.complete||!img.naturalWidth)return false;
  c.save();c.imageSmoothingEnabled=false;
  c.translate(Math.round(x),Math.round(y));if(mirror)c.scale(-1,1);
  c.drawImage(img,sprite.x,sprite.y,sprite.width,sprite.height,
    -sprite.pivotX*scale,-sprite.pivotY*scale,sprite.width*scale,sprite.height*scale);
  c.restore();return true;
}

export type SoldierTeam='blue'|'red'|'green'|'neutral';
export type SoldierState='idle'|'move'|'fire';
export function drawSoldier(c:CanvasRenderingContext2D,x:number,y:number,team:SoldierTeam,
  state:SoldierState,time:number,seed:number,scale=1,mirror=false):void {
  const count=state==='move'?4:state==='fire'?3:2;
  const duration=state==='idle'?180:110;
  const frame=Math.floor(time/duration+seed)%count;
  if(!drawSprite(c,'soldiers',`${team}-${state}-${frame}`,x,y,scale,mirror)){
    // Deliberate small silhouette on load failure; gameplay remains usable.
    c.save();c.fillStyle=team==='blue'?'#4474bb':team==='red'?'#c85258':'#777c71';
    c.fillRect(x-2,y-9,4,7);c.fillRect(x-3,y-13,6,4);
    c.fillStyle='#464e56';c.fillRect(x+2,y-8,5,1);c.restore();
  }
}
