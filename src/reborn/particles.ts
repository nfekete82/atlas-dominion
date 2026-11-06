import type {Point} from './config.js';
type Kind='dust'|'impact'|'explosion'|'muzzle'|'smoke'|'repair'|'build'|'heal';
type Particle={x:number;y:number;vx:number;vy:number;age:number;life:number;radius:number;color:string;drag:number;trace:boolean;armored:boolean;tx:number;ty:number};
/** Shared, bounded and recycled storage for work, weapon flashes and ballistic trails. */
export class Particles {
 enabled=true;reducedMotion=false;readonly limit=240;private items:Particle[]=[];private pool:Particle[]=[];private seed=7823;
 get count():number{return this.items.length;}
 clear():void{while(this.items.length)this.pool.push(this.items.pop()!);}
 private random():number{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 private add(p:Point,vx:number,vy:number,life:number,radius:number,color:string,drag:number,trace=false,armored=false,tx=0,ty=0):void{
  if(this.items.length>=this.limit)return;
  const item=this.pool.pop()??{} as Particle;
  Object.assign(item,{x:p.x,y:p.y,vx,vy,life,radius,color,drag,age:0,trace,armored,tx,ty});this.items.push(item);
 }
 emit(type:Kind,p:Point,angle=0):void {
  if(!this.enabled)return;
  const count=this.reducedMotion?(type==='muzzle'?1:0):type==='explosion'?18:type==='impact'?4:type==='muzzle'?3:type==='smoke'?2:type==='heal'?1:3;
  for(let i=0;i<count;i++){
   const directional=type==='muzzle',a=directional?angle+(this.random()-.5)*.5:this.random()*Math.PI*2;
   const speed=this.reducedMotion?0:(type==='explosion'?65:type==='impact'||type==='repair'||type==='build'?32:type==='muzzle'?50:9)*(this.random()+.3);
   const dusty=type==='dust'||type==='smoke';
   this.add(p,Math.cos(a)*speed,Math.sin(a)*speed*.55-(type==='smoke'?5:0),dusty?.35+this.random()*.3:type==='muzzle'?.045:.18+this.random()*.25,
    dusty?2+this.random()*2:type==='explosion'?2+this.random()*5:type==='muzzle'?2.2:1,
    type==='dust'?'#cdb28b':type==='smoke'?'#b3afa1':type==='heal'?'#8bdfa3':type==='build'?'#ffb35b':type==='explosion'?(i%3?'#ffb65a':'#4f4540'):type==='muzzle'?'#fff0bb':'#ffe6a0',dusty?2.5:1.6);
  }
 }
 shot(from:Point,to:Point,heavy=false,armored=false):void{
  if(!this.enabled)return;
  const angle=Math.atan2(to.y-from.y,to.x-from.x);this.emit('muzzle',from,angle);this.emit('smoke',from,angle);
  if(heavy&&!this.reducedMotion)this.add(from,0,0,.05,4,'#ffd98a',0);
  if(this.reducedMotion)return;
  const d=Math.hypot(to.x-from.x,to.y-from.y),speed=heavy?1300:1100;
  if(d<1)return;const spread=(this.random()-.5)*3,tx=to.x-Math.sin(angle)*spread,ty=to.y+Math.cos(angle)*spread;
  this.add(from,(tx-from.x)/(d/speed),(ty-from.y)/(d/speed),d/speed,1,'#ffe5a0',0,true,armored,tx,ty);
 }
 update(dt:number):void{
  if(!this.enabled){this.clear();return;}if(dt<=0)return;
  // In-place removal and reuse avoids frame-by-frame particle array/object creation.
  const count=this.items.length;
  for(let i=count-1;i>=0;i--){const p=this.items[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-p.drag*dt);p.vy*=Math.exp(-p.drag*dt);
   if(p.age>=p.life){const impact=p.trace,armored=p.armored,x=p.tx,y=p.ty;this.items[i]=this.items[this.items.length-1];this.items.pop();this.pool.push(p);if(impact)this.emit(armored?'impact':'dust',{x,y});}
  }
 }
 draw(ctx:CanvasRenderingContext2D,visible:(p:Point)=>boolean):void{
  if(!this.enabled)return;ctx.save();ctx.lineCap='round';for(const p of this.items){if(!visible(p))continue;const t=p.age/p.life;
   if(p.trace){const speed=Math.hypot(p.vx,p.vy),length=Math.min(12,speed*p.age);ctx.globalAlpha=.85;ctx.strokeStyle=p.color;ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx/speed*length,p.y-p.vy/speed*length);ctx.stroke();continue;}
   ctx.globalAlpha=(1-t)*(p.color==='#cdb28b'?.23:p.color==='#b3afa1'?.13:.8);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*(1+t*.65),0,Math.PI*2);ctx.fill();
  }ctx.restore();
 }
}
