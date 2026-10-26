import type {Unit,Shot} from './simulation.js';
import {unitSpec,unitKinds,type UnitKind} from './catalog.js';
import type {Point} from './config.js';
import {SpriteAnimator,turnTowards,angleDifference,directionIndex,type AnimationAtlas,type AnimationFrame} from './sprite-animator.js';
import {Particles} from './particles.js';
import {unitAtlasPath} from './asset-paths.js';
interface Loaded {data:AnimationAtlas;image:HTMLImageElement|HTMLCanvasElement;shadow?:HTMLCanvasElement}
/** Additional screen-space height above the ground pivot baked into air atlases. */
export const unitVisualLift=(u:{kind?:UnitKind;flightHeight?:number}):number=>u.kind==='scout'?56-77*(1-(u.flightHeight??1)):unitSpec(u).flying?56:0;
export const unitSelectionPoint=(u:Point&{kind?:UnitKind}):Point=>({x:u.x,y:u.y-(unitSpec(u).flying?55:18)-unitVisualLift(u)});
interface View {unit:Unit;anim:SpriteAnimator;asset:Loaded;bodyAngle:number;turretAngle:number;lastX:number;lastY:number;lastFire:number;hp:number;dust:number;dead:boolean;deathAge:number;frame:AnimationFrame;turnTag:string|null}
export class UnitPresentation {
 readonly particles=new Particles();private assets=new Map<string,Loaded>();private views=new Map<number,View>();private corpses:View[]=[];
 async load():Promise<void>{const cache=new Map<string,Promise<Loaded>>();await Promise.all(unitKinds.flatMap(kind=>[0,1].map(async owner=>{
  const prefix=unitAtlasPath(kind,owner);let pending=cache.get(prefix);if(!pending){pending=(async()=>{const response=await fetch(prefix+'.json');if(!response.ok)throw Error('Animation atlas unavailable: '+prefix);const data=await response.json() as AnimationAtlas,image=new Image();image.src=prefix+'.png';await image.decode();return {data,image};})();cache.set(prefix,pending);}
  const {data,image}=await pending;if(!data.clips.idle||!data.clips.walk||data.frames.length===0)throw Error('Incomplete animation atlas: '+kind);
  const asset:Loaded={data:{...data,kind},image};
  if(unitSpec({kind}).flying){
   // The authored floor uses a warm, translucent shadow (opacity .25).
   // Split it once so raising the aircraft leaves its shadow on the ground.
   const body=document.createElement('canvas'),shadow=document.createElement('canvas');body.width=shadow.width=image.width;body.height=shadow.height=image.height;
   const bc=body.getContext('2d')!,sc=shadow.getContext('2d')!;bc.drawImage(image,0,0);
   const pixels=bc.getImageData(0,0,body.width,body.height),shade=sc.createImageData(body.width,body.height);
   const p=pixels.data;
   for(let i=0;i<p.length;i+=4){const alpha=p[i+3];
    // Allow half a premultiplied channel step for PNG edge rounding.
    if(alpha>0&&alpha<=64&&Math.abs(p[i]-24)*alpha<=128&&Math.abs(p[i+1]-16)*alpha<=128&&Math.abs(p[i+2]-8)*alpha<=128){shade.data.set(p.subarray(i,i+4),i);p[i+3]=0;}
   }
   bc.putImageData(pixels,0,0);sc.putImageData(shade,0,0);asset.image=body;asset.shadow=shadow;
  }
  this.assets.set(kind+owner,asset);
 })));}
 clear():void{this.views.clear();this.corpses=[];this.particles.clear();}
 asset(kind:UnitKind,owner=0):Loaded{return this.assets.get(kind+owner)!;}
 inspect(id:number):View|undefined{return this.views.get(id);}
 private view(u:Unit):View {
  let v=this.views.get(u.id);if(!v){const asset=this.asset(u.kind,u.owner),anim=new SpriteAnimator(asset.data);v={unit:u,anim,asset,bodyAngle:u.hullAngle??u.angle,turretAngle:u.angle,lastX:u.x,lastY:u.y,lastFire:0,hp:u.hp,dust:0,dead:false,deathAge:0,frame:asset.data.frames[0],turnTag:null};this.views.set(u.id,v);}return v;
 }
 update(units:Unit[],dt:number,visible:(p:Point)=>boolean):void {
  const alive=new Set(units.filter(u=>u.hp>0&&!u.carrier).map(u=>u.id));
  for(const [id,v] of this.views)if(!alive.has(id)){
   if((v.unit.owner===0||visible(v.unit))&&v.unit.hp<=0){v.dead=true;v.deathAge=0;if(!unitSpec(v.unit).flying)this.corpses.push(v);if(unitSpec(v.unit).group!=='Infanterie')this.particles.emit('explosion',{x:v.unit.x,y:v.unit.y-unitVisualLift(v.unit)});}
   this.views.delete(id);
  }
  for(const u of units)if(u.hp>0&&!u.carrier&&(u.owner===0||visible(u)))this.advance(this.view(u),u,dt);
  for(const v of this.corpses){v.deathAge+=dt;if(v.asset.data.clips.death)v.frame=v.anim.update(dt,{moving:false,distance:v.unit.walkDistance,angle:v.bodyAngle,attack:false,hit:false,dead:true});}
  this.corpses=this.corpses.filter(v=>v.deathAge<5).slice(-40);
 }
 private advance(v:View,u:Unit,dt:number):void{
  const spec=unitSpec(u),vehicle=spec.group!=='Infanterie',dx=u.x-v.lastX,dy=u.y-v.lastY,moved=Math.hypot(dx,dy),heading=moved>.05?Math.atan2(dy,dx):u.hullAngle??v.bodyAngle;
  const previousBody=v.bodyAngle,desiredHull=!u.moving&&!v.asset.data.clips.turret?u.angle:u.hullAngle??heading;
  v.bodyAngle=vehicle?turnTowards(v.bodyAngle,desiredHull,spec.flying?2:3.3,dt):u.angle;
  if(dt>0){const turn=angleDifference(previousBody,v.bodyAngle);v.turnTag=!u.moving&&Math.abs(turn)>.001?(turn<0?'turnLeft':'turnRight'):null;}
  v.turretAngle=u.fire>0?u.angle:turnTowards(v.turretAngle,u.angle,3.8,dt);
  v.dust+=dt;
  if(dt>0&&vehicle&&!spec.flying&&moved>.2&&v.dust>.1&&(u.moving||Math.abs(angleDifference(v.bodyAngle,heading))>.1)){
   this.particles.emit('dust',{x:u.x-Math.cos(v.bodyAngle)*spec.width*.3,y:u.y+8});v.dust=0;
  }
  v.frame=v.anim.update(dt,{moving:u.moving,distance:u.walkDistance,angle:vehicle?v.bodyAngle:u.angle,attack:!!v.asset.data.clips.attack&&u.fire>0,hit:!!v.asset.data.clips.hit&&u.hit>0,dead:false});
  if(v.turnTag&&v.asset.data.clips[v.turnTag])v.frame=v.anim.frame(v.turnTag,v.bodyAngle);

  v.unit=u;v.lastX=u.x;v.lastY=u.y;v.lastFire=u.fire;v.hp=u.hp;
 }
 private drawFrame(c:CanvasRenderingContext2D,v:View,frame:AnimationFrame,p:Point,offset:Point={x:0,y:0},image:CanvasImageSource=v.asset.image):void{
  const scale=v.asset.data.nativeScale*(v.unit.kind==='heavy'?1.08:1);c.drawImage(image,frame.x,frame.y,frame.w,frame.h,p.x-frame.pivot[0]*scale+offset.x,p.y-frame.pivot[1]*scale+offset.y,frame.w*scale,frame.h*scale);
 }
 draw(c:CanvasRenderingContext2D,u:Unit,p:Point):void{
  const v=this.view(u);this.advance(v,u,0);this.drawView(c,v,p);
 }
 private drawView(c:CanvasRenderingContext2D,v:View,p:Point):void{
  // drawFrame only changes pixels. Restore the two properties we change rather
  // than pushing/popping the complete Canvas state for every layered sprite.
  const smoothing=c.imageSmoothingEnabled,filter=c.filter;
  c.imageSmoothingEnabled=v.asset.data.cell[0]>=144;const at={x:p.x,y:p.y-unitVisualLift(v.unit)};
  if(v.asset.shadow)this.drawFrame(c,v,v.frame,p,{x:0,y:0},v.asset.shadow);
  if(v.dead&&!v.asset.data.clips.death)c.filter='grayscale(1) brightness(.5)';
  this.drawFrame(c,v,v.frame,at);
  if(v.asset.data.clips.turret){
   const turret=v.anim.frame('turret',v.turretAngle);this.drawFrame(c,v,turret,at);
   if(v.asset.data.clips.barrel){const recoil=v.unit.fire>0?Math.sin(v.unit.fire/.18*Math.PI)*2.5:0;this.drawFrame(c,v,v.anim.frame('barrel',v.turretAngle),at,{x:-Math.cos(v.turretAngle)*recoil,y:-Math.sin(v.turretAngle)*recoil*.65});}
  }
  c.filter=filter;c.imageSmoothingEnabled=smoothing;
 }
 drawCorpses(c:CanvasRenderingContext2D,visible:(p:Point)=>boolean):void{for(const v of this.corpses)if(v.unit.owner===0||visible(v.unit)){c.save();c.globalAlpha=Math.min(1,(5-v.deathAge)/.7);this.drawView(c,v,v.unit);c.restore();}}
 muzzle(v:View,u:Unit):Point{
  const scale=v.asset.data.nativeScale*(u.kind==='heavy'?1.08:1),frame=v.asset.data.clips.barrel?v.anim.frame('barrel',v.turretAngle):v.frame,muzzle=frame.muzzle,spec=unitSpec(u);
  return muzzle?{x:u.x+(muzzle[0]-frame.pivot[0])*scale,y:u.y+(muzzle[1]-frame.pivot[1])*scale-unitVisualLift(u)}:{x:u.x+Math.cos(v.turretAngle)*spec.width*.42,y:u.y-16-(spec.flying?32:0)-unitVisualLift(u)+Math.sin(v.turretAngle)*spec.width*.18};
 }
 muzzleForShot(shot:Shot):Point{
  if(!shot.kind||!shot.groundFrom)return shot.from;
  const asset=this.asset(shot.kind,shot.owner),view=shot.source===undefined?undefined:this.views.get(shot.source),angle=shot.kind==='scout'&&view?view.bodyAngle:shot.angle??0;
  const tag=asset.data.clips.barrel?'barrel':view?.anim.state??'attack';
  const clip=asset.data.clips[tag]??asset.data.clips.idle;
  const frame=view?view.anim.frame(tag,angle):asset.data.frames[clip.frames[directionIndex(angle,asset.data.directions)][0]];
  const scale=asset.data.nativeScale*(shot.kind==='heavy'?1.08:1),m=frame.muzzle,p=shot.groundFrom;
  return m?{x:p.x+(m[0]-frame.pivot[0])*scale,y:p.y+(m[1]-frame.pivot[1])*scale-unitVisualLift({kind:shot.kind,flightHeight:shot.flightHeight})}:shot.from;
 }
 muzzleFor(u:Unit):Point{const v=this.view(u);this.advance(v,u,0);return this.muzzle(v,u);}
}
