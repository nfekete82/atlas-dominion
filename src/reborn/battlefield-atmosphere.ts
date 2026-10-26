import { type Point } from './config.js';
import type { Simulation } from './simulation.js';
import { unitSpec } from './catalog.js';
import type { World } from './world.js';
import { seededRandom } from './world-generation.js';

export type GroundDetailKind = 'stones' | 'rock' | 'palm' | 'crater';
export interface GroundDetail extends Point {
  kind: GroundDetailKind;
  radius: number;
  rotation: number;
  variant: number;
}

/** Decorations are visual only: identical seeds have identical maps and navigation never changes. */
export function createGroundDetails(world: World, importantSites: readonly Point[]): GroundDetail[] {
  const random = seededRandom(world.seed ^ (world.mapVersion ? 0x5b79a6 : 0x1c64ad));
  const details: GroundDetail[] = [];
  const step = 88;
  for (let y = 65; y < world.size - 65; y += step) {
    for (let x = 65; x < world.size - 65; x += step) {
      if (random() > .56) continue;
      const at = {x: x + (random() - .5) * step * .75, y: y + (random() - .5) * step * .75};
      const chance = random();
      const kind: GroundDetailKind = chance < .51 ? 'stones' : chance < .79 ? 'rock' : chance < .96 ? 'crater' : 'palm';
      const radius = kind === 'palm' ? 23 + random() * 16 : kind === 'crater' ? 11 + random() * 23 : kind === 'rock' ? 9 + random() * 18 : 7 + random() * 12;
      const cell = world.index(at);
      if (cell < 0 || world.blocked[cell]) continue;
      // No art across capturable bastions, initial headquarters or narrow cliff edges.
      if (importantSites.some(p => Math.hypot(at.x - p.x, at.y - p.y) < (kind === 'palm' ? 125 : 92) + radius)) continue;
      if (kind === 'palm' && world.generated?.mesas.some(m => m.outline.some(p => Math.hypot(at.x - p.x, at.y - p.y) < 55))) continue;
      details.push({...at, kind, radius, rotation: random() * Math.PI * 2, variant: random()});
    }
  }
  return details;
}

function polygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string): void {
  c.fillStyle = color; c.beginPath();
  points.forEach((p,i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y));
  c.closePath(); c.fill();
}

function stone(c: CanvasRenderingContext2D, x: number, y: number, size: number, tint: number): void {
  c.fillStyle = '#5f482c43'; c.beginPath(); c.ellipse(x + size*.48,y + size*.26,size*1.05,size*.46,-.22,0,Math.PI*2);c.fill();
  const b = [{x:x-size*.8,y:y},{x:x-size*.6,y:y-size*.52},{x:x+size*.18,y:y-size*.91},{x:x+size*.82,y:y-size*.35},{x:x+size*.72,y:y+size*.15},{x:x-size*.17,y:y+size*.31}];
  polygon(c,[b[0],b[5],b[4],b[3],{x:b[3].x,y:b[3].y+size*.38},{x:b[0].x,y:b[0].y+size*.38}],tint>.5?'#806144':'#97714b');
  polygon(c,b,tint>.5?'#d7b17a':'#b99363');
  polygon(c,[b[0],b[1],b[2],{x:x-size*.17,y:y-size*.35}], '#f0cd91');
  polygon(c,[b[2],b[3],b[4],{x:x+size*.08,y:y-size*.25}], '#aa8052');
}

export function paintCrater(c: CanvasRenderingContext2D, p: Point, radius: number, rotation=0, alpha=1): void {
  c.save();c.translate(p.x,p.y);c.rotate(rotation);c.scale(1,.63);c.globalAlpha=alpha;
  const glow=c.createRadialGradient(-radius*.11,-radius*.14,radius*.08,0,0,radius*1.18);
  glow.addColorStop(0,'#382818b8');glow.addColorStop(.44,'#614021ad');
  glow.addColorStop(.72,'#a36a368c');glow.addColorStop(.86,'#f5cf8f8c');glow.addColorStop(1,'#f5cd8300');
  c.fillStyle=glow;c.beginPath();c.ellipse(0,0,radius*1.27,radius*1.27,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#e9bc748a';c.lineWidth=Math.max(1.5,radius*.13);
  c.beginPath();c.ellipse(-radius*.04,-radius*.04,radius*.85,radius*.83,0,Math.PI*1.07,Math.PI*1.88);c.stroke();
  c.strokeStyle='#4f341e72';c.lineWidth=Math.max(1,radius*.09);
  c.beginPath();c.ellipse(radius*.03,radius*.05,radius*.83,radius*.74,0,-.1,Math.PI*.83);c.stroke();
  c.restore();
}

function palm(c: CanvasRenderingContext2D, d: GroundDetail): void {
  const {x,y,radius:r,rotation,variant}=d;
  const top = {x:x-r*.18,y:y-r*.72};
  c.save();c.translate(x+r*.32,y+r*.22);c.rotate(-.28);
  c.fillStyle='#56472d44';c.beginPath();c.ellipse(0,0,r*1.45,r*.29,0,0,Math.PI*2);c.fill();c.restore();
  c.strokeStyle='#674c2e';c.lineCap='round';c.lineWidth=5.3;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-r*.22,y-r*.29,top.x,top.y);c.stroke();
  c.strokeStyle='#d3a46a';c.lineWidth=2;c.beginPath();c.moveTo(x-1,y-1);c.quadraticCurveTo(x-r*.28,y-r*.32,top.x-1,top.y);c.stroke();
  for(let i=0;i<8;i++){
    const a=rotation+i*Math.PI/4, length=r*(.78+(i%3)*.13),dx=Math.cos(a)*length,dy=Math.sin(a)*length*.48;
    const end={x:top.x+dx,y:top.y+dy+r*.15};
    c.fillStyle=i%3===0?'#5a7041':i%3===1?'#41623a':'#74834a';
    c.beginPath();c.moveTo(top.x,top.y);
    c.quadraticCurveTo(top.x+dx*.45-dy*.35,top.y+dy*.3-dx*.13, end.x,end.y);
    c.quadraticCurveTo(top.x+dx*.55+dy*.24,top.y+dy*.38+dx*.15,top.x,top.y);c.fill();
    c.strokeStyle='#b4a66a82';c.lineWidth=.75;
    c.beginPath();c.moveTo(top.x,top.y);c.quadraticCurveTo(top.x+dx*.7,top.y+dy*.32,end.x,end.y);c.stroke();
  }
  c.fillStyle=variant>.5?'#856c3f':'#b58e55';c.beginPath();c.arc(top.x,top.y,3.2,0,Math.PI*2);c.fill();
}

/** The expensive ground layer is baked once; no extra image download or per-frame rocks. */
export function paintGroundDetails(c: CanvasRenderingContext2D, details: readonly GroundDetail[]): void {
  for(const d of details){
    if(d.kind==='crater'){paintCrater(c,d,d.radius,d.rotation,.68);continue;}
    if(d.kind==='palm'){palm(c,d);continue;}
    const count=d.kind==='rock'?3+Math.floor(d.variant*3):5+Math.floor(d.variant*5);
    for(let i=0;i<count;i++){
      const a=d.rotation+i*2.39996, spread=(i%3+1)*d.radius*.22;
      const x=d.x+Math.cos(a)*spread,y=d.y+Math.sin(a)*spread*.64;
      const size=d.kind==='rock'?d.radius*(i===0?.56:.24):d.radius*(i===0?.27:.12);
      stone(c,x,y,size,(d.variant+i*.22)%1);
    }
  }
}

interface Mark extends Point {radius:number;rotation:number;created:number}
interface Smoke extends Point {created:number;duration:number;power:number;variant:number}
interface PreviousUnit extends Point { vehicle:boolean; hp:number }
interface PreviousBase extends Point { hp:number }

/** Bounded rendering-only marks and smoke, separated from authoritative simulation state. */
export class BattlefieldEffects {
  private marks:Mark[]=[];
  private clouds:Smoke[]=[];
  private units=new Map<number,PreviousUnit>();
  private bases=new Map<number,PreviousBase>();
  private hits=0;

  reset(game:Simulation):void {
    this.marks=[];this.clouds=[];this.hits=0;
    this.units=new Map(game.units.filter(u=>u.hp>0).map(u=>[u.id,{x:u.x,y:u.y,hp:u.hp,vehicle:unitSpec(u).group!=='Infanterie'}]));
    this.bases=new Map(game.bases.map(b=>[b.id,{x:b.x,y:b.y,hp:b.hp}]));
  }

  impact(p:Point,time:number):void {
    this.hits++;
    // A machine gun must not dig a crater on every single round.
    if(this.hits%7===0) {
      const r=8+(this.hits%4)*3;
      this.marks.push({...p,y:p.y+13,radius:r,rotation:(this.hits*2.39996)%(Math.PI*2),created:time});
      if(this.marks.length>96)this.marks.shift();
    }
    if(this.hits%9===0)this.addSmoke({x:p.x,y:p.y+12},time,2.5,.37);
  }

  private addSmoke(p:Point,time:number,duration:number,power:number):void {
    this.clouds.push({...p,created:time,duration,power,variant:(this.hits*.618033+this.clouds.length*.29)%1});
    if(this.clouds.length>32)this.clouds.shift();
  }

  update(game:Simulation,visible:(p:Point)=>boolean):void {
    const current=new Map<number,PreviousUnit>();
    for(const u of game.units)if(u.hp>0)current.set(u.id,{x:u.x,y:u.y,hp:u.hp,vehicle:unitSpec(u).group!=='Infanterie'});
    for(const [id,old] of this.units)if(!current.has(id)&&old.vehicle&&visible(old))this.addSmoke(old,game.time,30,1.35);
    this.units=current;
    const bases=new Map<number,PreviousBase>();
    for(const b of game.bases)bases.set(b.id,{x:b.x,y:b.y,hp:b.hp});
    for(const [id,old] of this.bases)if(old.hp>0&&(bases.get(id)?.hp??0)<=0&&visible(old))this.addSmoke(old,game.time,38,1.65);
    this.bases=bases;
    this.clouds=this.clouds.filter(s=>game.time-s.created<s.duration);
  }

  drawMarks(c:CanvasRenderingContext2D,game:Simulation):void {
    for(const m of this.marks)if(game.hasExplored(0,m))
      paintCrater(c,m,m.radius,m.rotation,.82);
  }

  drawSmoke(c:CanvasRenderingContext2D,game:Simulation,reducedMotion:boolean):void {
    c.save();
    for(const s of this.clouds){
      if(!game.canSee(0,s))continue;
      const t=Math.max(0,Math.min(1,(game.time-s.created)/s.duration));
      const envelope=Math.min(1,t*7)*(1-t)**1.15;
      if(envelope<=0)continue;
      const drift=reducedMotion?0:t*36*s.power;
      const radius=17+27*s.power;
      for(let i=0;i<5;i++){
        const angle=i*2.39996+s.variant*6.283;
        const dx=Math.cos(angle)*(i%2?9:17)*s.power+drift;
        const dy=Math.sin(angle)*(i%2?6:10)*s.power-t*56*s.power-i*8;
        const r=radius*(.55+i*.105)*(1+t*.62);
        const g=c.createRadialGradient(s.x+dx,s.y+dy,0,s.x+dx,s.y+dy,r);
        const alpha=Math.min(.58,(.29+i*.045)*envelope);
        g.addColorStop(0,'rgba(35,33,30,'+alpha.toFixed(3)+')');
        g.addColorStop(.55,'rgba(66,61,52,'+(alpha*.64).toFixed(3)+')');
        g.addColorStop(1,'rgba(74,70,64,0)');
        c.fillStyle=g;c.beginPath();c.arc(s.x+dx,s.y+dy,r,0,Math.PI*2);c.fill();
      }
      if(s.power>1&&t<.13&&!reducedMotion){
        const glow=c.createRadialGradient(s.x,s.y,0,s.x,s.y,19*s.power);
        glow.addColorStop(0,'rgba(255,223,134,.73)');glow.addColorStop(.5,'rgba(241,113,35,.37)');glow.addColorStop(1,'rgba(230,84,20,0)');
        c.globalAlpha=1-t/.13;c.fillStyle=glow;c.beginPath();c.arc(s.x,s.y,19*s.power,0,Math.PI*2);c.fill();c.globalAlpha=1;
      }
    }
    c.restore();
  }
}
