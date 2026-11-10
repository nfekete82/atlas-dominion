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
 const s:Shape[]=[{type:'circle',x:0,z:0,r:buildingVisualRadius(kind)}];
 if(kind==='airfield')s.push(
  {type:'rect',x:132,z:175,hx:79,hz:503}, // 980-unit runway + lights
  {type:'rect',x:-131,z:0,hx:247,hz:223}); // hangars, tower and left fuel area
 if(kind==='factory')s.push(
  {type:'rect',x:0,z:169,hx:178,hz:120}, // BOTH interior vehicle repair halls
  {type:'rect',x:0,z:-30,hx:155,hz:78}); // camouflaged side workshops
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
/** Same spacing for human/AI, construction in progress and finished sites. */
export function sitesVisuallyOverlap(a:BuildingKind,pa:Point,fa:SiteFacing,
 b:BuildingKind,pb:Point,fb:SiteFacing=0):boolean{
 // Preserve the calibrated legacy separation for ordinary buildings.
 if(a!=='airfield'&&b!=='airfield'&&a!=='factory'&&b!=='factory')
  return distance(pa,pb)<constructionVisualClearance(a,b);
 return localShapes(a).some(sa=>localShapes(b).some(sb=>overlaps(sa,pa,fa,sb,pb,fb)));
}
/** Static bastions and capture points retain a larger clear perimeter. */
export function siteNearBastion(kind:BuildingKind,p:Point,f:SiteFacing,t:Point):boolean{
 const radius=83; // visible tower plus capture circulation
 const marker:Circle={type:'circle',x:0,z:0,r:radius};
 return localShapes(kind).some(s=>overlaps(s,p,f,marker,t,0));
}
/** For very long airstrips verify the real four corners, not just the anchor. */
export function siteExceedsMap(kind:BuildingKind,p:Point,f:SiteFacing,size:number):boolean{
 if(kind!=='airfield'&&kind!=='factory')return false;
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
