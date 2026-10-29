import type {Point} from './config.js';
import type {Simulation} from './simulation.js';
import type {Territory} from './world.js';

export interface AtmosphereViewport {left:number;right:number;top:number;bottom:number}
const hash=(a:number,b:number,seed:number):number=>{
 let n=(Math.imul(a+29,73856093)^Math.imul(b+47,19349663)^seed)>>>0;
 n=Math.imul(n^(n>>>15),2246822519)>>>0;
 return ((n^(n>>>13))>>>0)/4294967296;
};
export interface Whirl {x:number;y:number;radius:number;opacity:number;phase:number}

/** Small, rare, deterministic dust eddies. No visibility, wind or combat effects. */
export function ambientDust(x:number,y:number,time:number,seed:number,reduced=false):Whirl|null {
 if(reduced||!Number.isFinite(time))return null;
 const variation=hash(Math.floor(x/100),Math.floor(y/100),seed);
 const period=26+variation*19;
 const age=(time+variation*period*3)%period;
 if(age>4.7)return null;
 const envelope=Math.sin(age/4.7*Math.PI)**2;
 if(envelope<.018)return null;
 return {x:x+age*5,y:y+Math.sin(age*1.3+variation*4)*3,
  radius:12+variation*12,opacity:envelope*.19,phase:age};
}

/** Existing building activity sprites already animate radar sweeps; augment with a tiny status beacon and cloth flag. */
export function bastionFlagPhase(time:number,id:number,reduced=false):number {
 return reduced?0:Math.sin(time*2.2+id*1.57)*3+Math.sin(time*3.7+id*.87)*1.2;
}

export class DesertAtmosphere {
 /** Fixed number of candidates per visible screen, world-grid keyed. */
 drawSand(c:CanvasRenderingContext2D,g:Simulation,view:AtmosphereViewport,reduced=false):void {
  if(reduced||g.paused||g.status!=='playing')return;
  const step=320,lowX=Math.floor(view.left/step),highX=Math.ceil(view.right/step),
    lowY=Math.floor(view.top/step),highY=Math.ceil(view.bottom/step);
  let drawn=0;
  for(let row=lowY;row<=highY&&drawn<14;row++)for(let col=lowX;col<=highX&&drawn<14;col++){
   const chance=hash(col,row,g.seed);
   if(chance>.33)continue;
   const base:Point={x:col*step+70+chance*180,y:row*step+65+hash(row,col,g.seed)*160};
   if(base.x<view.left||base.x>view.right||base.y<view.top||base.y>view.bottom||
      base.x<0||base.y<0||base.x>=g.world.size||base.y>=g.world.size||!g.canSee(0,base))continue;
   const i=g.world.index(base);if(i<0||g.world.blocked[i])continue;
   const w=ambientDust(base.x,base.y,g.time,g.seed,false);if(!w)continue;drawn++;
   c.save();c.translate(w.x,w.y);c.strokeStyle=`rgba(231,195,136,${w.opacity.toFixed(3)})`;
   c.lineCap='round';c.lineWidth=1.35;
   for(let turn=0;turn<3;turn++){
    const radius=w.radius*(.46+turn*.28),rise=turn*6;
    c.beginPath();c.ellipse(0,-rise,radius,radius*.19,-.15+w.phase*.08,
      Math.PI*.13,Math.PI*1.83);c.stroke();
   }
   c.globalAlpha=w.opacity*.55;c.fillStyle='#d9bd88';
   c.beginPath();c.ellipse(0,-4,w.radius*.68,w.radius*.15,0,0,Math.PI*2);c.fill();
   c.restore();
  }
 }
 drawBastion(c:CanvasRenderingContext2D,t:Territory,time:number,reduced=false):void {
  if(t.owner<0)return;
  const x=t.point.x+29,y=t.point.y-38,phase=bastionFlagPhase(time,t.id,reduced);
  c.save();
  c.strokeStyle='#6c5740';c.lineWidth=1.35;c.beginPath();c.moveTo(x,y+20);c.lineTo(x,y-10);c.stroke();
  c.fillStyle=t.owner===0?'#5fb7ed':'#e87162';
  c.beginPath();c.moveTo(x,y-10);c.quadraticCurveTo(x+10,y-13+phase,x+19,y-8+phase*.7);
  c.lineTo(x+15,y-2+phase*.5);c.quadraticCurveTo(x+6,y-5+phase*.5,x,y-3);c.closePath();c.fill();
  // Very low-key status diode; never a vision beacon or a fog-reveal effect.
  const pulse=reduced?.45:.3+.3*Math.max(0,Math.sin(time*2+t.id));
  c.globalAlpha=pulse;c.fillStyle=t.owner===0?'#a2deff':'#ffb298';
  c.beginPath();c.arc(x-16,y+5,2.7,0,Math.PI*2);c.fill();
  c.restore();
 }
}
