import { type Point } from './config.js';
import { type World } from './world.js';
import { seededRandom, type Mesa, type MesaColumn } from './world-generation.js';

function polygon(c:CanvasRenderingContext2D,points:Point[],color:string):void {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();
}
function rockColumn(c:CanvasRenderingContext2D,column:MesaColumn):void {
  const {base,top,height,shade}=column,cx=base.reduce((s,p)=>s+p.x,0)/base.length,cy=base.reduce((s,p)=>s+p.y,0)/base.length;
  const faces=base.map((a,i)=>({a,b:base[(i+1)%base.length],ta:top[i],tb:top[(i+1)%top.length],i})).filter(f=>(f.a.y+f.b.y)/2>cy-4).sort((a,b)=>(a.a.y+a.b.y)-(b.a.y+b.b.y));
  for(const {a,b,ta,tb,i} of faces){
    const nx=(a.x+b.x)/2-cx,light=nx<0?1:.58;
    const value=light+shade*.12;
    polygon(c,[a,b,tb,ta],`rgb(${Math.round(140*value)},${Math.round(96*value)},${Math.round(50*value)})`);
    const u=.25+(i%3)*.17,mid={x:ta.x+(tb.x-ta.x)*u,y:ta.y+(tb.y-ta.y)*u};
    polygon(c,[mid,{x:mid.x+height*.12,y:mid.y+height*.78},{x:a.x+(b.x-a.x)*(u+.12),y:a.y+(b.y-a.y)*(u+.12)},b,tb],`rgba(38,27,18,${.05+(i%3)*.035})`);
    // Narrow structural fractures, with a sunlit edge on their left.
    c.strokeStyle='#432d2070';c.lineWidth=1.2;c.beginPath();c.moveTo(mid.x,mid.y+3);c.lineTo(mid.x+height*.045,mid.y+height*.34);c.lineTo(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-5);c.stroke();
    c.strokeStyle='#e4b56a55';c.lineWidth=1;c.beginPath();c.moveTo(ta.x+1,ta.y+3);c.lineTo(a.x+1,a.y-2);c.stroke();
  }
  polygon(c,top,'#c69a53');
  const center={x:top.reduce((s,p)=>s+p.x,0)/top.length,y:top.reduce((s,p)=>s+p.y,0)/top.length};
  const inner=top.map(p=>({x:center.x+(p.x-center.x)*.91,y:center.y+(p.y-center.y)*.88-2}));
  polygon(c,inner,shade>.5?'#e1b976':'#d9ad67');
  for(let i=0;i<top.length;i++)if(i%3===0)polygon(c,[top[i],inner[i],inner[(i+1)%top.length],top[(i+1)%top.length]],'#f4d28b');
  c.strokeStyle='#8b652f4d';c.lineWidth=.8;c.beginPath();c.moveTo(inner[0].x,inner[0].y);c.lineTo(center.x+3,center.y-2);c.lineTo(inner[3].x,inner[3].y);c.stroke();
}
function crystals(c:CanvasRenderingContext2D,p:Point):void {
  for(const [dx,dy,h,w] of [[-13,0,24,8],[0,3,38,11],[12,5,22,7],[-3,11,15,6]]){
    const x=p.x+dx,y=p.y+dy;
    polygon(c,[{x:x-w,y},{x,y:y-h},{x:x+w,y:y-h*.76},{x:x+w,y:y-3},{x,y:y+3}],'#4296ae');
    polygon(c,[{x:x-w,y},{x:x-w,y:y-h*.77},{x,y:y-h},{x,y:y+3}],'#7cc8d7');
    polygon(c,[{x,y:y-h},{x:x+w,y:y-h*.76},{x,y:y-h*.60},{x:x-w,y:y-h*.77}],'#a7e0e6');
  }
}
export function paintMesas(c:CanvasRenderingContext2D,mesas:Mesa[],seed:number):void {
  const random=seededRandom(seed^0x96a1f7);
  // Terrain and its contact shadows are baked together once per generated map.
  for(const mesa of mesas){
    const shadow=mesa.outline.map(p=>({x:p.x+29,y:p.y+19}));
    polygon(c,shadow,'#523e2f36');
  }
  for(const mesa of [...mesas].sort((a,b)=>Math.max(...a.outline.map(p=>p.y))-Math.max(...b.outline.map(p=>p.y)))){
    for(const column of mesa.columns)rockColumn(c,column);
    const bottom=Math.max(...mesa.outline.map(p=>p.y)),left=Math.min(...mesa.outline.map(p=>p.x)),right=Math.max(...mesa.outline.map(p=>p.x));
    for(let n=0;n<24;n++){
      const x=left+random()*(right-left),y=bottom-10+random()*26,r=1.4+random()*4.5;
      polygon(c,[{x:x-r,y},{x:x-r*.4,y:y-r*.85},{x:x+r*.55,y:y-r*.7},{x:x+r,y:y+1},{x,y:y+r*.3}],'#9b764648');
      polygon(c,[{x:x-r*.4,y:y-r*.85},{x:x+r*.55,y:y-r*.7},{x:x+r*.4,y:y-r*.15},{x:x-r*.5,y:y-r*.05}],'#ebca8c');
    }
    if(mesa.crystals)crystals(c,mesa.crystals);
  }
}
/** Native-resolution facets and quiet sand; no upscaled landscape bitmap. */
export function paintGeneratedTerrain(canvas:HTMLCanvasElement,world:World):void {
  canvas.width=canvas.height=world.size;const c=canvas.getContext('2d',{willReadFrequently:true})!,random=seededRandom(world.seed^0x12bda3),pixels=c.createImageData(world.size,world.size);
  const broad=new Float32Array(33*33);for(let i=0;i<broad.length;i++)broad[i]=(random()-.5)*17;
  for(let y=0;y<world.size;y++)for(let x=0;x<world.size;x++){
    const gx=x/128,gy=y/128,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const n=(broad[iy*33+ix]*(1-fx)+broad[iy*33+ix+1]*fx)*(1-fy)+(broad[(iy+1)*33+ix]*(1-fx)+broad[(iy+1)*33+ix+1]*fx)*fy;
    const grain=(random()-.5)*3,i=(y*world.size+x)*4;
    pixels.data[i]=222+n+grain;pixels.data[i+1]=180+n*.85+grain;pixels.data[i+2]=113+n*.65+grain;pixels.data[i+3]=255;
  }
  c.putImageData(pixels,0,0);
  // Sparse angular crust patches and wind ripples retain the reference's broad,
  // readable sand plains instead of magnifying gravel to unit-sized stones.
  for(let n=0;n<160;n++){
    const x=random()*world.size,y=random()*world.size,r=35+random()*125;
    c.strokeStyle='#9d774817';c.lineWidth=.7;
    for(let j=0;j<5;j++){
      c.beginPath();c.moveTo(x-r*.5+j*r*.12,y-r*.3);c.lineTo(x-r*.25+j*r*.12,y);c.lineTo(x+j*r*.12,y+r*.18);c.lineTo(x+j*r*.10,y+r*.35);c.stroke();
    }
    c.strokeStyle='#fff1bc12';c.lineWidth=1;
    for(let j=0;j<4;j++){c.beginPath();c.ellipse(x,y+j*5,r,r*.13,-.18,0,Math.PI);c.stroke();}
  }
  paintMesas(c,world.generated!.mesas,world.seed);
}
