import { type Point } from './config.js';
import { type World } from './world.js';
import { seededRandom, type Mesa, type MesaColumn } from './world-generation.js';
import { fineSandPattern } from './fine-sand.js';

function polygon(c:CanvasRenderingContext2D,points:Point[],color:string):void {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();
}
function facePath(c:CanvasRenderingContext2D,points:Point[]):void{
  c.beginPath();for(let i=0;i<points.length;i++)i?c.lineTo(points[i].x,points[i].y):c.moveTo(points[i].x,points[i].y);c.closePath();
}
function mineralGrain(c:CanvasRenderingContext2D,pattern:CanvasPattern,points:Point[],alpha:number):void{
  c.save();facePath(c,points);c.clip();c.globalCompositeOperation='multiply';c.globalAlpha=alpha;c.fillStyle=pattern;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);c.fillRect(x,y,Math.max(...xs)-x,Math.max(...ys)-y);c.restore();
}
function rockColumn(c:CanvasRenderingContext2D,column:MesaColumn,grain:CanvasPattern):void {
  const {base,top,height,shade}=column,cx=base.reduce((s,p)=>s+p.x,0)/base.length,cy=base.reduce((s,p)=>s+p.y,0)/base.length;
  const random=seededRandom((Math.round(cx*71)^Math.round(cy*113)^Math.round(height*997))>>>0);
  const faces=base.map((a,i)=>({a,b:base[(i+1)%base.length],ta:top[i],tb:top[(i+1)%top.length]})).filter(f=>(f.a.y+f.b.y)/2>cy-4).sort((a,b)=>(a.a.y+a.b.y)-(b.a.y+b.b.y));
  for(const {a,b,ta,tb} of faces){
    const sun=(a.x+b.x)/2<cx,points=[a,b,tb,ta],gradient=c.createLinearGradient(ta.x,Math.min(ta.y,tb.y),a.x,Math.max(a.y,b.y));
    gradient.addColorStop(0,sun?'#f4e1bf':'#b9a282');gradient.addColorStop(.38,sun?'#e1caa8':'#ad9476');gradient.addColorStop(.82,sun?'#d1b68f':'#a58d6e');gradient.addColorStop(1,sun?'#e5cba1':'#cab18a');
    facePath(c,points);c.fillStyle=gradient;c.fill();
    c.save();facePath(c,points);c.clip();
    for(let n=0;n<2;n++){
      const u=.1+random()*.8,begin={x:ta.x+(tb.x-ta.x)*u,y:ta.y+(tb.y-ta.y)*u},depth=.35+random()*.6;
      c.strokeStyle='#58462f45';c.lineWidth=.5+random()*.5;c.beginPath();c.moveTo(begin.x,begin.y+2);c.lineTo(begin.x+(random()-.5)*8,begin.y+height*.25);c.lineTo(begin.x+(a.x-ta.x)*depth+(random()-.5)*8,begin.y+height*depth);c.stroke();
    }
    c.restore();
    const width=Math.hypot(tb.x-ta.x,tb.y-ta.y)||1,depth=Math.hypot(a.x-ta.x,a.y-ta.y)||1;
    // Project the material along each face; horizontal strata must turn with
    // the rock instead of continuing like one flat photograph over the outcrop.
    grain.setTransform(new DOMMatrix([(tb.x-ta.x)/width*.25,(tb.y-ta.y)/width*.25,(a.x-ta.x)/depth*.25,(a.y-ta.y)/depth*.25,ta.x-random()*80,ta.y-random()*80]));
    mineralGrain(c,grain,points,.96);
    c.strokeStyle=sun?'#e4c99b65':'#c5ad8650';c.lineWidth=.8;c.beginPath();c.moveTo(ta.x,ta.y+1);c.lineTo(tb.x,tb.y+1);c.stroke();
  }
  const center={x:top.reduce((s,p)=>s+p.x,0)/top.length,y:top.reduce((s,p)=>s+p.y,0)/top.length};
  const gradient=c.createLinearGradient(center.x-30,center.y-30,center.x+35,center.y+30);gradient.addColorStop(0,'#fae5bf');gradient.addColorStop(.6,shade>.5?'#e5cfaa':'#efdbb9');gradient.addColorStop(1,'#cdb38d');
  facePath(c,top);c.fillStyle=gradient;c.fill();grain.setTransform(new DOMMatrix([.25,0,.08,.12,center.x-random()*80,center.y-random()*50]));mineralGrain(c,grain,top,.64);
  // Weathered caprock, with uneven inset terraces rather than a clean polygon bevel.
  for(const scale of [.95]){
    const rim=top.map(p=>({x:center.x+(p.x-center.x)*scale,y:center.y+(p.y-center.y)*scale+(random()-.5)*3}));
    c.strokeStyle='#f0d5a752';c.lineWidth=.8;facePath(c,rim);c.stroke();
  }
  for(let n=0;n<2;n++){
    const a=top[Math.floor(random()*top.length)],bend={x:center.x+(random()-.5)*20,y:center.y+(random()-.5)*12};
    c.strokeStyle='#75634749';c.lineWidth=.8;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(bend.x,bend.y);c.lineTo(bend.x+10+random()*12,bend.y+random()*10);c.stroke();
  }
}
export function paintMesas(c:CanvasRenderingContext2D,mesas:Mesa[],seed:number,stone:HTMLImageElement):void {
  const random=seededRandom(seed^0x96a1f7),grain=sandPattern(c,stone);grain.setTransform(new DOMMatrix().scale(.28,.24));
  // Soft contact, dust and scree blend the same impassable footprint into the sand.
  for(const mesa of mesas){
    const left=Math.min(...mesa.outline.map(p=>p.x)),right=Math.max(...mesa.outline.map(p=>p.x)),bottom=Math.max(...mesa.outline.map(p=>p.y));
    const cx=(left+right)/2,r=(right-left)*.65;
    c.save();c.translate(cx,bottom-8);c.scale(1,.35);
    const contact=c.createRadialGradient(0,0,6,0,0,r);contact.addColorStop(0,'#4c41335c');contact.addColorStop(.55,'#7862462e');contact.addColorStop(1,'#a58b6200');c.fillStyle=contact;c.fillRect(-r,-r,r*2,r*2);c.restore();
  }
  for(const mesa of [...mesas].sort((a,b)=>Math.max(...a.outline.map(p=>p.y))-Math.max(...b.outline.map(p=>p.y)))){
    for(const column of mesa.columns)rockColumn(c,column,grain);
    const bottom=Math.max(...mesa.outline.map(p=>p.y)),left=Math.min(...mesa.outline.map(p=>p.x)),right=Math.max(...mesa.outline.map(p=>p.x));
    for(let n=0;n<44;n++){
      const x=left+random()*(right-left),y=bottom-9+random()*25,r=.8+random()*3.8;
      polygon(c,[{x:x-r-1,y:y+1},{x:x+r+2,y:y+1},{x:x+r,y:y+3},{x:x-r,y:y+2}],'#5f50342c');
      polygon(c,[{x:x-r,y},{x:x-r*.4,y:y-r*.85},{x:x+r*.55,y:y-r*.7},{x:x+r,y:y+1},{x,y:y+r*.3}],'#9c856462');
      polygon(c,[{x:x-r*.4,y:y-r*.85},{x:x+r*.55,y:y-r*.7},{x:x+r*.4,y:y-r*.15},{x:x-r*.5,y:y-r*.05}],'#d7bb8d');
    }
    // Crystals remain in versioned map data for save/seed compatibility, but
    // are no longer painted: these are natural, non-resource sandstone outcrops.
  }
}
/** Blend only tile edges with wrapped interior samples. The source stays at fine
 * ground scale, and neither brightness seams nor mirrored lighting are repeated. */
function sandPattern(c:CanvasRenderingContext2D,image:HTMLImageElement):CanvasPattern {
  const size=1024,tile=document.createElement('canvas');tile.width=tile.height=size;
  const tc=tile.getContext('2d',{willReadFrequently:true})!;tc.drawImage(image,0,0,size,size);
  const source=tc.getImageData(0,0,size,size),result=tc.createImageData(size,size);
  const weight=Float32Array.from({length:size},(_,x)=>Math.sin(Math.min(1,Math.min(x,size-x)/96)*Math.PI/2)**2);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const wx=weight[x],wy=weight[y],sx=(x+size/2)%size,sy=(y+size/2)%size;
    const a=(y*size+x)*4,b=(y*size+sx)*4,d=(sy*size+x)*4,e=(sy*size+sx)*4;
    for(let k=0;k<3;k++)result.data[a+k]=(source.data[a+k]*wx+source.data[b+k]*(1-wx))*wy+(source.data[d+k]*wx+source.data[e+k]*(1-wx))*(1-wy);
    result.data[a+3]=255;
  }
  tc.putImageData(result,0,0);return c.createPattern(tile,'repeat')!;
}
/** Native-resolution relief with granular sand and shallow, traversable dunes. */
export function paintGeneratedTerrain(canvas:HTMLCanvasElement,world:World,sand:HTMLImageElement,stone:HTMLImageElement):void {
  canvas.width=canvas.height=world.size;const c=canvas.getContext('2d',{willReadFrequently:true})!,random=seededRandom(world.seed^0x12bda3),pixels=c.createImageData(world.size,world.size);
  const broad=new Float32Array(33*33);for(let i=0;i<broad.length;i++)broad[i]=(random()-.5)*17;
  for(let y=0;y<world.size;y++)for(let x=0;x<world.size;x++){
    const gx=x/128,gy=y/128,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const n=(broad[iy*33+ix]*(1-fx)+broad[iy*33+ix+1]*fx)*(1-fy)+(broad[(iy+1)*33+ix]*(1-fx)+broad[(iy+1)*33+ix+1]*fx)*fy;
    const grain=(random()-.5)*3,i=(y*world.size+x)*4;
    pixels.data[i]=222+n+grain;pixels.data[i+1]=180+n*.85+grain;pixels.data[i+2]=113+n*.65+grain;pixels.data[i+3]=255;
  }
  c.putImageData(pixels,0,0);
  const pattern=fineSandPattern(c,sand);pattern.setTransform(new DOMMatrix().translate(Math.floor(random()*1240),Math.floor(random()*1240)).scale(.62));
  c.save();c.globalAlpha=.80;c.fillStyle=pattern;c.fillRect(0,0,world.size,world.size);c.restore();
  paintMesas(c,world.generated!.mesas,world.seed,stone);
}
