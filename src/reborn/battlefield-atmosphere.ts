import { type Point } from './config.js';
import type { Simulation } from './simulation.js';
import { unitSpec } from './catalog.js';
import type { World } from './world.js';
import { seededRandom } from './world-generation.js';
import { terrainVariantIndex } from './terrain-variants.js';

export type GroundDetailKind = 'stones' | 'rock' | 'palm' | 'crater' | 'skull';
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
      const kind: GroundDetailKind = chance < .40 ? 'stones' : chance < .76 ? 'rock' : chance < .94 ? 'crater' : chance < .97 ? 'palm' : 'skull';
      const radius = kind === 'palm' ? 23 + random() * 16 : kind === 'skull' ? 6 + random() * 3 : kind === 'crater' ? 11 + random() * 23 : kind === 'rock' ? 9 + random() * 18 : 7 + random() * 12;
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
  palm?: GroundSpriteVariant;
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
    // Mesh-rendered palms and bones stay separate so occupied slots can disappear.
    if(d.kind==='palm'||d.kind==='skull')continue;
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
interface Footprint extends Point {at:number;heading:number;side:-1|1;life:number}
interface FootstepCursor extends Point {at:number;distance:number;side:-1|1}
interface EffectsViewport {left:number;right:number;top:number;bottom:number}
// The ambient sand streaks already travel eastward; deposits use the same wind.
const WIND_ANGLE=.12;
const WIND_X=Math.cos(WIND_ANGLE),WIND_Y=Math.sin(WIND_ANGLE);
const WIND_PERP_X=-WIND_Y,WIND_PERP_Y=WIND_X;
const inEffectsViewport=(p:Point,view?:EffectsViewport):boolean=>!view||
  (p.x>=view.left&&p.x<=view.right&&p.y>=view.top&&p.y<=view.bottom);
const sandGust=(x:number,y:number,time:number):number=>{
  // Slow, spatially varying gusts without random state or per-frame allocations.
  const swell=.5+.5*Math.sin(time*.43+x*.004+y*.003);
  const burst=Math.max(0,Math.sin(time*1.19+x*.009-y*.005));
  return .24+.50*swell+.26*burst*burst;
};
interface PreviousUnit extends Point { vehicle:boolean; hp:number; kind:string; owner:number }
interface PreviousBase extends Point { hp:number }

/** Bounded rendering-only marks and smoke, separated from authoritative simulation state. */
export class BattlefieldEffects {
  private marks:Mark[]=[];
  private clouds:Smoke[]=[];
  private bursts:Explosion[]=[];
  private tracks:VehicleTrail[]=[];
  private footprints:Footprint[]=[];
  private lastTrack=new Map<number,{x:number;y:number;at:number}>();
  private lastFootstep=new Map<number,FootstepCursor>();
  private nextFootprintSweep=0;
  private units=new Map<number,PreviousUnit>();
  private bases=new Map<number,PreviousBase>();
  private hits=0;
  private craterSprite:GroundSpriteVariant|null=null;
  setCraterSprite(image:GroundSpriteVariant):void{this.craterSprite=image;}
  get markCount():number{return this.marks.length;}
  get smokeCount():number{return this.clouds.length;}
  get trackCount():number{return this.tracks.length;}
  get footprintCount():number{return this.footprints.length;}
  get burstCount():number{return this.bursts.length;}

  reset(game:Simulation):void {
    this.marks=[];this.clouds=[];this.tracks=[];this.footprints=[];this.bursts=[];this.lastTrack.clear();this.lastFootstep.clear();this.nextFootprintSweep=game.time;this.hits=0;
    this.units=new Map(game.units.filter(u=>u.hp>0).map(u=>[u.id,{x:u.x,y:u.y,hp:u.hp,vehicle:!unitSpec(u).flying&&unitSpec(u).group==='Fahrzeuge',kind:u.kind,owner:u.owner}]));
    for(const u of game.units)if(u.hp>0&&!u.carrier){
      const spec=unitSpec(u);
      if(spec.flying)continue;
      if(spec.group==='Fahrzeuge')this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});
      else if(spec.group==='Infanterie')this.lastFootstep.set(u.id,{x:u.x,y:u.y,at:game.time,distance:0,side:1});
    }
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
      if(u.carrier){this.lastFootstep.delete(u.id);this.lastTrack.delete(u.id);continue;}
      if(!vehicle&&!spec.flying&&spec.group==='Infanterie'){
        let previous=this.lastFootstep.get(u.id);
        if(!previous){
          previous={x:u.x,y:u.y,at:game.time,distance:0,side:1};
          this.lastFootstep.set(u.id,previous);
        }else{
          const dx=u.x-previous.x,dy=u.y-previous.y,moved=Math.hypot(dx,dy);
          // Sample real ground displacement, not render frames or walking animation.
          // Ignore teleports, transported soldiers, idle jitter and unseen enemies.
          if(game.time>previous.at&&u.moving&&moved>.1&&moved<=70&&visible(previous)&&visible(u)){
            const spacing=u.kind==='heavy'?19:17;
            const heading=Math.atan2(dy,dx),sx=-Math.sin(heading),sy=Math.cos(heading);
            let side=previous.side;
            for(let distance=spacing-previous.distance;distance<=moved;distance+=spacing){
              const fraction=distance/moved;
              const x=previous.x+dx*fraction+sx*side*3.25;
              const y=previous.y+dy*fraction+sy*side*3.25;
              const position={x,y},cell=game.world.index(position);
              // Do not imprint rocks, unexplored positions or invisible ground.
              if(cell>=0&&!game.world.blocked[cell]&&visible(position)){
                const noise=Math.sin(x*.031+y*.019+u.id*1.31);
                const gust=Math.sin(game.time*.13+x*.004+y*.003);
                this.footprints.push({x,y,at:game.time,heading,side,
                  life:55+noise*10-gust*7+(u.kind==='heavy'?7:0)});
              }
              side=side===1?-1:1;
            }
            previous.distance=(previous.distance+moved)%spacing;
            previous.side=side;
          }else if(moved>70||!u.moving||!visible(u)){
            previous.distance=0;
          }
          previous.x=u.x;previous.y=u.y;previous.at=game.time;
        }
      }
      if(!vehicle)continue;
      const last=this.lastTrack.get(u.id);
      if(!last){this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});continue;}
      const dx=u.x-last.x,dy=u.y-last.y,moved=Math.hypot(dx,dy);
      if(moved>170){this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});continue;}
      if(game.time-last.at<.15||moved<12||!visible(u))continue;
      const heading=Math.atan2(dy,dx),kind=u.kind==='rover'||u.kind==='artillery'?'wheel':'tread';
      const len=Math.min(moved,24),width=Math.max(8,spec.width*.24);
      this.tracks.push({x:(u.x+last.x)/2,y:(u.y+last.y)/2,at:game.time,owner:u.owner,kind,heading,width,length:len});
      if(this.tracks.length>660)this.tracks.splice(0,this.tracks.length-660);
      this.lastTrack.set(u.id,{x:u.x,y:u.y,at:game.time});
    }
    // Batch pruning once per update instead of shifting the array for each soldier.
    if(this.footprints.length>1200)this.footprints.splice(0,this.footprints.length-1200);
    for(const [id,old] of this.units)if(!current.has(id)){
      this.lastTrack.delete(id);
      this.lastFootstep.delete(id);
      if(old.vehicle&&visible(old)){
        // Scorched wreck footprint persists after the brief smoke, limited like impact marks.
        this.hits++;
        this.marks.push({...old,radius:30,rotation:(old.x*.017+old.y*.023)%(Math.PI*2),created:game.time});
        if(this.marks.length>96)this.marks.shift();
        this.addSmoke(old,game.time,43,1.7,'wreck');
        this.addBurst(old,game.time,1.85,'wreck');
      }
    }
    this.units=current;
    const bases=new Map<number,PreviousBase>();
    for(const b of game.bases)bases.set(b.id,{x:b.x,y:b.y,hp:b.hp});
    for(const [id,old] of this.bases)if(old.hp>0&&(bases.get(id)?.hp??0)<=0&&visible(old)){
      this.hits++;
      this.marks.push({...old,radius:36,rotation:(old.x*.017+old.y*.023)%(Math.PI*2),created:game.time});
      if(this.marks.length>96)this.marks.shift();
      this.addSmoke(old,game.time,47,1.9,'wreck');
      this.addBurst(old,game.time,2.0,'wreck');
    }
    this.bases=bases;
    this.clouds=this.clouds.filter(v=>game.time-v.created<v.duration);
    this.bursts=this.bursts.filter(v=>game.time-v.created<1.55);
    // Long enough to leave a battlefield history, bounded to avoid runaway memory.
    if(this.tracks.length)this.tracks=this.tracks.filter(v=>game.time-v.at<180);
    // Rendering runs at up to 60+ FPS; expiring old impressions once per simulated
    // second avoids allocating and filtering 1200 objects on every animation frame.
    if(game.time>=this.nextFootprintSweep){
      if(this.footprints.length)this.footprints=this.footprints.filter(v=>game.time-v.at<v.life);
      this.nextFootprintSweep=game.time+1;
    }
  }

  /** Tracks are laid under units and underneath fog, so unexplored activity cannot leak. */
  drawTracks(c:CanvasRenderingContext2D,game:Simulation,viewport?:EffectsViewport):void {
    c.save();c.lineCap='butt';
    const inView=(p:Point)=>inEffectsViewport(p,viewport);
    for(const t of this.tracks){
      if(!inView(t)||!game.hasExplored(0,t))continue;
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
    // Alternating left/right boot prints: heel, toe and the sunlit raised rim.
    // Wind-scoured sand gradually fills each depression, with no simulation changes.
    for(const p of this.footprints){
      if(!inView(p)||!game.hasExplored(0,p))continue;
      const age=game.time-p.at;
      if(age<0||age>=p.life)continue;
      const fade=Math.pow(1-age/p.life,1.65);
      if(fade<.014)continue;
      c.save();c.translate(p.x,p.y);c.rotate(p.heading);
      c.globalAlpha=.28*fade;c.fillStyle='#4b3422';
      c.beginPath();c.ellipse(-2,0,2.3,1.55,0,0,Math.PI*2);
      c.ellipse(2,0,3,2.05,0,0,Math.PI*2);c.fill();
      c.globalAlpha=.18*fade;c.strokeStyle='#f2d5a4';c.lineWidth=.95;
      c.beginPath();c.ellipse(0,.45,5.25,2.65,0,.16,Math.PI-.16);c.stroke();
      // A faint sand wash follows the prevailing wind as the print erodes.
      c.globalAlpha=.08*fade*(age/p.life);c.fillStyle='#e7c68e';
      c.fillRect(-4,-.6,7.8,1.4);
      c.restore();
    }
    c.restore();
  }


  /**
   * Windblown sand settles over old boot prints and tyre/tread marks.
   * Visual-only: deterministic from game time and existing marks, camera-culled,
   * with no particles, timers, world changes or save-data allocations.
   * Reduced-motion mode keeps the gradual deposit but freezes moving streaks.
   */
  drawWindVeil(c:CanvasRenderingContext2D,game:Simulation,viewport?:EffectsViewport,reducedMotion=false):void {
    if(!this.tracks.length&&!this.footprints.length)return;
    const time=game.time;
    c.save();
    for(const t of this.tracks){
      if(!inEffectsViewport(t,viewport)||!game.hasExplored(0,t))continue;
      const age=time-t.at;
      if(age<0||age>=180)continue;
      const progress=age/180,gust=sandGust(t.x,t.y,time);
      const fill=Math.min(1,progress*3.5);
      if(fill<.012)continue;
      const drift=reducedMotion?0:Math.sin(time*.66+t.x*.026+t.y*.014)*11*gust;
      const sideways=reducedMotion?0:Math.sin(time*.31+t.y*.021)*2;
      c.save();
      c.translate(t.x+WIND_X*drift+WIND_PERP_X*sideways,t.y+WIND_Y*drift+WIND_PERP_Y*sideways);
      c.rotate(WIND_ANGLE);
      // Settled pale grains mute the dark grooves as the vehicle trail ages.
      c.fillStyle='#e8cd99';c.globalAlpha=(.075+.16*gust)*fill;
      c.beginPath();c.ellipse(0,0,Math.max(9,t.length*.79),Math.max(3.8,t.width*.69),0,0,Math.PI*2);c.fill();
      // A gust lifts a thin streak, but never animates in reduced-motion mode.
      if(!reducedMotion){
        const phase=((time*9+t.x*.17+t.y*.11)%38)/38;
        const wave=Math.sin(phase*Math.PI)**2;
        if(wave>.025){
          c.translate(WIND_X*(phase-.5)*18,WIND_Y*(phase-.5)*18);
          c.globalAlpha=.17*gust*wave*fill;c.fillStyle='#f3ddae';
          c.beginPath();c.ellipse(0,-t.width*.23,Math.max(7,t.length*.54),Math.max(1.6,t.width*.21),0,0,Math.PI*2);c.fill();
        }
      }
      c.restore();
    }
    for(const p of this.footprints){
      if(!inEffectsViewport(p,viewport)||!game.hasExplored(0,p))continue;
      const age=time-p.at;
      if(age<0||age>=p.life)continue;
      const progress=age/p.life,gust=sandGust(p.x,p.y,time);
      const cover=Math.pow(progress,.8);
      if(cover<.015)continue;
      const drift=reducedMotion?0:Math.sin(time*.85+p.x*.032+p.y*.018)*3.8*gust;
      c.save();
      c.translate(p.x+WIND_X*drift,p.y+WIND_Y*drift);
      c.rotate(WIND_ANGLE);
      // Fine sand progressively sweeps into the heel/toe depression.
      c.globalAlpha=(.13+.17*gust)*cover;c.fillStyle='#e9ce9c';
      c.beginPath();c.ellipse(0,0,6.8+gust*1.7,2.45,0,0,Math.PI*2);c.fill();
      if(!reducedMotion){
        const phase=((time*13+p.x*.21-p.y*.13)%24)/24;
        const wave=Math.sin(phase*Math.PI)**2;
        if(wave>.025){
          c.globalAlpha=.13*gust*wave*cover;c.fillStyle='#f3ddb2';
          c.beginPath();c.ellipse((phase-.5)*7,-.8,4.3,1.05,0,0,Math.PI*2);c.fill();
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
