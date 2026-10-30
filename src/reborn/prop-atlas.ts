/** Offline-rendered GLB props. Runtime only samples PNGs, just like buildings. */
export type PropKind='military-crate'|'military-crate-stack'|'service-lamp'|'service-terminal'|'fuel-barrels'|'sandbags'|'desert-skull'|'palm-tree';
interface Frame {x:number;y:number;w:number;h:number}
export interface PropDefinition {model:string;pivot:[number,number];solidWidth:number;frames:Frame[]}
interface PropAtlasData {version:number;image:string;props:Record<PropKind,PropDefinition>}
export class PropAtlas {
 private image:HTMLImageElement|null=null;
 private data:PropAtlasData|null=null;
 get spriteCount():number{return this.data?Object.values(this.data.props).reduce((n,p)=>n+p.frames.length,0):0;}
 async load():Promise<void>{
  const path='/src/assets/reborn/props-3d/';
  const response=await fetch(path+'props.json');if(!response.ok)throw new Error('Prop atlas: '+response.status);
  const data=await response.json() as PropAtlasData,image=new Image();
  image.src=path+data.image;await image.decode();this.image=image;this.data=data;
 }
 draw(c:CanvasRenderingContext2D,kind:PropKind,point:{x:number;y:number},width:number,variant=0):void {
  if(!this.image||!this.data)return;
  const p=this.data.props[kind],f=p.frames[((variant%p.frames.length)+p.frames.length)%p.frames.length|0],s=width/p.solidWidth;
  c.drawImage(this.image,f.x,f.y,f.w,f.h,point.x-p.pivot[0]*s,point.y-p.pivot[1]*s,f.w*s,f.h*s);
 }
}
