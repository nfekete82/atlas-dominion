import type {BuildingKind} from './catalog.js';
import type {Owner} from './config.js';

/** Small, pre-rendered military supplies for the existing isometric desert art.
 * These exist only in the presentation layer: no obstacles, pathfinding or save state. */
export type BasePropKind='crate'|'stack'|'lamp'|'barrel'|'terminal'|'pallet'|'sandbags'|'bollard'|'fuel'|'groundlight';
export type PropLayer='behind'|'front';
interface Slot {kind:BasePropKind;x:number;y:number;layer:PropLayer;scale?:number}
export interface BuildingProp {kind:BasePropKind;x:number;y:number;layer:PropLayer;size:number;variant:number}
export type DecoratedStructure=BuildingKind|'bastion';

const layouts:Record<DecoratedStructure,readonly Slot[]>={
 headquarters:[
  {kind:'lamp',x:-1.31,y:-.50,layer:'behind',scale:1.05},
  {kind:'stack',x:-1.14,y:-.08,layer:'behind'},
  {kind:'terminal',x:1.15,y:-.16,layer:'behind'},
  {kind:'lamp',x:1.36,y:-.47,layer:'behind'},
  {kind:'barrel',x:-1.24,y:.38,layer:'front'},
  {kind:'crate',x:1.25,y:.39,layer:'front'},
  {kind:'bollard',x:-.99,y:.68,layer:'front'},
  {kind:'bollard',x:.98,y:.68,layer:'front'},
 ],
 barracks:[
  {kind:'lamp',x:-1.45,y:-.33,layer:'behind'},
  {kind:'stack',x:-1.22,y:.03,layer:'behind'},
  {kind:'terminal',x:1.33,y:-.35,layer:'behind'},
  {kind:'sandbags',x:-1.33,y:.50,layer:'front'},
  {kind:'crate',x:1.23,y:.47,layer:'front'},
  {kind:'bollard',x:.98,y:.82,layer:'front'},
 ],
 factory:[
  {kind:'lamp',x:-1.40,y:-.47,layer:'behind'},
  {kind:'pallet',x:-1.30,y:-.07,layer:'behind',scale:1.12},
  {kind:'terminal',x:1.41,y:-.34,layer:'behind'},
  {kind:'stack',x:1.30,y:.00,layer:'behind'},
  {kind:'fuel',x:-1.37,y:.48,layer:'front'},
  {kind:'barrel',x:-1.00,y:.80,layer:'front'},
  {kind:'crate',x:1.34,y:.51,layer:'front'},
  {kind:'lamp',x:1.51,y:.80,layer:'front'},
 ],
 airfield:[
  {kind:'lamp',x:-1.29,y:-.45,layer:'behind',scale:1.15},
  {kind:'pallet',x:-1.36,y:-.07,layer:'behind'},
  {kind:'fuel',x:1.31,y:-.35,layer:'behind'},
  {kind:'terminal',x:1.33,y:.02,layer:'behind'},
  {kind:'stack',x:-1.43,y:.40,layer:'front'},
  {kind:'groundlight',x:-.96,y:.79,layer:'front'},
  {kind:'groundlight',x:.92,y:.79,layer:'front'},
  {kind:'barrel',x:1.30,y:.50,layer:'front'},
  {kind:'lamp',x:1.48,y:.85,layer:'front'},
 ],
 generator:[
  {kind:'terminal',x:-1.47,y:-.35,layer:'behind',scale:.84},
  {kind:'lamp',x:1.44,y:-.41,layer:'behind',scale:.85},
  {kind:'barrel',x:-1.35,y:.56,layer:'front',scale:.86},
 ],
 turret:[
  {kind:'crate',x:-1.70,y:-.24,layer:'behind',scale:.76},
  {kind:'sandbags',x:1.71,y:.20,layer:'front',scale:.79},
 ],
 bastion:[
  {kind:'lamp',x:-1.55,y:-.24,layer:'behind',scale:.80},
  {kind:'crate',x:1.65,y:-.05,layer:'behind',scale:.76},
 ]
};
const visualSize:Record<BasePropKind,number>={
 crate:52,stack:60,lamp:63,barrel:49,terminal:55,pallet:63,
 sandbags:64,bollard:40,fuel:57,groundlight:42
};
const unit=(v:number)=>((v>>>0)/4294967296);
const mix=(seed:number,id:number,index:number):number=>{
 let n=(seed^Math.imul(id+101,0x9e3779b1)^Math.imul(index+17,0x85ebca6b))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);
 n=Math.imul(n^(n>>>15),0x846ca68b);
 return unit((n^(n>>>16))>>>0);
};

/** Pure, deterministic layouts. Every opening and central vehicle exit remains clear. */
export function buildingProps(
 kind:DecoratedStructure,point:{x:number;y:number},radius:number,id:number,seed:number,
):BuildingProp[] {
 if(!Number.isFinite(radius)||radius<=0)return [];
 return layouts[kind].map((slot,i)=>{
  const v=mix(seed,id,i),w=mix(seed^0x2fba91,id,i);
  return {
   kind:slot.kind,layer:slot.layer,
   x:point.x+(slot.x+(v-.5)*.065)*radius,
   y:point.y+(slot.y+(w-.5)*.055)*radius,
   size:visualSize[slot.kind]*(slot.scale??1)*(0.95+v*.1),
   variant:Math.floor(w*3)
  };
 });
}
export const DECOR_PROP_COUNTS:Readonly<Record<DecoratedStructure,number>>=
 Object.fromEntries(Object.entries(layouts).map(([kind,slots])=>[kind,slots.length])) as Record<DecoratedStructure,number>;

/** High-resolution cached canvas art for crisp lighting/shadows at close zoom. */
export class BuildingDecor {
 private sprites=new Map<string,HTMLCanvasElement>();
 get spriteCount():number{return this.sprites.size;}
 private sprite(kind:BasePropKind,owner:Owner,variant:number):HTMLCanvasElement {
  const key=kind+':'+owner+':'+variant,existing=this.sprites.get(key);if(existing)return existing;
  const canvas=document.createElement('canvas');
  canvas.width=288;canvas.height=300;
  const c=canvas.getContext('2d')!;
  c.scale(3,3);
  this.paint(c,kind,owner,variant);
  this.sprites.set(key,canvas);
  return canvas;
 }
 private paint(c:CanvasRenderingContext2D,kind:BasePropKind,owner:Owner,variant:number):void {
  const accent=owner===1?'#bb5b49':owner===0?'#407f9e':'#d5cfc1';
  const light=owner===1?'#f89470':owner===0?'#78c9f3':'#f2dcc0';
  const polygon=(points:number[][],fill:string,stroke='#302b23')=>{
   c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
   c.fillStyle=fill;c.fill();c.lineWidth=.8;c.strokeStyle=stroke;c.stroke();
  };
  const shadow=(x=53,y=84,rx=24)=>{
   c.save();c.translate(x,y);c.rotate(-.16);
   const g=c.createRadialGradient(0,0,2,2,0,rx);
   g.addColorStop(0,'#21191165');g.addColorStop(1,'#21191100');
   c.fillStyle=g;c.beginPath();c.ellipse(0,0,rx,rx*.40,0,0,Math.PI*2);c.fill();c.restore();
  };
  const box=(x:number,y:number,w:number,h:number,d:number)=>{
   const shade=variant===1?'#72664d':variant===2?'#8a7650':'#837456';
   const face=variant===1?'#a99a77':'#c0a57a';
   polygon([[x,y-h],[x+d,y-h-d*.40],[x+w+d,y-h-d*.40],[x+w,y-h]],'#c6b18a');
   polygon([[x,y-h],[x+w,y-h],[x+w,y],[x,y]],face);
   polygon([[x+w,y-h],[x+w+d,y-h-d*.40],[x+w+d,y-d*.40],[x+w,y]],shade);
   c.strokeStyle='#514632';c.lineWidth=1;
   for(const xx of [x+3,x+w-4]){c.beginPath();c.moveTo(xx,y-h+2);c.lineTo(xx,y-2);c.stroke();}
   c.strokeStyle='#e4ca98a0';c.beginPath();c.moveTo(x+3,y-h+5);c.lineTo(x+w-3,y-h+5);c.stroke();
   c.strokeStyle='#352c1cb8';c.strokeRect(x+7,y-h+8,w-14,Math.max(5,h-15));
   c.fillStyle=accent;c.fillRect(x+w*.36,y-h+8,w*.28,3);
   // Surface screws and small scuffs read as physical supply boxes, not icons.
   c.fillStyle='#3e392d';for(const dx of [5,w-6])for(const dy of [4,h-5])
    c.fillRect(x+dx,y-h+dy,1.3,1.3);
  };
  const barrel=(x:number,y:number,main='#656747')=>{
   c.fillStyle='#332f25';c.beginPath();c.ellipse(x,y,13,5,0,0,Math.PI*2);c.fill();
   c.fillStyle=main;c.fillRect(x-12,y-28,24,28);
   c.fillStyle='#9b9169';c.beginPath();c.ellipse(x,y-28,12,5,0,0,Math.PI*2);c.fill();
   c.fillStyle='#33382e';for(const yy of [y-21,y-8])c.fillRect(x-12,yy,24,4);
   c.fillStyle=accent;c.fillRect(x-3,y-17,7,6);
   c.strokeStyle='#d4c79e';c.beginPath();c.ellipse(x,y-28,8.6,3.2,0,0,Math.PI*2);c.stroke();
   c.fillStyle='#b9aa7d';c.fillRect(x-9,y-23,2,10);
  };
  shadow();
  switch(kind){
   case 'crate':box(25,82,37,29,10);break;
   case 'stack':box(18,83,35,28,10);box(48,83,25,24,7);box(27,53,35,23,8);break;
   case 'barrel':barrel(48,82);break;
   case 'fuel':
    barrel(39,82,'#566558');barrel(60,84,'#766447');
    c.strokeStyle='#373a32';c.lineWidth=2;c.beginPath();c.moveTo(45,52);c.lineTo(45,44);c.lineTo(65,44);c.stroke();break;
   case 'terminal':
    polygon([[30,51],[40,45],[67,45],[57,51]],'#aea587');
    polygon([[30,51],[57,51],[57,80],[30,80]],'#596158');
    polygon([[57,51],[67,45],[67,76],[57,80]],'#2e3d3e');
    c.fillStyle='#182e36';c.fillRect(35,56,17,10);c.fillStyle=accent;c.fillRect(37,58,13,6);
    c.strokeStyle='#b7a884';c.strokeRect(35,56,17,10);
    c.fillStyle=light;c.fillRect(37,70,3,2);c.fillStyle='#d1aa5f';c.fillRect(43,70,3,2);
    for(let i=0;i<3;i++){c.fillStyle='#252b27';c.fillRect(36,74+i*2,15,1);}
    break;
   case 'pallet':
    polygon([[13,77],[45,65],[82,75],[48,88]],'#736043');
    polygon([[13,79],[48,90],[82,77],[82,83],[48,97],[13,85]],'#564932');
    c.strokeStyle='#b19669';c.lineWidth=2;
    for(let i=0;i<4;i++){c.beginPath();c.moveTo(19+i*8,79+i*2);c.lineTo(46+i*7,70+i*2);c.stroke();}
    box(19,72,26,17,7);
    c.fillStyle='#303b39';c.beginPath();c.ellipse(66,68,13,7,-.15,0,Math.PI*2);c.fill();
    c.strokeStyle='#9c9579';c.lineWidth=3;c.beginPath();c.ellipse(66,68,8,4,-.15,0,Math.PI*2);c.stroke();
    break;
   case 'sandbags':
    for(let row=0;row<2;row++)for(let i=0;i<3-row;i++){
     const x=19+i*23+row*11,y=78-row*8+i*1.8;
     c.fillStyle=row===0?'#9c895e':'#b49e70';c.strokeStyle='#5f553a';c.lineWidth=1;
     c.beginPath();c.ellipse(x+11,y,13,5.5,.1,0,Math.PI*2);c.fill();c.stroke();
     c.strokeStyle='#dfc99b';c.beginPath();c.moveTo(x+2,y-2);c.lineTo(x+19,y-2);c.stroke();
    }break;
   case 'bollard':
    c.fillStyle='#343e3f';c.fillRect(44,51,10,28);
    polygon([[44,51],[49,48],[59,48],[54,51]],'#a5a493');
    c.fillStyle=accent;c.fillRect(44,55,10,5);c.fillStyle='#d8d2b9';c.fillRect(46,69,6,2);
    break;
   case 'lamp':
    c.strokeStyle='#2e3332';c.lineWidth=5;c.beginPath();c.moveTo(45,80);c.lineTo(45,23);c.stroke();
    c.strokeStyle='#a2a18a';c.lineWidth=1.3;c.beginPath();c.moveTo(43,75);c.lineTo(43,25);c.stroke();
    polygon([[37,78],[55,78],[57,84],[34,84]],'#444740');
    c.strokeStyle='#3c4142';c.lineWidth=3;c.beginPath();c.moveTo(45,23);c.lineTo(52,21);c.stroke();
    polygon([[47,16],[65,16],[69,22],[45,24]],'#414743');
    polygon([[48,22],[66,20],[62,25],[49,26]],'#b9d2cf','#38494c');
    c.fillStyle=light;c.fillRect(52,22,12,2);c.fillStyle='#111915';c.fillRect(41,31,7,3);
    break;
   case 'groundlight':
    polygon([[27,79],[60,79],[67,86],[20,86]],'#454745');
    polygon([[30,75],[59,75],[64,80],[25,80]],'#a4aca6');
    c.fillStyle=light;c.fillRect(33,76,23,3);
    c.fillStyle=accent;c.fillRect(37,84,14,2);
    break;
  }
  // Very faint grain, reproducible per sprite variant. Limited to the object art.
  c.save();c.globalAlpha=.20;c.fillStyle='#efe1b9';
  for(let i=0;i<18;i++){
   const n=mix(variant*103+kind.length,i,owner+7),m=mix(variant+0x8f,i+3,kind.length);
   c.fillRect(27+n*42,48+m*34,.65,.65);
  }
  c.restore();
 }
 draw(c:CanvasRenderingContext2D,kind:DecoratedStructure,point:{x:number;y:number},radius:number,
      id:number,seed:number,owner:Owner,layer:PropLayer,time=0,reducedMotion=false,alpha=1):void {
  const props=buildingProps(kind,point,radius,id,seed);
  c.save();c.globalAlpha=Math.max(0,Math.min(1,alpha));c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  for(const p of props){
   if(p.layer!==layer)continue;
   const sprite=this.sprite(p.kind,owner,p.variant),scale=p.size/96,w=96*scale,h=100*scale;
   c.drawImage(sprite,p.x-w*.5,p.y-h*.85,w,h);
   // Lamp diode glows gently; never casts gameplay light or reveals fog.
   if((p.kind==='lamp'||p.kind==='groundlight')&&alpha>.5){
    const phase=reducedMotion?.5:.45+.2*Math.sin(time*.8+id+p.x*.037);
    const lampY=p.y-h*(p.kind==='lamp'?.85-.20:.85-.77);
    c.save();c.globalAlpha=Math.min(.24,phase*.33*alpha);
    const g=c.createRadialGradient(p.x,lampY,1,p.x,lampY,12);
    const color=owner===0?'105,209,250':owner===1?'255,137,113':'250,229,182';
    g.addColorStop(0,'rgba('+color+',.6)');g.addColorStop(1,'rgba('+color+',0)');
    c.fillStyle=g;c.beginPath();c.arc(p.x,lampY,12,0,Math.PI*2);c.fill();c.restore();
   }
  }
  c.restore();
 }
}
