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
  const step = 100;
  for (let y = 65; y < world.size - 65; y += step) {
    for (let x = 65; x < world.size - 65; x += step) {
      if (random() > .48) continue;
      const at = {x: x + (random() - .5) * step * .75, y: y + (random() - .5) * step * .75};
      const chance = random();
      const kind: GroundDetailKind = chance < .40 ? 'stones' : chance < .76 ? 'rock' : chance < .94 ? 'crater' : 'palm';
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

/** Art-directed vector sprites: detailed surfaces are rendered by the browser, not approximated with primitive polygons. */
export interface GroundSprites {
  crater: CanvasImageSource;
  palm: CanvasImageSource;
  rocks: CanvasImageSource;
}

/** Rims and cavities have separately lit textures; irregular sprite edge merges with the sand. */
export function paintCrater(c:CanvasRenderingContext2D,p:Point,radius:number,rotation:number,alpha:number,sprite:CanvasImageSource):void {
  const w=radius*3.4,h=radius*2.5;
  c.save();c.translate(p.x,p.y);
  // Keep light coming from the same direction on all terrain objects.
  c.rotate(Math.sin(rotation)*.13);
  c.globalAlpha=alpha;
  c.drawImage(sprite,-w/2,-h/2,w,h);
  c.restore();
}

/** Static decoration is baked into the existing native-resolution terrain canvas once per map. */
export function paintGroundDetails(c:CanvasRenderingContext2D,details:readonly GroundDetail[],sprites:GroundSprites):void {
  for(const d of details){
    if(d.kind==='crater'){paintCrater(c,d,d.radius,d.rotation,1,sprites.crater);continue;}
    if(d.kind==='palm'){
      const w=d.radius*3.55,h=d.radius*3.5;
      c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
      c.globalAlpha=.96;
      // Sprite trunk-foot (83% of image height) is anchored to the ground point.
      c.drawImage(sprites.palm,-w*.5,-h*.58,w,h);
      c.restore();
      continue;
    }
    const w=d.radius*(d.kind==='rock'?3.7:2.3),h=d.radius*(d.kind==='rock'?2.4:1.55);
    c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.11);
    c.globalAlpha=d.kind==='rock'?.94:.75;
    c.drawImage(sprites.rocks,-w*.5,-h*.6,w,h);
    c.restore();
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
  private craterSprite:CanvasImageSource|null=null;
  setCraterSprite(image:CanvasImageSource):void{this.craterSprite=image;}
  get markCount():number{return this.marks.length;}
  get smokeCount():number{return this.clouds.length;}

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

  /** Rocket explosions leave larger scars than light infantry rounds. */
  blast(p:Point,time:number):void {
    this.hits++;
    this.marks.push({...p,radius:23+(this.hits%4)*3,rotation:(this.hits*2.39996)%(Math.PI*2),created:time});
    if(this.marks.length>96)this.marks.shift();
    this.addSmoke(p,time,10,1.1);
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
    if(!this.craterSprite)return;
    for(const m of this.marks)if(game.hasExplored(0,m))
      paintCrater(c,m,m.radius,m.rotation,1,this.craterSprite);
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
