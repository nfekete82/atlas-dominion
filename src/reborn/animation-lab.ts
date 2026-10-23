import {UnitPresentation} from './unit-presentation.js';
import {UNITS,type UnitKind} from './catalog.js';
import type {Unit} from './simulation.js';
import {turnTowards} from './sprite-animator.js';
const canvas=document.getElementById('lab') as HTMLCanvasElement,c=canvas.getContext('2d')!,presentation=new UnitPresentation();
const actors:Unit[]=[];let id=1,time=0,paused=false,last=performance.now(),hitLoop=-1;
function unit(kind:UnitKind,x:number,y:number,angle=0):Unit{const u:Unit={id:id++,kind,owner:0,x,y,previousX:x,previousY:y,hp:UNITS[kind].hp,orders:[],path:[],cooldown:0,facing:1,moving:false,hit:0,repath:0,angle,walkDistance:0,fire:0,lastAttacker:null,defendUntil:0};actors.push(u);return u;}
const idle=unit('infantry',140,220,.35),walkers=Array.from({length:8},(_,i)=>unit('infantry',540+(i%4)*86,145+Math.floor(i/4)*120,i*Math.PI/4));
const shooter=unit('infantry',1050,200,0),target=unit('heavy',1240,205,Math.PI);target.owner=1;
const rover=unit('rover',315,580,Math.PI/2),tank=unit('tank',660,590,0);tank.hullAngle=.3;
let victim=unit('infantry',1130,590,Math.PI/4);
const air=unit('scout',142,335,Math.PI/4),artillery=unit('artillery',660,685,.1);artillery.hullAngle=Math.PI*.4;
const sand=new Image();sand.src='/src/assets/reborn/desert-fine.png';await Promise.all([presentation.load(),sand.decode()]);
const labels=['01 / IDLE','02 / ACHT RICHTUNGEN','03 / FEUERWECHSEL','04 / FAHREN','05 / TURM + KANONE','06 / TREFFER + TOD'];
function tick(dt:number):void{
 const old=time;time+=dt;
 for(const [i,u] of walkers.entries()){
  const sign=Math.floor(time/1.2)%2===0?1:-1,a=i*Math.PI/4+(sign<0?Math.PI:0),distance=30*dt;
  u.angle=a;u.previousX=u.x;u.previousY=u.y;u.x+=Math.cos(a)*distance;u.y+=Math.sin(a)*distance;u.walkDistance+=distance;u.moving=true;
 }
 const a=(time-(1-Math.exp(-time*2))/2)*.55,rx=210+Math.cos(a)*105,ry=580+Math.sin(a)*46,oldR={x:rover.x,y:rover.y};
 rover.x=rx;rover.y=ry;rover.angle=Math.atan2(ry-oldR.y,rx-oldR.x);rover.hullAngle=turnTowards(rover.hullAngle??rover.angle,rover.angle,2.5,dt);rover.walkDistance+=Math.hypot(rx-oldR.x,ry-oldR.y);rover.moving=true;
 shooter.fire=time%.85<.18?.18-time%.85:0;target.hit=shooter.fire>0?.18:0;
 tank.angle=time*.65;artillery.angle=-time*.45;
 tank.fire=time%1.8<.18?.18-time%1.8:0;artillery.fire=time%3<.18?.18-time%3:0;
 const cycle=Math.floor(time/6),phase=time%6;
 if(cycle!==hitLoop){actors.splice(actors.indexOf(victim),1);victim=unit('infantry',1130,590,Math.PI/4);hitLoop=cycle;}
 victim.hit=phase>1&&phase<1.18?.18:0;
 if(phase>2.2)victim.hp=0;
 presentation.update(actors.filter(u=>u.hp>0),dt,()=>true);
 if(Math.floor(old/.85)!==Math.floor(time/.85))presentation.particles.emit('impact',{x:target.x,y:target.y-24});
}
function render():void{
 c.clearRect(0,0,1440,780);c.fillStyle='#cb9d69';c.fillRect(0,0,1440,780);c.globalAlpha=.4;c.drawImage(sand,0,0,1440,780);c.globalAlpha=1;
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=col*480,y=row*390;c.strokeStyle='#44392888';c.strokeRect(x+.5,y+.5,479,389);c.fillStyle='#172932e6';c.fillRect(x+14,y+14,250,28);c.fillStyle='#e3dbbc';c.font='bold 12px monospace';c.fillText(labels[row*3+col],x+26,y+33);
 }
 c.save();c.imageSmoothingEnabled=false;
 presentation.drawCorpses(c,()=>true);
 for(const u of actors)if(u.hp>0)presentation.draw(c,u,u);
 presentation.particles.draw(c,()=>true);c.restore();
 c.fillStyle='#263e49';c.font='11px monospace';for(const u of walkers)c.fillText(['E','SE','S','SW','W','NW','N','NE'][Math.round((u.angle%(Math.PI*2))/(Math.PI/4))%8],u.x-5,u.y+20);
 document.getElementById('status')!.textContent=`${time.toFixed(2)} s · ${presentation.particles.count}/240 Partikel · Hit/Death: ${presentation.inspect(victim.id)?.anim.state??'death'}`;
}
function frame(now:number):void{const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)tick(dt);render();requestAnimationFrame(frame);}
document.getElementById('pause')!.onclick=()=>{paused=!paused;document.getElementById('pause')!.textContent=paused?'Fortsetzen':'Pause';};
(document.getElementById('particles') as HTMLInputElement).onchange=e=>{presentation.particles.enabled=(e.target as HTMLInputElement).checked;presentation.particles.clear();};
document.getElementById('loading')!.remove();
Object.assign(window,{__animationLab:{presentation,actors,get time(){return time;},get paused(){return paused;},advance(seconds:number){paused=true;document.getElementById('pause')!.textContent='Fortsetzen';for(let t=0;t<seconds;t+=.025)tick(.025);render();},render}});
requestAnimationFrame(frame);
