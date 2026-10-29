import type {Unit,Shot} from './simulation.js';
import {unitSpec,unitKinds,type UnitKind} from './catalog.js';
import type {Point} from './config.js';
import {SpriteAnimator,turnTowards,angleDifference,directionIndex,type AnimationAtlas,type AnimationFrame} from './sprite-animator.js';
import {Particles} from './particles.js';
import {unitAtlasPath} from './asset-paths.js';
import {unitArtScale} from './visual-scale.js';
import {sharpenAtlasOpaqueRGB} from './sprite-clarity.js';
interface GroundShadowStyle {widthRatio:number;heightRatio:number;alpha:number;offsetX:number;offsetY:number}
/** Aircraft-specific ground projection; independent of sprite lift and gameplay positions. */
export const AIR_GROUND_SHADOWS:Readonly<Partial<Record<UnitKind,Readonly<GroundShadowStyle>>>>=Object.freeze({
 bomber:Object.freeze({widthRatio:.60,heightRatio:.24,alpha:.22,offsetX:10,offsetY:42}),
 scout:Object.freeze({widthRatio:.76,heightRatio:.30,alpha:.26,offsetX:14,offsetY:22}),
});
interface GroundShadow {image:HTMLCanvasElement;width:number;height:number;offsetX:number;offsetY:number}
/** Very subtle unsprung 6x6 chassis motion from travelled ground distance.
 * Deterministic: standing still and paused vehicles never bob or roll. */
export function rocketChassisMotion(distance:number,moving:boolean):{heave:number;roll:number}{
 if(!moving||!Number.isFinite(distance))return {heave:0,roll:0};
 return {heave:Math.sin(distance/18)*1.2,roll:Math.sin(distance/31)*.007};
}
/** Render-only suspension and firing response. Real motion drives the pose; the truck
 * never swims or sways during tactical pause. No simulation/save fields are added. */
export interface RocketPose {heave:number;roll:number;pitch:number;recoil:number}
export function rocketSuspensionPose(
 distance:number,moving:boolean,speedRatio:number,turn:number,acceleration:number,shotAge:number,idleAge:number,
):RocketPose {
 const speed=Math.max(0,Math.min(1,Number.isFinite(speedRatio)?speedRatio:0));
 const steering=Math.max(-1,Math.min(1,Number.isFinite(turn)?turn:0));
 const accelerationClamped=Math.max(-1,Math.min(1,Number.isFinite(acceleration)?acceleration:0));
 const driving=moving&&speed>.015;
 const wheel=driving&&Number.isFinite(distance)?distance:0;
 const rocking=driving?Math.sin(wheel/12.4)*.96+Math.sin(wheel/21.9+1.4)*.42:0;
 const idle=driving?0:Math.sin(idleAge*11)*.11;
 const recoil=shotAge>=0&&shotAge<.9?Math.sin(shotAge*13.5)*Math.exp(-shotAge*4.4)*4.8:0;
 return {
  heave:rocking*speed+idle+recoil*.32,
  roll:driving?Math.sin(wheel/27)*.006*speed+steering*.022*speed:0,
  pitch:driving?accelerationClamped*.012+Math.sin(wheel/18)*.004*speed:0,
  recoil,
 };
}
/** Phase interpolation takes place only between wheels from the existing 3D-baked
 * chassis frames. Bodywork is registered identically across wheel rotations. */
export function rocketWheelPhase(distance:number,stride:number,phases:number):{index:number;next:number;blend:number}{
 if(!Number.isFinite(distance)||!Number.isFinite(stride)||stride<=0||phases<=0)return {index:0,next:0,blend:0};
 const span=Math.max(0,distance)/stride*phases,index=Math.floor(span)%phases;
 return {index,next:(index+1)%phases,blend:span-Math.floor(span)};
}
interface Loaded {data:AnimationAtlas;image:HTMLImageElement|HTMLCanvasElement;shadow?:HTMLCanvasElement;groundShadow?:GroundShadow}
/** Additional screen-space height above the ground pivot baked into air atlases. */
export const unitVisualLift=(u:{kind?:UnitKind;flightHeight?:number}):number=>u.kind==='scout'?82-77*(1-(u.flightHeight??1)):unitSpec(u).flying?56:0;
export const unitSelectionPoint=(u:Point&{kind?:UnitKind}):Point=>({x:u.x,y:u.y-(unitSpec(u).flying?55:18)-unitVisualLift(u)});
interface View {unit:Unit;anim:SpriteAnimator;asset:Loaded;bodyAngle:number;turretAngle:number;lastX:number;lastY:number;lastFire:number;hp:number;dust:number;dead:boolean;deathAge:number;frame:AnimationFrame;turnTag:string|null;rocket?:{speed:number;turn:number;acceleration:number;shotAge:number;idleAge:number}}
export class UnitPresentation {
 readonly particles=new Particles();private assets=new Map<string,Loaded>();private views=new Map<number,View>();private corpses:View[]=[];private groundShadows=new Map<UnitKind,GroundShadow>();
 async load():Promise<void>{const cache=new Map<string,Promise<Loaded>>();await Promise.all(unitKinds.flatMap(kind=>[0,1].map(async owner=>{
  const prefix=unitAtlasPath(kind,owner);let pending=cache.get(prefix);if(!pending){pending=(async()=>{const response=await fetch(prefix+'.json');if(!response.ok)throw Error('Animation atlas unavailable: '+prefix);const data=await response.json() as AnimationAtlas,image=new Image();image.src=prefix+'.png';await image.decode();return {data,image};})();cache.set(prefix,pending);}
  const {data,image}=await pending;if(!data.clips.idle||!data.clips.walk||data.frames.length===0)throw Error('Incomplete animation atlas: '+kind);
  const asset:Loaded={data:{...data,kind,stride:kind==='artillery'?78:data.stride},image};
  if(unitSpec({kind}).flying){
   // The authored floor uses a warm, translucent shadow (opacity .25).
   // Split it once so raising the aircraft leaves its shadow on the ground.
   const style=AIR_GROUND_SHADOWS[kind],body=document.createElement('canvas');body.width=image.width;body.height=image.height;
   const shadow=style?undefined:document.createElement('canvas');if(shadow){shadow.width=image.width;shadow.height=image.height;}
   const bc=body.getContext('2d')!,sc=shadow?.getContext('2d');bc.drawImage(image,0,0);
   const pixels=bc.getImageData(0,0,body.width,body.height),shade=sc?.createImageData(body.width,body.height);
   const p=pixels.data;
   for(let i=0;i<p.length;i+=4){const alpha=p[i+3];
    // Allow half a premultiplied channel step for PNG edge rounding.
    if(alpha>0&&alpha<=64&&Math.abs(p[i]-24)*alpha<=128&&Math.abs(p[i+1]-16)*alpha<=128&&Math.abs(p[i+2]-8)*alpha<=128){shade?.data.set(p.subarray(i,i+4),i);p[i+3]=0;}
   }
   // The original 192px helicopter atlas is softly rescaled in-game.
   // Reinforce opaque baked seams once without dark halos or touching alpha.
   if(kind==='scout'){
    const sharpened=sharpenAtlasOpaqueRGB(p,body.width,body.height,data.cell[0]);
    pixels.data.set(sharpened);
   }
   bc.putImageData(pixels,0,0);asset.image=body;
   if(style)asset.groundShadow=this.groundShadow(kind,style);
   else if(sc&&shade){sc.putImageData(shade,0,0);asset.shadow=shadow;}
  }
  this.assets.set(kind+owner,asset);
 })));}
 /** Rasterize soft edges once per aircraft kind, shared by both factions and all frames. */
 private groundShadow(kind:UnitKind,style:Readonly<GroundShadowStyle>):GroundShadow {
  const cached=this.groundShadows.get(kind);if(cached)return cached;
  const image=document.createElement('canvas');image.width=128;image.height=64;
  const c=image.getContext('2d')!;c.translate(image.width/2,image.height/2);c.scale(image.width/2,image.height/2);
  const fade=c.createRadialGradient(0,0,0,0,0,1);
  fade.addColorStop(0,`rgba(24,16,8,${style.alpha})`);
  fade.addColorStop(.35,`rgba(24,16,8,${style.alpha*.85})`);
  fade.addColorStop(.72,`rgba(24,16,8,${style.alpha*.32})`);
  fade.addColorStop(1,'rgba(24,16,8,0)');c.fillStyle=fade;c.fillRect(-1,-1,2,2);
  const width=unitSpec({kind}).width*unitArtScale(kind);
  const shadow={image,width:width*style.widthRatio,height:width*style.heightRatio,offsetX:style.offsetX,offsetY:style.offsetY};
  this.groundShadows.set(kind,shadow);return shadow;
 }
 clear():void{this.views.clear();this.corpses=[];this.particles.clear();}
 asset(kind:UnitKind,owner=0):Loaded{return this.assets.get(kind+owner)!;}
 inspect(id:number):View|undefined{return this.views.get(id);}
 private view(u:Unit):View {
  let v=this.views.get(u.id);if(!v){const asset=this.asset(u.kind,u.owner),anim=new SpriteAnimator(asset.data);v={unit:u,anim,asset,bodyAngle:u.hullAngle??u.angle,turretAngle:u.angle,lastX:u.x,lastY:u.y,lastFire:0,hp:u.hp,dust:0,dead:false,deathAge:0,frame:asset.data.frames[0],turnTag:null,...(u.kind==='artillery'?{rocket:{speed:0,turn:0,acceleration:0,shotAge:1,idleAge:0}}:{})};this.views.set(u.id,v);}return v;
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
  // Damp acceleration and yaw input to avoid wobbling from the 20 Hz game tick.
  if(v.rocket&&dt>0){
   const r=v.rocket,targetSpeed=u.moving?Math.min(1,Math.max(0,(u.driveSpeed??moved/dt)/spec.speed)):0;
   const before=r.speed;
   r.speed+=Math.min(1,dt*6)*(targetSpeed-r.speed);
   r.acceleration+=(Math.min(1,dt*6))*(
     Math.max(-1,Math.min(1,(targetSpeed-before)/Math.max(.0001,dt)*.14))-r.acceleration);
   const yaw=Math.max(-1,Math.min(1,angleDifference(previousBody,v.bodyAngle)/Math.max(.0001,dt)/1.75));
   r.turn+=Math.min(1,dt*5)*(yaw-r.turn);
   r.idleAge+=dt;
   if(u.fire>0&&v.lastFire<=0)r.shotAge=0;
   else r.shotAge+=dt;
  }
  v.dust+=dt;
  if(dt>0&&vehicle&&!spec.flying&&moved>.2&&v.dust>.1&&(u.moving||Math.abs(angleDifference(v.bodyAngle,heading))>.1)){
   this.particles.emit('dust',{x:u.x-Math.cos(v.bodyAngle)*spec.width*.3,y:u.y+8});
   if(u.kind==='artillery')this.particles.emit('dust',{x:u.x-Math.cos(v.bodyAngle)*spec.width*.35+Math.sin(v.bodyAngle)*spec.width*.15,y:u.y+8});v.dust=0;
  }
  v.frame=v.anim.update(dt,{moving:u.moving,distance:u.walkDistance,angle:vehicle?v.bodyAngle:u.angle,attack:!!v.asset.data.clips.attack&&u.fire>0,hit:!!v.asset.data.clips.hit&&u.hit>0,dead:false});
  if(v.turnTag&&v.asset.data.clips[v.turnTag])v.frame=v.anim.frame(v.turnTag,v.bodyAngle);

  v.unit=u;v.lastX=u.x;v.lastY=u.y;v.lastFire=u.fire;v.hp=u.hp;
 }
 private drawFrame(c:CanvasRenderingContext2D,v:View,frame:AnimationFrame,p:Point,offset:Point={x:0,y:0},image:CanvasImageSource=v.asset.image):void{
  const scale=v.asset.data.nativeScale*unitArtScale(v.unit.kind);c.drawImage(image,frame.x,frame.y,frame.w,frame.h,p.x-frame.pivot[0]*scale+offset.x,p.y-frame.pivot[1]*scale+offset.y,frame.w*scale,frame.h*scale);
 }
 draw(c:CanvasRenderingContext2D,u:Unit,p:Point):void{
  const v=this.view(u);this.advance(v,u,0);this.drawView(c,v,p);
 }
 private drawView(c:CanvasRenderingContext2D,v:View,p:Point):void{
  // drawFrame only changes pixels. Restore the two properties we change rather
  // than pushing/popping the complete Canvas state for every layered sprite.
  const smoothing=c.imageSmoothingEnabled,quality=c.imageSmoothingQuality,filter=c.filter;
  c.imageSmoothingEnabled=v.asset.data.cell[0]>=144;
  if(v.unit.kind==='scout'||v.unit.kind==='artillery')c.imageSmoothingQuality='high';
  const at={x:p.x,y:p.y-unitVisualLift(v.unit)};
  const ground=v.asset.groundShadow;
  if(ground)c.drawImage(ground.image,p.x+ground.offsetX-ground.width/2,p.y+ground.offsetY-ground.height/2,ground.width,ground.height);
  else if(v.asset.shadow)this.drawFrame(c,v,v.frame,p,{x:0,y:0},v.asset.shadow);
  if(v.dead&&!v.asset.data.clips.death)c.filter='grayscale(1) brightness(.5)';
  const rocket=v.rocket;
  const ride=rocket?rocketSuspensionPose(v.unit.walkDistance,v.unit.moving,rocket.speed,rocket.turn,
    rocket.acceleration,rocket.shotAge,rocket.idleAge):null;
  if(ride){c.save();c.translate(p.x,p.y);c.rotate(ride.roll);c.transform(1,ride.pitch,0,1,0,0);c.translate(-p.x,-p.y);}
  const shifted={x:at.x,y:at.y+(ride?.heave??0)};
  this.drawFrame(c,v,v.frame,shifted);
  // The source GLB has only four baked wheel phases. A faint registered blend
  // smooths intermediate tyre rotations without introducing SVG/circle "wheels".
  if(rocket&&v.anim.state==='walk'&&v.unit.moving){
   const row=v.asset.data.clips.walk.frames[v.anim.direction];
   if(row.length>1){
    const phase=rocketWheelPhase(v.unit.walkDistance,v.asset.data.stride,row.length);
    const next=v.asset.data.frames[row[phase.next]];
    const opacity=c.globalAlpha;
    c.globalAlpha=opacity*Math.min(.32,phase.blend*.32);
    this.drawFrame(c,v,next,shifted);
    c.globalAlpha=opacity;
   }
  }
  if(v.asset.data.clips.turret){
   const turret=v.anim.frame('turret',v.turretAngle);this.drawFrame(c,v,turret,shifted);
   if(v.asset.data.clips.barrel){
    const recoil=rocket?Math.max(0,ride?.recoil??0)+Math.max(0,v.unit.fire)*8:
      v.unit.fire>0?Math.sin(v.unit.fire/.18*Math.PI)*2.5:0;
    // Hydraulic pod absorbs a rocket salvo, followed by a fading oscillation.
    if(rocket){c.save();const pivot={x:shifted.x,y:shifted.y-24*unitArtScale(v.unit.kind)};
     c.translate(pivot.x,pivot.y);c.rotate(-(ride?.recoil??0)*.0025);c.translate(-pivot.x,-pivot.y);}
    this.drawFrame(c,v,v.anim.frame('barrel',v.turretAngle),shifted,
      {x:-Math.cos(v.turretAngle)*recoil,y:-Math.sin(v.turretAngle)*recoil*.6-recoil*.38});
    if(rocket)c.restore();
   }
  }
  if(ride)c.restore();
  c.filter=filter;c.imageSmoothingEnabled=smoothing;c.imageSmoothingQuality=quality;
 }
 drawCorpses(c:CanvasRenderingContext2D,visible:(p:Point)=>boolean,inViewport:(p:Point)=>boolean=()=>true):void{for(const v of this.corpses)if(inViewport(v.unit)&&(v.unit.owner===0||visible(v.unit))){c.save();c.globalAlpha=Math.min(1,(5-v.deathAge)/.7);this.drawView(c,v,v.unit);c.restore();}}
 muzzle(v:View,u:Unit):Point{
  const scale=v.asset.data.nativeScale*unitArtScale(u.kind),frame=v.asset.data.clips.barrel?v.anim.frame('barrel',v.turretAngle):v.frame,muzzle=frame.muzzle,spec=unitSpec(u);
  return muzzle?{x:u.x+(muzzle[0]-frame.pivot[0])*scale,y:u.y+(muzzle[1]-frame.pivot[1])*scale-unitVisualLift(u)}:{x:u.x+Math.cos(v.turretAngle)*spec.width*.42,y:u.y-16-(spec.flying?32:0)-unitVisualLift(u)+Math.sin(v.turretAngle)*spec.width*.18};
 }
 muzzleForShot(shot:Shot):Point{
  if(!shot.kind||!shot.groundFrom)return shot.from;
  if(shot.kind==='tank'&&shot.weapon==='machinegun'){
   const p=shot.groundFrom,angle=shot.angle??0;
   return {x:p.x+Math.cos(angle)*16,y:p.y-34+Math.sin(angle)*7};
  }
  const asset=this.asset(shot.kind,shot.owner),view=shot.source===undefined?undefined:this.views.get(shot.source),angle=shot.kind==='scout'&&view?view.bodyAngle:shot.angle??0;
  const tag=asset.data.clips.barrel?'barrel':view?.anim.state??'attack';
  const clip=asset.data.clips[tag]??asset.data.clips.idle;
  const frame=view?view.anim.frame(tag,angle):asset.data.frames[clip.frames[directionIndex(angle,asset.data.directions)][0]];
  const scale=asset.data.nativeScale*unitArtScale(shot.kind),m=frame.muzzles?.[(shot.barrel??0)%frame.muzzles.length]??frame.muzzle,p=shot.groundFrom;
  return m?{x:p.x+(m[0]-frame.pivot[0])*scale,y:p.y+(m[1]-frame.pivot[1])*scale-unitVisualLift({kind:shot.kind,flightHeight:shot.flightHeight})}:shot.from;
 }
 muzzleFor(u:Unit):Point{const v=this.view(u);this.advance(v,u,0);return this.muzzle(v,u);}
}
