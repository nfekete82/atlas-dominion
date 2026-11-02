import type {BuildingKind} from './catalog.js';
import {directionIndex} from './sprite-animator.js';
import {rosterImageRect,ROSTER_IMAGE_WIDTH,ROSTER_IMAGE_HEIGHT} from './portrait-layout.js';
import type {Owner,Point} from './config.js';
import {buildingAtlasPath} from './asset-paths.js';
export type StructureKind=BuildingKind|'bastion';
interface Frame {x:number;y:number;w:number;h:number}
interface Layer {image:string;pivot:[number,number];frames:Frame[];period:number;originalBounds:Frame}
export interface BuildingAtlas {version:1;kind:StructureKind;team:Owner;design:{parts:number;triangles:number;name:string};model:string;body:{image:string;width:number;height:number;pivot:[number,number];solidBounds:Frame;top:number};activity:Layer|null;beacon:Layer|null;sweep?:Layer;turret?:Layer&{directions:number;muzzles:number[][][]};clips:{name:string;duration:number}[];bakedShadow:boolean}
export interface BuildingSprite {image:HTMLImageElement;x:number;y:number;w:number;h:number;center:number;foot:number;bodyWidth:number;bodyHeight:number}
interface Loaded {data:BuildingAtlas;body:HTMLImageElement;activity:HTMLImageElement|null;beacon:HTMLImageElement|null;sweep:HTMLImageElement|null;turret:HTMLImageElement|null;construction:Layer|null;constructionImage:HTMLImageElement|null;sprite:BuildingSprite}
const kinds:StructureKind[]=['headquarters','bastion','barracks','factory','airfield','generator','turret'];
export class BuildingPresentation {
 private assets=new Map<string,Loaded>();
 async load():Promise<void>{await Promise.all(kinds.flatMap(kind=>(kind==='bastion'?[0,1,-1]:[0,1]).map(async team=>{
  const prefix=buildingAtlasPath(kind,team),response=await fetch(prefix+'.json');if(!response.ok)throw Error('Building atlas unavailable: '+prefix);const data=await response.json() as BuildingAtlas;
  // A missing construction atlas is legal for previous installations.
  const stagesResponse=kind==='bastion'?null:await fetch(prefix+'-construction.json').catch(()=>null);
  const construction:Layer|null=stagesResponse?.ok?(await stagesResponse.json() as {layer:Layer}).layer:null;
  const image=async(file:string|null):Promise<HTMLImageElement|null>=>{if(!file)return null;const result=new Image();result.src='/src/assets/reborn/buildings-3d/'+file+'?art=pbr-strong-20261027';await result.decode();return result;};
  const [body,activity,beacon,sweep,turret,constructionImage]=await Promise.all([image(data.body.image),image(data.activity?.image??null),image(data.beacon?.image??null),image(data.sweep?.image??null),image(data.turret?.image??null),image(construction?.image??null)]),b=data.body;
  this.assets.set(kind+team,{data,body:body!,activity,beacon,sweep,turret,construction,constructionImage,sprite:{image:body!,x:0,y:0,w:b.width,h:b.height,center:b.pivot[0],foot:b.pivot[1],bodyWidth:b.solidBounds.w,bodyHeight:b.pivot[1]-b.top}});
 })));}
 asset(kind:StructureKind,owner:Owner):Loaded{return this.assets.get(kind+(kind==='bastion'?owner:owner===0?0:1))!;}
 sprite(kind:StructureKind,owner:Owner):BuildingSprite{return this.asset(kind,owner).sprite;}
 /** Each construction frame is baked from the real textured 3D building parts. */
 drawConstruction(c:CanvasRenderingContext2D,kind:BuildingKind,owner:Owner,p:Point,width:number,progress:number,alpha=1):boolean{
  const asset=this.asset(kind,owner),layer=asset.construction,image=asset.constructionImage;
  if(!layer||!image||!layer.frames.length)return false;
  const phase=Math.min(layer.frames.length-.000001,Math.max(0,progress)*layer.frames.length);
  const current=Math.floor(phase),blend=Math.min(1,.25+(phase-current)*1.25);
  const scale=width/asset.data.body.solidBounds.w;
  const paint=(frameIndex:number,opacity:number)=>{
    const f=layer.frames[frameIndex];c.save();c.globalAlpha=alpha*opacity;
    c.drawImage(image,f.x,f.y,f.w,f.h,p.x-layer.pivot[0]*scale,p.y-layer.pivot[1]*scale,f.w*scale,f.h*scale);
    c.restore();
  };
  if(current>0)paint(current-1,1);
  paint(current,blend);
  return true;
 }
 drawActivity(c:CanvasRenderingContext2D,kind:StructureKind,owner:Owner,p:Point,width:number,time:number,reduced=false,alpha=1):void{
  const asset=this.asset(kind,owner),scale=width/asset.data.body.solidBounds.w,clock=reduced?0:time;
  const draw=(layer:Layer|null,image:HTMLImageElement|null,opacity:number)=>{if(!layer||!image)return;const f=layer.frames[Math.floor(clock/layer.period*layer.frames.length)%layer.frames.length];c.save();c.globalAlpha=alpha*opacity;c.drawImage(image,f.x,f.y,f.w,f.h,p.x-layer.pivot[0]*scale,p.y-layer.pivot[1]*scale,f.w*scale,f.h*scale);c.restore();};
  draw(asset.data.sweep??null,asset.sweep,1);draw(asset.data.activity,asset.activity,1);const pulse=Math.pow(Math.max(0,Math.cos(clock*Math.PI*2/3.8)),18);draw(asset.data.beacon,asset.beacon,.22+.78*pulse);
 }
 drawTurret(c:CanvasRenderingContext2D,owner:Owner,p:Point,width:number,angle=0,alpha=1):void{
  const a=this.asset('turret',owner),layer=a.data.turret;if(!layer||!a.turret)return;
  const f=layer.frames[directionIndex(angle,layer.directions)],scale=width/a.data.body.solidBounds.w;
  c.save();c.globalAlpha=alpha;c.drawImage(a.turret,f.x,f.y,f.w,f.h,p.x-layer.pivot[0]*scale,p.y-layer.pivot[1]*scale,f.w*scale,f.h*scale);c.restore();
 }
 icon(kind:BuildingKind):string{
  const a=this.asset(kind,0),source=document.createElement('canvas');source.width=source.height=512;const sc=source.getContext('2d')!;sc.drawImage(a.body,0,0);if(kind==='turret')this.drawTurret(sc,0,{x:a.data.body.pivot[0],y:a.data.body.pivot[1]},a.data.body.solidBounds.w);this.drawActivity(sc,kind,0,{x:a.data.body.pivot[0],y:a.data.body.pivot[1]},a.data.body.solidBounds.w,0);
  const c=document.createElement('canvas');c.width=ROSTER_IMAGE_WIDTH;c.height=ROSTER_IMAGE_HEIGHT;const ctx=c.getContext('2d')!,b=a.data.body.solidBounds,top=a.data.body.top,h=b.y+b.h-top,frame=rosterImageRect(b.w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,b.x,top,b.w,h,frame.x,frame.y,frame.w,frame.h);return c.toDataURL();
 }
}
