import { type Point } from './config.js';
import type { Simulation } from './simulation.js';
import { unitSpec } from './catalog.js';
import type { World } from './world.js';
import { seededRandom } from './world-generation.js';
import { terrainVariantIndex } from './terrain-variants.js';

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
export type GroundSpriteVariant=CanvasImageSource|readonly CanvasImageSource[];
export interface GroundSprites {
  crater: GroundSpriteVariant;
  palm: GroundSpriteVariant;
  rocks: GroundSpriteVariant;
}
/** Selection is stable for each terrain seed; works with both old and variant atlases. */
export function groundSprite(source:GroundSpriteVariant,variant:number):CanvasImageSource {
  if(!Array.isArray(source))return source as CanvasImageSource;
  return source[terrainVariantIndex(variant)]??source[0];
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
    if(d.kind==='crater'){paintCrater(c,d,d.radius,d.rotation,1,groundSprite(sprites.crater,d.variant));continue;}
    if(d.kind==='palm'){
      const w=d.radius*3.55,h=d.radius*3.5;
      c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
      c.globalAlpha=.96;
      // Sprite trunk-foot (83% of image height) is anchored to the ground point.
      c.drawImage(groundSprite(sprites.palm,d.variant),-w*.5,-h*.58,w,h);
      c.restore();
      continue;
    }
    const w=d.radius*(d.kind==='rock'?3.7:2.3),h=d.radius*(d.kind==='rock'?2.4:1.55);
    c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.11);
    c.globalAlpha=d.kind==='rock'?.94:.75;
    c.drawImage(groundSprite(sprites.rocks,d.variant),-w*.5,-h*.6,w,h);
    c.restore();
  }
}

interface Mark extends Point {radius:number;rotation:number;created:number}
interface Smoke extends Point {created:number;duration:number;power:number;variant:number;kind:'impact'|'blast'|'wreck'}
interface Explosion extends Point {created:number;size:number;variant:number;kind:'blast'|'wreck'}
interface VehicleTrail extends Point {at:number;owner:number;kind:'wheel'|'tread';heading:number;width:number;length:number}
interface PreviousUnit extends Point { vehicle:boolean; hp:number; kind:string; owner:number }
interface PreviousBase extends Point { hp:number }

/** Bounded rendering-only marks and smoke, separated from authoritative simulation state. */
export class BattlefieldEffects {
  private marks:Mark[]=[];
  private clouds:Smoke[]=[];
  private bursts:Explosion[]=[];
  private tracks:VehicleTrail[]=[];
  private lastTrack=new Map<number,{x:number;y:number;at:number}>();
  private units=new Map<number,PreviousUnit>();
  private bases=new Map<number,PreviousBase>();
  private hits=0;
  private craterSprite:GroundSpriteVariant|null=null;
  setCraterSprite(image:GroundSpriteVariant):void{this.craterSprite=image;}
  get markCount():number{return this.marks.length;}
  get smokeCount():number{return this.clouds.length;}
  get trackCount():number{return this.tracks.length;}
  get burstCount():number{return this.bursts.length;}

  reset(game:Simulation):void {
    this.marks=[];this.clouds=[];this.tracks=[];this.bursts=[];this.lastTrack.clear();this.hits=0;
    this.units=new Map(game.units.filter(u=>u.hp>0).map(u=>[u.id,{x:u.x,y:u.y,hp:u.hp,vehicle:!unitSpec(u).flying&&unitSpec(u).group==='Fahrzeuge',kind:u.kind,owner:u.owner}]));
    for(const u of game.units)if(u.hp>0&&!unitSpec(u).flying&&unitSpec(u).group==='Fahrzeuge')this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});
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
    if(this.hits%9===0)this.addSmoke({x:p.x,y:p.y+12},time,2.5,.37,'impact');
  }

  /** Rocket explosions leave larger scars than light infantry rounds. */
  blast(p:Point,time:number):void {
    this.hits++;
    this.marks.push({...p,radius:23+(this.hits%4)*3,rotation:(this.hits*2.39996)%(Math.PI*2),created:time});
    if(this.marks.length>96)this.marks.shift();
    this.addSmoke(p,time,16,1.32,'blast');
    this.addBurst(p,time,1.3,'blast');
  }

  private addSmoke(p:Point,time:number,duration:number,power:number,kind:Smoke['kind']):void {
    this.clouds.push({...p,created:time,duration,power,kind,variant:(this.hits*.618033+this.clouds.length*.29)%1});
    if(this.clouds.length>32)this.clouds.shift();
  }
  private addBurst(p:Point,time:number,size:number,kind:Explosion['kind']):void {
    this.bursts.push({...p,created:time,size,kind,variant:(this.hits*.618033+this.bursts.length*.37)%1});
    if(this.bursts.length>18)this.bursts.shift();
  }

  update(game:Simulation,visible:(p:Point)=>boolean):void {
    const current=new Map<number,PreviousUnit>();
    for(const u of game.units)if(u.hp>0){
      const spec=unitSpec(u),vehicle=!spec.flying&&spec.group==='Fahrzeuge';
      current.set(u.id,{x:u.x,y:u.y,hp:u.hp,vehicle,kind:u.kind,owner:u.owner});
      if(!vehicle||u.carrier)continue;
      const last=this.lastTrack.get(u.id);
      if(!last){this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});continue;}
      const dx=u.x-last.x,dy=u.y-last.y,moved=Math.hypot(dx,dy);
      if(moved>170){this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});continue;}
      if(game.time-last.at<.15||moved<12||!visible(u))continue;
      const heading=Math.atan2(dy,dx),kind:u.kind==='rover'?'wheel':'tread';
      const len=Math.min(moved,24),width=Math.max(8,spec.width*.24);
      this.tracks.push({x:(u.x+last.x)/2,y:(u.y+last.y)/2,at:game.time,owner:u.owner,kind,heading,width,length:len});
      if(this.tracks.length>660)this.tracks.splice(0,this.tracks.length-660);
      this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});
    }
    for(const [id,old] of this.units)if(!current.has(id)){
      this.lastTrack.delete(id);
      if(old.vehicle&&visible(old)){
        this.addSmoke(old,game.time,43,1.7,'wreck');
        this.addBurst(old,game.time,1.85,'wreck');
      }
    }
    this.units=current;
    const bases=new Map<number,PreviousBase>();
    for(const b of game.bases)bases.set(b.id,{x:b.x,y:b.y,hp:b.hp});
    for(const [id,old] of this.bases)if(old.hp>0&&(bases.get(id)?.hp??0)<=0&&visible(old)){
      this.addSmoke(old,game.time,47,1.9,'wreck');
      this.addBurst(old,game.time,2.0,'wreck');
    }
    this.bases=bases;
    this.clouds=this.clouds.filter(v=>game.time-v.created<v.duration);
    this.bursts=this.bursts.filter(v=>game.time-v.created<1.55);
    // Long enough to leave a battlefield history, bounded to avoid runaway memory.
    if(this.tracks.length)this.tracks=this.tracks.filter(v=>game.time-v.at<180);
  }

  /** Tracks are laid under units and underneath fog, so unexplored activity cannot leak. */
  drawTracks(c:CanvasRenderingContext2D,game:Simulation):void {
    c.save();c.lineCap='butt';
    for(const t of this.tracks){
      if(!game.hasExplored(0,t))continue;
      const fade=Math.max(0,1-(game.time-t.at)/180);
      c.save();c.translate(t.x,t.y);c.rotate(t.heading);
      for(const side of [-1,1]){
        const y=side*t.width*.60;
        c.strokeStyle='rgba(69,48,29,'+(.24*fade).toFixed(3)+')';
        c.lineWidth=t.kind==='tread'?3.1:1.8;
        c.beginPath();c.moveTo(-t.length*.6,y);c.lineTo(t.length*.6,y);c.stroke();
        if(t.kind==='tread'){
          c.strokeStyle='rgba(91,66,38,'+(.15*fade).toFixed(3)+')';
          c.lineWidth=1.15;
          for(let x=-t.length*.5;x<t.length*.5;x+=4.5){
            c.beginPath();c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke();
          }
        }
      }
      c.restore();
    }
    c.restore();
  }

  /** A quick flash, expanding shock front and debris, then smoke. */
  drawExplosions(c:CanvasRenderingContext2D,game:Simulation,reducedMotion:boolean):void {
    c.save();
    for(const e of this.bursts){
      if(!game.canSee(0,e))continue;
      const age=game.time-e.created,t=Math.max(0,Math.min(1,age/1.45));
      if(t>=1)continue;
      const size=(20+e.size*35),ring=size*(.28+t*2.4),fresh=Math.max(0,1-t*2.7);
      c.save();c.translate(e.x,e.y);
      if(!reducedMotion){
        c.lineWidth=2.4*(1-t)+.4;c.strokeStyle='rgba(241,214,155,'+(.42*(1-t)**1.4).toFixed(3)+')';
        c.beginPath();c.ellipse(0,0,ring,ring*.55,0,0,Math.PI*2);c.stroke();
        c.strokeStyle='rgba(103,76,45,'+(.28*(1-t)).toFixed(3)+')';c.lineWidth=6*(1-t);
        c.beginPath();c.ellipse(0,0,ring*1.2,ring*.63,0,0,Math.PI*2);c.stroke();
      }
      if(fresh>0){
        const r=size*(.38+t*.85),flash=c.createRadialGradient(0,-r*.18,1,0,0,r);
        flash.addColorStop(0,'rgba(255,246,190,'+(.92*fresh).toFixed(3)+')');
        flash.addColorStop(.32,'rgba(255,182,68,'+(.88*fresh).toFixed(3)+')');
        flash.addColorStop(.74,'rgba(235,94,34,'+(.56*fresh).toFixed(3)+')');
        flash.addColorStop(1,'rgba(89,58,40,0)');
        c.fillStyle=flash;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();
      }
      if(!reducedMotion)for(let i=0;i<9;i++){
        const a=e.variant*6.283+i*2.399963,tDist=size*(.15+t*(.72+(i%3)*.26));
        c.strokeStyle='rgba(255,'+(i%2?'186,81':'226,142')+','+(.74*(1-t)**1.5).toFixed(3)+')';
        c.lineWidth=i%3===0?2.2:1.2;c.beginPath();
        c.moveTo(Math.cos(a)*tDist,Math.sin(a)*tDist*.59);
        c.lineTo(Math.cos(a)*(tDist+9),Math.sin(a)*(tDist+9)*.59-6*t);c.stroke();
      }
      c.restore();
    }
    c.restore();
  }

  drawMarks(c:CanvasRenderingContext2D,game:Simulation):void {
    if(!this.craterSprite)return;
    for(const m of this.marks)if(game.hasExplored(0,m))
      paintCrater(c,m,m.radius,m.rotation,1,groundSprite(this.craterSprite,m.rotation/(Math.PI*2)));
  }

  drawSmoke(c:CanvasRenderingContext2D,game:Simulation,reducedMotion:boolean):void {
    c.save();
    for(const s of this.clouds){
      if(!game.canSee(0,s))continue;
      const t=Math.max(0,Math.min(1,(game.time-s.created)/s.duration));
      const envelope=Math.min(1,t*12)*(1-t)**(s.kind==='wreck'?.80:1.15);
      if(envelope<=0)continue;
      const drift=reducedMotion?0:t*43*s.power;
      const radius=15+25*s.power;
      for(let i=0;i<5;i++){
        const angle=i*2.39996+s.variant*6.283;
        const dx=Math.cos(angle)*(i%2?9:17)*s.power+drift;
        const dy=Math.sin(angle)*(i%2?6:10)*s.power-t*61*s.power-i*8;
        const r=radius*(.55+i*.105)*(1+t*.8);
        const gradient=c.createRadialGradient(s.x+dx,s.y+dy,0,s.x+dx,s.y+dy,r);
        const alpha=Math.min(.63,(.30+i*.045)*envelope);
        const dark=s.kind==='wreck'?'29,27,24':s.kind==='blast'?'45,41,36':'75,69,58';
        gradient.addColorStop(0,'rgba('+dark+','+alpha.toFixed(3)+')');
        gradient.addColorStop(.48,'rgba(69,65,58,'+(alpha*.67).toFixed(3)+')');
        gradient.addColorStop(1,'rgba(101,92,78,0)');
        c.fillStyle=gradient;c.beginPath();c.arc(s.x+dx,s.y+dy,r,0,Math.PI*2);c.fill();
      }
      // Wrecks retain an intermittent low ember, not a perpetual full-sized fireball.
      if(s.kind==='wreck'&&!reducedMotion&&t<.58){
        const glow=c.createRadialGradient(s.x,s.y,0,s.x,s.y,18*s.power);
        glow.addColorStop(0,'rgba(251,139,49,'+(.32*(1-t)).toFixed(3)+')');
        glow.addColorStop(1,'rgba(216,79,19,0)');
        c.fillStyle=glow;c.beginPath();c.arc(s.x,s.y,18*s.power,0,Math.PI*2);c.fill();
      }
    }
    c.restore();
  }
}
