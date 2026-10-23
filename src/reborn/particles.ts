import type {Point} from './config.js';
type Particle={x:number;y:number;vx:number;vy:number;age:number;life:number;radius:number;color:string;drag:number};
/** Bounded, optional visual effects; local RNG is independent of the simulation. */
export class Particles {
 enabled=true;readonly limit=240;private items:Particle[]=[];private seed=7823;
 get count():number{return this.items.length;}
 clear():void{this.items=[];}
 private random():number{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 emit(type:'dust'|'impact'|'explosion'|'muzzle',p:Point,angle=0):void {
  if(!this.enabled)return;const count=type==='explosion'?26:type==='impact'?9:type==='muzzle'?3:4;
  for(let i=0;i<count&&this.items.length<this.limit;i++){
   const a=type==='muzzle'?angle+(this.random()-.5)*.6:this.random()*Math.PI*2,speed=(type==='explosion'?70:type==='impact'?42:type==='muzzle'?90:12)*(this.random()+.3);
   this.items.push({...p,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed*.55,age:0,life:type==='dust'?.6+this.random()*.4:type==='muzzle'?.045+this.random()*.04:.25+this.random()*.6,radius:type==='dust'?2+this.random()*3:type==='explosion'?2+this.random()*7:1+this.random()*2,color:type==='dust'?'#cdb28b':type==='explosion'?(i%3?'#ffb65a':'#4f4540'):type==='muzzle'?'#fff0bb':'#eecb87',drag:type==='dust'?2.5:1.6});
  }
 }
 update(dt:number):void{if(!this.enabled){this.clear();return;}for(const p of this.items){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-p.drag*dt);p.vy*=Math.exp(-p.drag*dt);}this.items=this.items.filter(p=>p.age<p.life);}
 draw(ctx:CanvasRenderingContext2D,visible:(p:Point)=>boolean):void{
  if(!this.enabled)return;ctx.save();for(const p of this.items){if(!visible(p))continue;const t=p.age/p.life;ctx.globalAlpha=(1-t)*(p.color==='#cdb28b'?.2:.8);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*(1+t*.65),0,Math.PI*2);ctx.fill();}ctx.restore();
 }
}
