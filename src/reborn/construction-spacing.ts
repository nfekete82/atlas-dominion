import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import {distance,type Point} from './config.js';

/** Conservative radius of the *painted* façade projected onto the ground.
 * Do not let new buildings overlap visibly even though build circles are smaller.
 * Gameplay geometry for existing buildings and saves stays unchanged. */
export function buildingVisualRadius(kind:BuildingKind):number{
 const s=BUILDINGS[kind];
 return Math.max(s.radius,buildingArtWidth(kind,s.width)*.41);
}
export function constructionVisualClearance(a:BuildingKind,b:BuildingKind):number{
 const left=BUILDINGS[a],right=BUILDINGS[b];
 return Math.max(left.radius+right.radius+24,
   buildingVisualRadius(a)+buildingVisualRadius(b)+24);
}

/** Rotated visual footprints used by the authoritative build rules for
 * BOTH factions. Collision radii alone missed the huge airfield runway and
 * the roofed factory workshops, allowing an AI to build through a bastion.
 * These checks never modify unit navigation or old save coordinates.
 */
export type SiteFacing=0|1|2|3;
type Circle={type:'circle';x:number;z:number;r:number};
type Rect={type:'rect';x:number;z:number;hx:number;hz:number};
type Shape=Circle|Rect;
const round=30; // keep a useful walkable/safety strip between painted surfaces
const localShapes=(kind:BuildingKind):Shape[]=>{
 const s:Shape[]=kind==='wall'?[{type:'rect',x:0,z:0,hx:54,hz:16}]:
  [{type:'circle',x:0,z:0,r:buildingVisualRadius(kind)}];
 if(kind==='airfield')s.push(
  {type:'rect',x:106,z:29,hx:71,hz:181}, // short runway directly beside hangar
  {type:'rect',x:-81,z:-3,hx:119,hz:174}); // one hangar, tower and fuel
 if(kind==='factory')s.push(
  {type:'rect',x:192,z:56,hx:72,hz:116}); // one small side repair garage
 return s;
};
const yaw=(f:SiteFacing=0)=>[0,Math.PI,Math.PI/2,Math.PI*1.5][f];
const sitePoint=(p:Point,f:SiteFacing,x:number,z:number):Point=>{
 const a=yaw(f),cs=Math.cos(a),sn=Math.sin(a);
 return {x:p.x+x*cs+z*sn,y:p.y-x*sn+z*cs};
};
const ax=(f:SiteFacing)=>({x:Math.cos(yaw(f)),y:-Math.sin(yaw(f))});
const az=(f:SiteFacing)=>({x:Math.sin(yaw(f)),y:Math.cos(yaw(f))});
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
function overlaps(a:Shape,pa:Point,fa:SiteFacing,b:Shape,pb:Point,fb:SiteFacing,pad=round):boolean{
 const ca=sitePoint(pa,fa,a.x,a.z),cb=sitePoint(pb,fb,b.x,b.z);
 const d={x:cb.x-ca.x,y:cb.y-ca.y};
 if(a.type==='circle'&&b.type==='circle')
  return Math.hypot(d.x,d.y)<a.r+b.r+pad;
 const rectCircle=(rect:Rect,pr:Point,fr:SiteFacing,
  circle:Circle,pc:Point,fc:SiteFacing)=>{
  const box=sitePoint(pr,fr,rect.x,rect.z);
  const center=sitePoint(pc,fc,circle.x,circle.z);
  const delta={x:center.x-box.x,y:center.y-box.y};
  const dx=Math.max(0,Math.abs(dot(delta,ax(fr)))-rect.hx);
  const dz=Math.max(0,Math.abs(dot(delta,az(fr)))-rect.hz);
  return Math.hypot(dx,dz)<circle.r+pad;
 };
 if(a.type==='rect'&&b.type==='circle')return rectCircle(a,pa,fa,b,pb,fb);
 if(a.type==='circle'&&b.type==='rect')return rectCircle(b,pb,fb,a,pa,fa);
 if(a.type!=='rect'||b.type!=='rect')return false;
 // Separating-axis theorem for two world-oriented rectangles. Expanding both
 // by half the desired gap keeps decals/doors from visually kissing.
 const axes=[ax(fa),az(fa),ax(fb),az(fb)];
 for(const axis of axes){
  const project=(r:Rect,f:SiteFacing)=>Math.abs(dot(axis,ax(f)))*r.hx+
   Math.abs(dot(axis,az(f)))*r.hz;
  if(Math.abs(dot(d,axis))>=project(a,fa)+project(b,fb)+pad)return false;
 }
 return true;
}
/** Verify *every actual building part* rests on suitable ground. The
 * simulation historically sampled only the center/circular collision radius
 * (factory: 70), while the newer service bay extends to local x=264 and
 * could float over a cliff or disappear inside a dune. This uses the same
 * facing as the renderer and never edits heightfield, collision or nav data.
 *
 * The long airstrip is terrain-conforming; only its rigid hangars/tower and
 * parking equipment require a level foundation. Regular buildings still
 * validate their full visible foundation, not just the smaller hit circle.
 */
export function siteTerrainCompatible(
 kind:BuildingKind,p:Point,f:SiteFacing,
 terrain:{
  walkable(point:Point):boolean;
  terrainHeight(x:number,y:number):number;
  terrainSlope(x:number,y:number):number;
 }):boolean{
 const origin=terrain.terrainHeight(p.x,p.y);
 if(!Number.isFinite(origin))return false;
 let min=origin,max=origin;
 const check=(x:number,z:number)=>{
  const point=sitePoint(p,f,x,z);
  if(!terrain.walkable(point))return false;
  const height=terrain.terrainHeight(point.x,point.y);
  if(!Number.isFinite(height)||terrain.terrainSlope(point.x,point.y)>.14)return false;
  min=Math.min(min,height);max=Math.max(max,height);
  return Math.abs(height-origin)<=12&&max-min<=16;
 };
 // Sample the facade footprint at multiple interior locations, including
 // corners and center. Edge-only checks missed narrow ridges within the slab.
 const radius=buildingVisualRadius(kind)*.87;
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
  const x=ix*radius/2,z=iz*radius/2;
  if(x*x+z*z<=(radius*1.42)**2&&!check(x,z))return false;
 }
 const sampleRect=(cx:number,cz:number,hx:number,hz:number)=>{
  for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
   if(!check(cx+ix*hx/2,cz+iz*hz/2))return false;
  }
  return true;
 };
 if(kind==='wall'&&!sampleRect(0,0,53,14))return false;
 if(kind==='factory'&&!sampleRect(192,56,72,116))return false;
 if(kind==='airfield'&&(
  !sampleRect(-41,-62,58,79)||!sampleRect(-127,-73,29,35)))return false;
 return true;
}

/** Same spacing for human/AI, construction in progress and finished sites. */
export function sitesVisuallyOverlap(a:BuildingKind,pa:Point,fa:SiteFacing,
 b:BuildingKind,pb:Point,fb:SiteFacing=0):boolean{
 // Preserve the calibrated legacy separation for ordinary buildings.
 if(a!=='wall'&&b!=='wall'&&a!=='airfield'&&b!=='airfield'&&a!=='factory'&&b!=='factory')
  return distance(pa,pb)<constructionVisualClearance(a,b);
 const pad=a==='wall'&&b==='wall'?3:a==='wall'||b==='wall'?15:round;
 return localShapes(a).some(sa=>localShapes(b).some(sb=>overlaps(sa,pa,fa,sb,pb,fb,pad)));
}
/** Static bastions and capture points retain a larger clear perimeter. */
export function siteNearBastion(kind:BuildingKind,p:Point,f:SiteFacing,t:Point):boolean{
 const radius=83; // visible tower plus capture circulation
 const marker:Circle={type:'circle',x:0,z:0,r:radius};
 return localShapes(kind).some(s=>overlaps(s,p,f,marker,t,0));
}
/** For very long airstrips verify the real four corners, not just the anchor. */
export function siteExceedsMap(kind:BuildingKind,p:Point,f:SiteFacing,size:number):boolean{
 if(kind!=='airfield'&&kind!=='factory'&&kind!=='wall')return false;
 for(const rect of localShapes(kind))if(rect.type==='rect'){
  for(const x of [-rect.hx,rect.hx])for(const z of [-rect.hz,rect.hz]){
   const world=sitePoint(p,f,rect.x+x,rect.z+z);
   if(world.x<12||world.y<12||world.x>size-12||world.y>size-12)return true;
  }
 }
 return false;
}

/** Lower = preferable. A healthy ring around the base is better than a wall
 * of nearly touching prefabs, but long hikes and remote unguarded towers lose. */
export function aiBuildSiteScore(p:Point,kind:BuildingKind,home:Point,worker:Point,
 existing:readonly (Point&{kind:BuildingKind;hp:number})[]):number{
 const nearby=existing.filter(b=>b.hp>0);
 const open=nearby.length?Math.min(...nearby.map(b=>distance(p,b)-constructionVisualClearance(kind,b.kind))):400;
 return distance(p,home)*.42+distance(p,worker)*.18+
   Math.max(0,130-open)*3.2;
}
