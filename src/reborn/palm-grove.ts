import {unitSpec} from './catalog.js';
import type {GroundDetail,GroundSpriteVariant} from './battlefield-atmosphere.js';
import {groundSprite} from './battlefield-atmosphere.js';
import type {Simulation} from './simulation.js';
import type {Point} from './config.js';

/** Palm crowns in the original terrain atlas were oversized beside infantry and trucks. */
export const PALM_ART_SCALE=.76;
const FALL_SECONDS=.60;
const NATURALLY_FALLEN_THRESHOLD=.17;
interface PalmTree {detail:GroundDetail;fallenAt:number|null;heading:number}
export interface PalmViewport {left:number;right:number;top:number;bottom:number}
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));

/**
 * Terrain decoration, not a blocking or destructible gameplay entity.
 * Trees can be driven through. Their knocked-down state stays for the
 * current match, but never changes pathfinding, combat or game saves.
 */
export class PalmGrove {
 private trees:PalmTree[]=[];
 private lastVehicle=new Map<number,Point>();
 get count():number{return this.trees.length;}
 get fallenCount():number{return this.trees.filter(t=>t.fallenAt!==null).length;}
 get initiallyFallenCount():number{return this.trees.filter(t=>t.fallenAt===-Infinity).length;}

 reset(details:readonly GroundDetail[],game:Simulation):void{
  this.trees=details.filter(d=>d.kind==='palm').map(d=>({
   detail:d,
   fallenAt:d.variant<NATURALLY_FALLEN_THRESHOLD?-Infinity:null,
   heading:d.rotation
  }));
  this.lastVehicle.clear();
  for(const u of game.units){
   const s=unitSpec(u);
   if(u.hp>0&&!u.carrier&&!s.flying&&s.group==='Fahrzeuge')
    this.lastVehicle.set(u.id,{x:u.x,y:u.y});
  }
 }

 update(game:Simulation):void{
  const active=new Set<number>();
  for(const u of game.units){
   const s=unitSpec(u);
   if(u.hp<=0||u.carrier||s.flying||s.group!=='Fahrzeuge')continue;
   active.add(u.id);
   const previous=this.lastVehicle.get(u.id),current={x:u.x,y:u.y};
   this.lastVehicle.set(u.id,current);
   if(!previous)continue;
   const dx=u.x-previous.x,dy=u.y-previous.y,travel2=dx*dx+dy*dy;
   // Never count spawn movement, transport teleports or zero-length jitter.
   if(travel2<.25||travel2>175*175)continue;
   const reach=Math.max(9,s.radius*.82+6),reach2=reach*reach;
   const dir=Math.atan2(dy,dx);
   for(const tree of this.trees){
    if(tree.fallenAt!==null)continue;
    const p=tree.detail;
    if(Math.abs(p.x-(u.x+previous.x)*.5)>Math.abs(dx)*.5+reach||
       Math.abs(p.y-(u.y+previous.y)*.5)>Math.abs(dy)*.5+reach)continue;
    const fraction=clamp01(((p.x-previous.x)*dx+(p.y-previous.y)*dy)/travel2);
    const ox=previous.x+dx*fraction-p.x,oy=previous.y+dy*fraction-p.y;
    if(ox*ox+oy*oy>reach2)continue;
    tree.fallenAt=game.time;
    tree.heading=dir;
   }
  }
  for(const id of this.lastVehicle.keys())if(!active.has(id))this.lastVehicle.delete(id);
 }

 draw(c:CanvasRenderingContext2D,sprites:GroundSpriteVariant,time:number,view?:PalmViewport):void{
  for(const tree of this.trees){
   const d=tree.detail;
   const extent=d.radius*3.5;
   if(view&&(d.x+extent<view.left||d.x-extent>view.right||
     d.y+extent<view.top||d.y-extent>view.bottom))continue;
   const sprite=groundSprite(sprites,d.variant);
   const fall=tree.fallenAt===null?0:clamp01((time-tree.fallenAt)/FALL_SECONDS);
   if(fall<1)this.drawStanding(c,d,sprite,1-fall);
   if(fall>0)this.drawFallen(c,d,sprite,tree.heading,fall);
  }
 }

 private drawStanding(c:CanvasRenderingContext2D,d:GroundDetail,sprite:CanvasImageSource,alpha:number):void{
  const w=d.radius*3.55*PALM_ART_SCALE,h=d.radius*3.5*PALM_ART_SCALE;
  c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.rotation)*.07);
  c.globalAlpha=.96*alpha;
  c.drawImage(sprite,-w*.5,-h*.58,w,h);
  c.restore();
 }

 private drawFallen(c:CanvasRenderingContext2D,d:GroundDetail,sprite:CanvasImageSource,heading:number,alpha:number):void{
  const r=d.radius,len=r*1.55;
  c.save();c.translate(d.x,d.y);c.rotate(heading);
  c.globalAlpha=.30*alpha;c.fillStyle='#4a3624';
  c.beginPath();c.ellipse(len*.55,r*.13,len*.95,r*.35,0,0,Math.PI*2);c.fill();
  c.globalAlpha=alpha;
  c.lineCap='round';
  c.strokeStyle='#55432e';c.lineWidth=r*.20;
  c.beginPath();c.moveTo(0,0);c.lineTo(len,0);c.stroke();
  c.strokeStyle='#ac8b5a';c.lineWidth=r*.065;
  c.beginPath();c.moveTo(1,-r*.065);c.lineTo(len*.91,-r*.065);c.stroke();
  // Crop the foliage from the upper half of the existing PNG; this excludes
  // its upright trunk/shadow, so the same crown can rest on the sand.
  const source=sprite as HTMLCanvasElement,sw=source.width||640,sh=source.height||640;
  const crownWidth=r*2.0,crownHeight=r*1.25;
  c.drawImage(sprite,0,0,sw,sh*.55,len-crownWidth*.46,-crownHeight*.55,crownWidth,crownHeight);
  c.restore();
 }
}
