import type {BuildingKind} from './catalog.js';
import type {Owner,Point} from './config.js';
import {buildingAtlasPath} from './asset-paths.js';
export type StructureKind=BuildingKind|'bastion';
interface Frame {x:number;y:number;w:number;h:number}
interface Layer {image:string;pivot:[number,number];frames:Frame[];period:number;originalBounds:Frame}
export interface BuildingAtlas {version:1;kind:StructureKind;team:Owner;design:{parts:number;triangles:number;name:string};model:string;body:{image:string;width:number;height:number;pivot:[number,number];solidBounds:Frame;top:number};activity:Layer|null;beacon:Layer|null;clips:{name:string;duration:number}[];bakedShadow:boolean}
export interface BuildingSprite {image:HTMLImageElement;x:number;y:number;w:number;h:number;center:number;foot:number;bodyWidth:number;bodyHeight:number}
interface Loaded {data:BuildingAtlas;body:HTMLImageElement;activity:HTMLImageElement|null;beacon:HTMLImageElement|null;sprite:BuildingSprite}
const kinds:StructureKind[]=['headquarters','bastion','barracks','factory','airfield','generator','turret'];
export class BuildingPresentation {
 private assets=new Map<string,Loaded>();
 async load():Promise<void>{await Promise.all(kinds.flatMap(kind=>(kind==='bastion'?[0,1,-1]:[0,1]).map(async team=>{
  const prefix=buildingAtlasPath(kind,team),response=await fetch(prefix+'.json');if(!response.ok)throw Error('Building atlas unavailable: '+prefix);const data=await response.json() as BuildingAtlas;
  const image=async(file:string|null):Promise<HTMLImageElement|null>=>{if(!file)return null;const result=new Image();result.src='/src/assets/reborn/buildings-3d/'+file;await result.decode();return result;};
  const [body,activity,beacon]=await Promise.all([image(data.body.image),image(data.activity?.image??null),image(data.beacon?.image??null)]),b=data.body;
  this.assets.set(kind+team,{data,body:body!,activity,beacon,sprite:{image:body!,x:0,y:0,w:b.width,h:b.height,center:b.pivot[0],foot:b.pivot[1],bodyWidth:b.solidBounds.w,bodyHeight:b.pivot[1]-b.top}});
 })));}
 asset(kind:StructureKind,owner:Owner):Loaded{return this.assets.get(kind+(kind==='bastion'?owner:owner===0?0:1))!;}
 sprite(kind:StructureKind,owner:Owner):BuildingSprite{return this.asset(kind,owner).sprite;}
 drawActivity(c:CanvasRenderingContext2D,kind:StructureKind,owner:Owner,p:Point,width:number,time:number,reduced=false,alpha=1):void{
  const asset=this.asset(kind,owner),scale=width/asset.data.body.solidBounds.w,clock=reduced?0:time;
  const draw=(layer:Layer|null,image:HTMLImageElement|null,opacity:number)=>{if(!layer||!image)return;const f=layer.frames[Math.floor(clock/layer.period*layer.frames.length)%layer.frames.length];c.save();c.globalAlpha=alpha*opacity;c.drawImage(image,f.x,f.y,f.w,f.h,p.x-layer.pivot[0]*scale,p.y-layer.pivot[1]*scale,f.w*scale,f.h*scale);c.restore();};
  draw(asset.data.activity,asset.activity,1);const pulse=Math.pow(Math.max(0,Math.cos(clock*Math.PI*2/3.8)),18);draw(asset.data.beacon,asset.beacon,.22+.78*pulse);
 }
 icon(kind:BuildingKind):string{
  const a=this.asset(kind,0),source=document.createElement('canvas');source.width=source.height=512;const sc=source.getContext('2d')!;sc.drawImage(a.body,0,0);this.drawActivity(sc,kind,0,{x:a.data.body.pivot[0],y:a.data.body.pivot[1]},a.data.body.solidBounds.w,0);
  const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d')!,b=a.data.body.solidBounds,top=a.data.body.top,h=b.y+b.h-top,s=Math.min(148/b.w,148/h);ctx.drawImage(source,b.x,top,b.w,h,(160-b.w*s)/2,156-h*s,b.w*s,h*s);return c.toDataURL();
 }
}
