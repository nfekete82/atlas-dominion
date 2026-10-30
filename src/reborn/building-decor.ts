import type {BuildingKind} from './catalog.js';
import type {Owner} from './config.js';

/** Small, pre-rendered military supplies for the existing isometric desert art.
 * These exist only in the presentation layer: no obstacles, pathfinding or save state. */
export type BasePropKind='crate'|'stack'|'lamp'|'barrel'|'terminal'|'pallet'|'sandbags'|'bollard'|'fuel'|'groundlight';
export type PropLayer='behind'|'front';
interface Slot {kind:BasePropKind;x:number;y:number;layer:PropLayer;scale?:number}
export interface BuildingProp {kind:BasePropKind;x:number;y:number;layer:PropLayer;size:number;variant:number}
export type DecoratedStructure=BuildingKind|'bastion';

/** Props live in dedicated service yards OUTSIDE the entire building sprite,
 * not only outside the physics radius. Keep the southeast/front-right entry
 * quadrant empty for Pioneers, spawning infantry and vehicle ramps. */
const layouts:Record<DecoratedStructure,readonly Slot[]>={
 headquarters:[
  {kind:'lamp',x:-1.82,y:-.76,layer:'behind',scale:.96},
  {kind:'stack',x:-1.79,y:-.32,layer:'behind'},
  {kind:'terminal',x:-1.84,y:.05,layer:'behind',scale:.85},
  {kind:'lamp',x:1.80,y:-.80,layer:'behind',scale:.96},
  {kind:'barrel',x:-1.77,y:.51,layer:'front',scale:.86},
  {kind:'crate',x:-1.47,y:.78,layer:'front',scale:.85},
  {kind:'bollard',x:-1.82,y:.91,layer:'front'},
  {kind:'bollard',x:1.80,y:-.34,layer:'behind'},
 ],
 barracks:[
  {kind:'lamp',x:-1.92,y:-.55,layer:'behind'},
  {kind:'stack',x:-1.84,y:-.04,layer:'behind'},
  {kind:'terminal',x:1.91,y:-.74,layer:'behind',scale:.86},
  {kind:'sandbags',x:-1.91,y:.54,layer:'front',scale:.85},
  {kind:'crate',x:-1.48,y:.82,layer:'front',scale:.86},
  {kind:'bollard',x:1.87,y:-.43,layer:'behind'},
 ],
 factory:[
  {kind:'lamp',x:-1.96,y:-.75,layer:'behind'},
  {kind:'pallet',x:-1.87,y:-.25,layer:'behind',scale:1.0},
  {kind:'terminal',x:1.91,y:-.84,layer:'behind',scale:.85},
  {kind:'stack',x:1.86,y:-.42,layer:'behind',scale:.93},
  {kind:'fuel',x:-1.89,y:.48,layer:'front',scale:.86},
  {kind:'barrel',x:-1.62,y:.80,layer:'front',scale:.86},
  {kind:'crate',x:2.29,y:-.33,layer:'behind',scale:.88},
  {kind:'lamp',x:2.00,y:-1.10,layer:'behind',scale:.86},
 ],
 airfield:[
  {kind:'lamp',x:-1.90,y:-.92,layer:'behind',scale:1.03},
  {kind:'pallet',x:-1.89,y:-.37,layer:'behind',scale:.90},
  {kind:'fuel',x:1.92,y:-.93,layer:'behind',scale:.91},
  {kind:'terminal',x:1.90,y:-.50,layer:'behind',scale:.85},
  {kind:'stack',x:-1.90,y:.21,layer:'front',scale:.90},
  {kind:'groundlight',x:-1.75,y:.87,layer:'front',scale:.83},
  {kind:'groundlight',x:1.79,y:-.39,layer:'behind',scale:.83},
  {kind:'barrel',x:-1.80,y:.58,layer:'front',scale:.81},
  {kind:'lamp',x:1.96,y:-1.22,layer:'behind',scale:1.0},
 ],
 generator:[
  {kind:'terminal',x:-1.99,y:-.57,layer:'behind',scale:.82},
  {kind:'lamp',x:1.99,y:-.77,layer:'behind',scale:.80},
  {kind:'barrel',x:-1.92,y:.62,layer:'front',scale:.80},
 ],
 turret:[
  {kind:'crate',x:-1.95,y:-.50,layer:'behind',scale:.75},
  {kind:'sandbags',x:-1.92,y:.53,layer:'front',scale:.77},
 ],
 bastion:[
  {kind:'lamp',x:-1.96,y:-.40,layer:'behind',scale:.73},
  {kind:'crate',x:1.91,y:-.33,layer:'behind',scale:.70},
 ]
};
const visualSize:Record<BasePropKind,number>={
 crate:66,stack:72,lamp:80,barrel:58,terminal:65,pallet:74,
 sandbags:70,bollard:42,fuel:64,groundlight:48
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
  // Physically lit orthographic miniatures, not flat UI rectangles: shaded
  // top/front/side faces, bevels, dusty seams and long contact shadows.
  const accent=owner===1?'#a94c3d':owner===0?'#3b89a8':'#bcae8c';
  const light=owner===1?'#ed9a74':owner===0?'#75bcd5':'#dcc49c';
  const top=variant===1?'#b3a684':variant===2?'#8e9a80':'#a4a58c';
  const front=variant===1?'#656d5b':variant===2?'#727e65':'#78816c';
  const side='#343d34';
  type XY=[number,number];
  const poly=(points:XY[],fill:string|CanvasGradient,stroke='#2e3028',line=1)=>{
   c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
   c.closePath();c.fillStyle=fill;c.fill();
   if(line){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
  };
  const shade=(x:number,y:number,x2:number,y2:number,stops:[number,string][])=>{
   const g=c.createLinearGradient(x,y,x2,y2);for(const [at,color] of stops)g.addColorStop(at,color);return g;
  };
  const line=(x:number,y:number,x2:number,y2:number,color:string,width=1)=>{
   c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
  };
  const cast=(x=45,y=84,width=32)=>{
   c.save();c.translate(x,y);c.rotate(-.18);
   const shadow=c.createRadialGradient(12,3,1,17,3,width*1.85);
   shadow.addColorStop(0,'#22190e9c');shadow.addColorStop(.5,'#30231546');
   shadow.addColorStop(1,'#30231500');
   c.fillStyle=shadow;c.beginPath();c.ellipse(12,4,width*1.8,width*.50,0,0,Math.PI*2);c.fill();
   c.restore();
  };
  const wear=(x:number,y:number,w:number,h:number,count=28)=>{
   c.save();c.globalAlpha=.25;
   for(let i=0;i<count;i++){
    const n=mix(i*53+variant+kind.length,owner+47,i),m=mix(i*17+kind.length,variant+9,i);
    c.fillStyle=i%3===0?'#ece5c2':'#202b28';
    c.fillRect(x+n*w,y+m*h,.5+(i%3)*.45,.5);
   }
   c.restore();
  };
  const crate=(x:number,y:number,w:number,h:number,d:number)=>{
   // Heavy sand-colored NATO supply chest with real isometric face depths.
   const topFace:XY[]=[[x,y-h],[x+d,y-h-d*.50],[x+w+d,y-h-d*.50],[x+w,y-h]];
   const right:XY[]=[[x+w,y-h],[x+w+d,y-h-d*.50],[x+w+d,y-d*.50],[x+w,y]];
   const face:XY[]=[[x,y-h],[x+w,y-h],[x+w,y],[x,y]];
   poly(right,shade(x+w,y-h,x+w+d,y,[ [0,'#626b55'],[1,'#303a31'] ]),'#2c342b',1.15);
   poly(face,shade(x,y-h,x+w,y,[ [0,'#a5ac8c'],[.4,front],[1,'#434f42'] ]),'#343a30',1.2);
   poly(topFace,shade(x,y-h-d,x+w+d,y-h,[ [0,'#ddd1a7'],[.45,top],[1,'#69775f'] ]),'#414c3d',1);
   // Reinforcing steel bands wrap around the corners, following perspective.
   for(const xx of [x+5,x+w-7]){
    poly([[xx,y-h+1],[xx+3,y-h+1],[xx+3,y-2],[xx,y-2]],'#4c5546','#2a352d',.6);
    line(xx+.5,y-h+4,xx+.5,y-3,'#c0b897',.75);
    const offset=xx===x+5?5:w-7;
    line(x+offset,y-h,x+offset+d,y-h-d*.5,'#586350',2.0);
   }
   line(x+3,y-h+4,x+w-3,y-h+4,'#d1ceaf',1.7);
   line(x+2,y-4,x+w-2,y-4,'#252d2a',1.35);
   // Hinges, recessed handle and painted serial label.
   poly([[x+w*.33,y-h*.67],[x+w*.65,y-h*.67],[x+w*.65,y-h*.48],[x+w*.33,y-h*.48]],'#344338','#26312b',.7);
   line(x+w*.39,y-h*.59,x+w*.59,y-h*.59,'#a5b5a5',1.7);
   c.fillStyle=accent;c.fillRect(x+w*.73,y-h*.39,Math.max(3,w*.12),2.3);
   c.fillStyle='#e5dcc2';c.fillRect(x+w*.73+1,y-h*.39+.3,Math.max(1,w*.035),1.5);
   for(const xx of [x+3,x+w-4])for(const yy of [y-h+4,y-4]){
    c.fillStyle='#d4c9a5';c.beginPath();c.arc(xx,yy,1.1,0,Math.PI*2);c.fill();
   }
   wear(x+3,y-h+5,w-6,h-9,23);
  };
  const barrel=(x:number,y:number,body='#647360')=>{
   // Rounded metal drum, elliptical top, curved highlights and retaining rings.
   c.fillStyle='#2e3029';c.beginPath();c.ellipse(x+1,y+1,14,5.5,.1,0,Math.PI*2);c.fill();
   c.fillStyle=shade(x-13,y-32,x+13,y-32,[[0,'#2e382f'],[.25,'#9d9d78'],[.63,body],[1,'#343e33']]);
   c.fillRect(x-13,y-30,26,30);
   c.fillStyle='#86947a';c.beginPath();c.ellipse(x,y-30,13,4.9,0,0,Math.PI*2);c.fill();
   c.strokeStyle='#343d33';c.lineWidth=1.8;c.stroke();
   c.fillStyle='#aeb296';c.beginPath();c.ellipse(x-1,y-31,10,3.3,0,0,Math.PI*2);c.fill();
   for(const h of [7,22]){
    c.fillStyle='#29352e';c.fillRect(x-13,y-h-3,26,3);
    line(x-11,y-h-3,x+10,y-h-3,'#bdc1a1',1.1);
   }
   line(x-8,y-25,x-8,y-6,'#d4d0a588',2);
   c.fillStyle=accent;c.fillRect(x+3,y-20,6.7,8);
   line(x+3,y-20,x+9,y-20,'#e2dbb1',1);
   wear(x-10,y-25,19,20,14);
  };
  cast(45,85,kind==='lamp'?22:kind==='stack'||kind==='pallet'?29:24);
  switch(kind){
   case 'crate': crate(18,83,46,33,14);break;
   case 'stack':
    crate(12,84,35,28,13);
    crate(48,85,29,25,9);
    crate(27,54,38,25,12);
    break;
   case 'barrel': barrel(48,84);break;
   case 'fuel':
    barrel(36,83,'#556c5c');barrel(63,86,'#807454');
    line(40,52,43,45,'#303c36',2.4);line(43,45,65,45,'#303c36',2.4);
    poly([[43,40],[61,40],[64,44],[42,45]],'#454e43','#adb092',1);
    break;
   case 'terminal':{
    poly([[22,78],[54,78],[69,70],[69,44],[54,50],[22,50]],'#333e39');
    poly([[54,49],[69,43],[69,77],[54,84]],shade(54,43,69,84,[[0,'#606b5c'],[1,'#2b352e']]));
    poly([[22,50],[54,50],[54,84],[22,84]],shade(22,50,54,80,[[0,'#939a84'],[1,'#4a5549']]));
    poly([[22,50],[37,43],[69,43],[54,50]],'#aaa78c');
    poly([[28,55],[48,55],[48,67],[28,67]],'#152c33','#a4aaa0',1.1);
    c.fillStyle=shade(30,56,47,66,[[0,'#176582'],[.5,'#4aa4b7'],[1,'#133646']]);c.fillRect(30,57,17,8);
    for(let i=0;i<3;i++)line(31,73+i*2,45,73+i*2,'#323a36',1);
    c.fillStyle=light;c.beginPath();c.arc(48,76,1.4,0,Math.PI*2);c.fill();
    line(23,83,55,83,'#262e2b',2);wear(25,52,30,24,15);
    break;
   }
   case 'pallet':
    poly([[10,75],[48,62],[84,74],[48,90]],'#88765a');
    poly([[10,75],[48,90],[84,74],[84,83],[48,98],[10,83]],'#51483a');
    for(let i=0;i<5;i++)line(16+i*13,78+i*1.5,46+i*8,67+i*1.3,'#d7c094',2.4);
    line(15,83,47,95,'#36372d',3);line(49,95,78,84,'#36372d',3);
    crate(22,74,32,23,11);
    c.strokeStyle='#252f2d';c.lineWidth=4;
    c.beginPath();c.ellipse(69,65,12,5,-.15,0,Math.PI*2);c.stroke();
    line(57,65,61,70,'#b4b3a0',1.5);
    break;
   case 'sandbags':
    for(let row=0;row<2;row++)for(let i=0;i<3-row;i++){
     const x=17+i*24+row*10,y=84-row*11+i*1.7;
     const fill=shade(x,y-8,x+20,y+6,[[0,'#d7c59a'],[.42,'#9f9878'],[1,'#736a50']]);
     c.fillStyle=fill;c.strokeStyle='#5a523e';c.lineWidth=.9;
     c.beginPath();c.ellipse(x+11,y,13,6.7,-.12,0,Math.PI*2);c.fill();c.stroke();
     line(x+4,y-2,x+19,y-2,'#e4d3aa',1.1);
     line(x+4,y+3,x+18,y+2,'#706b54',.8);
    }break;
   case 'bollard':
    poly([[40,79],[54,79],[59,86],[35,86]],'#464b45');
    poly([[43,45],[52,45],[52,80],[43,80]],shade(43,48,52,70,[[0,'#a3a89d'],[.4,'#52615c'],[1,'#2d3938']]));
    poly([[43,45],[47,42],[56,42],[52,45]],'#bcc2b2');
    poly([[52,45],[56,42],[56,78],[52,80]],'#263836');
    c.fillStyle=accent;c.fillRect(44,54,8,5);line(44,74,51,74,'#cdd6c7',1.1);break;
   case 'lamp':{
    // Real mast: ground flange, three-dimensional tapered steel pole and
    // down-facing service LED. Directional mast shadow lands on the sand.
    c.save();c.globalAlpha=.34;
    poly([[46,81],[50,84],[84,91],[80,88]],'#272217','',0);c.restore();
    poly([[35,80],[53,80],[60,88],[30,88]],'#454d48');
    poly([[39,77],[50,77],[54,82],[35,82]],'#8f958a');
    poly([[44,22],[51,22],[51,80],[44,80]],shade(44,24,51,24,[[0,'#293b3d'],[.32,'#b1b9aa'],[.63,'#586e68'],[1,'#202e31']]));
    poly([[51,22],[54,19],[54,78],[51,80]],'#253337');
    line(47,28,47,77,'#d0d0b4',.75);
    poly([[44,22],[49,18],[58,18],[54,22]],'#9baba6');
    // Narrow cantilever with recognisable elongated metal luminaire.
    poly([[48,18],[51,16],[64,17],[65,20],[53,20]],'#454e4b');
    poly([[55,14],[72,14],[77,19],[59,21]],shade(55,13,77,20,[[0,'#a4b3ac'],[.45,'#545f5a'],[1,'#252f2f']]));
    poly([[58,20],[77,18],[73,24],[59,25]],'#d1e4d9','#58615c',.8);
    poly([[61,22],[73,20],[70,23],[61,24]],light,'#6b8d88',.6);
    c.fillStyle=accent;c.fillRect(43,29,8,3.8);
    c.fillStyle='#c2d2c2';c.fillRect(48,43,1.7,5);
    break;
   }
   case 'groundlight':
    poly([[20,80],[55,77],[76,83],[39,89]],'#343d3c');
    poly([[26,75],[57,73],[72,79],[40,85]],shade(27,75,63,82,[[0,'#e5e7d5'],[.5,'#8e9b91'],[1,'#414c48']]));
    poly([[31,76],[57,75],[65,79],[39,81]],light,'#566761',.8);
    line(38,86,64,81,accent,1.7);
    break;
  }
  // Grain and sand dust follow the actual 3D faces. Cached once per art kind.
  wear(24,55,46,24,14);
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
