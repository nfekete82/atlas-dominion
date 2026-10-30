import type {BuildingKind} from './catalog.js';
import type {Owner} from './config.js';
import {PropAtlas,type PropKind} from './prop-atlas.js';

/** Fixed service yards, wholly outside the facade and the front-right exit.
 * Mirroring changes slot coordinates, never the baked lighting of a prop. */
export type BasePropKind=Exclude<PropKind,'desert-skull'|'palm-tree'>;
export type PropLayer='behind'|'front';
interface Slot {kind:BasePropKind;x:number;y:number;layer:PropLayer}
export interface BuildingProp {kind:BasePropKind;x:number;y:number;layer:PropLayer;size:number;variant:number}
export type DecoratedStructure=BuildingKind|'bastion';
const layouts:Record<DecoratedStructure,readonly Slot[]>={
 headquarters:[
  {kind:'service-lamp',x:-2.10,y:-.84,layer:'behind'},
  {kind:'military-crate-stack',x:-2.15,y:.13,layer:'front'},
  {kind:'military-crate',x:-2.15,y:.80,layer:'front'},
  {kind:'service-terminal',x:2.10,y:-.95,layer:'behind'},
  {kind:'service-lamp',x:2.10,y:-1.72,layer:'behind'},
 ],
 barracks:[
  {kind:'service-lamp',x:-2.25,y:-.98,layer:'behind'},
  {kind:'military-crate-stack',x:-2.40,y:.08,layer:'front'},
  {kind:'military-crate',x:-2.28,y:.95,layer:'front'},
 ],
 factory:[
  {kind:'service-lamp',x:-2.10,y:-1.0,layer:'behind'},
  {kind:'military-crate-stack',x:-2.22,y:.04,layer:'front'},
  {kind:'fuel-barrels',x:-2.10,y:.89,layer:'front'},
  {kind:'service-terminal',x:2.10,y:-1.02,layer:'behind'},
 ],
 airfield:[
  {kind:'service-lamp',x:-2.08,y:-1.0,layer:'behind'},
  {kind:'military-crate-stack',x:-2.05,y:.15,layer:'front'},
  {kind:'fuel-barrels',x:2.02,y:-1.04,layer:'behind'},
 ],
 generator:[{kind:'service-terminal',x:-2.30,y:-.85,layer:'behind'}],
 turret:[{kind:'military-crate',x:-2.40,y:-.90,layer:'behind'}],
 bastion:[{kind:'sandbags',x:-2.20,y:-.90,layer:'behind'}]
};
const visualSize:Record<BasePropKind,number>={
 'military-crate':26,'military-crate-stack':40,'service-lamp':23,
 'service-terminal':25,'fuel-barrels':33,sandbags:36
};
const mix=(seed:number,id:number,index:number):number=>{
 let n=(seed^Math.imul(id+101,0x9e3779b1)^Math.imul(index+17,0x85ebca6b))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
};
export function buildingProps(kind:DecoratedStructure,point:{x:number;y:number},radius:number,id:number,seed:number,facing:0|1=0):BuildingProp[]{
 if(!Number.isFinite(radius)||radius<=0)return [];
 return layouts[kind].map((slot,i)=>{
  const v=mix(seed,id,i),w=mix(seed^0x2fba91,id,i);
  return {kind:slot.kind,layer:slot.layer,
   x:point.x+(facing===1?-1:1)*(slot.x+(v-.5)*.035)*radius,
   y:point.y+(slot.y+(w-.5)*.035)*radius,
   size:visualSize[slot.kind]*(.97+v*.06),variant:Math.floor(w*4)};
 });
}
export const DECOR_PROP_COUNTS:Readonly<Record<DecoratedStructure,number>>=
 Object.fromEntries(Object.entries(layouts).map(([kind,slots])=>[kind,slots.length])) as Record<DecoratedStructure,number>;

export class BuildingDecor {
 constructor(readonly atlas=new PropAtlas()){}
 get spriteCount():number{return this.atlas.spriteCount;}
 draw(c:CanvasRenderingContext2D,kind:DecoratedStructure,point:{x:number;y:number},radius:number,
  id:number,seed:number,_owner:Owner,layer:PropLayer,_time=0,_reducedMotion=false,alpha=1,
  facing:0|1=0,visible:(prop:BuildingProp)=>boolean=()=>true):void {
  c.save();c.globalAlpha=Math.max(0,Math.min(1,alpha));c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  for(const p of buildingProps(kind,point,radius,id,seed,facing))if(p.layer===layer&&visible(p))this.atlas.draw(c,p.kind,p,p.size,p.variant);
  c.restore();
 }
}
