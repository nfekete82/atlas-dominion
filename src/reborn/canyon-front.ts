import type {Point} from './config.js';

/** Experimental Canyon Front: deterministic authored geometry over the existing
 * 2.5D Canvas terrain renderer. It uses genuine extruded (x,y,z) faces without
 * introducing a second scene graph or changing old map/save versions. */
export interface CanyonRamp {x:number; width:number}
export interface CanyonRidge {spine:Point[]; width:number; height:number; ramps:CanyonRamp[]}
export interface CanyonRuin {x:number;y:number;width:number;depth:number;height:number;rotation:number;variant:number}
export interface CanyonFeatures {ridges:CanyonRidge[];ruins:CanyonRuin[]}

const mix=(seed:number)=>{
 let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentDistance=(p:Point,a:Point,b:Point):number=>{
 const dx=b.x-a.x,dy=b.y-a.y,scale=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-dx*scale,p.y-a.y-dy*scale);
};
const nearRidge=(p:Point,r:CanyonRidge)=>r.spine.slice(1).some((b,i)=>segmentDistance(p,r.spine[i],b)<r.width*.5);
export const isCanyonRamp=(p:Point,r:CanyonRidge):boolean=>r.ramps.some(g=>Math.abs(p.x-g.x)<g.width*.5);
export const canyonCliffBlocked=(p:Point,r:CanyonRidge):boolean=>!isCanyonRamp(p,r)&&nearRidge(p,r);
export function canyonRuinBlocked(p:Point,r:CanyonRuin,pad=0):boolean{
 const dx=p.x-r.x,dy=p.y-r.y,c=Math.cos(r.rotation),s=Math.sin(r.rotation);
 return Math.abs(dx*c+dy*s)<r.width*.5+pad&&Math.abs(-dx*s+dy*c)<r.depth*.5+pad;
}

/** One long ridge, two wide tank ramps, and deliberately clustered ruins.
 * The ridge sits between bastion rows; access remains open around both ends.
 * Candidate props are rejected close to bases, roads and all known ramps. */
export function generateCanyonFeatures(seed:number,size:number,columns:number,rows:number,
 sites:readonly Point[],corridors:readonly (readonly [Point,Point])[]):CanyonFeatures{
 const random=mix(seed^0x6f2b4a71),seam=(Math.floor(rows/2)/rows)*size;
 const ridge:CanyonRidge={
  width:68,height:116,
  spine:Array.from({length:25},(_,i)=>{
   const t=i/24;
   return {x:size*(.13+t*.74),y:seam+Math.sin(t*Math.PI*3.5+seed%17)*48+Math.sin(t*Math.PI*7)*17};
  }),
  ramps:[(Math.floor(columns*.25)+.5)/columns,(Math.ceil(columns*.75)-.5)/columns]
   .map(x=>({x:x*size,width:Math.max(205,size*.045)}))
 };
 const ruins:CanyonRuin[]=[];
 const nearRoad=(p:Point)=>corridors.some(([a,b])=>segmentDistance(p,a,b)<112);
 const safe=(r:CanyonRuin)=>{
  const p={x:r.x,y:r.y},radius=Math.hypot(r.width,r.depth)*.65;
  return p.x>200+radius&&p.x<size-200-radius&&p.y>200+radius&&p.y<size-200-radius
   &&sites.every(s=>dist(s,p)>280+radius)
   &&!nearRoad(p)
   &&!ridge.spine.slice(1).some((b,i)=>segmentDistance(p,ridge.spine[i],b)<r.width+radius+120)
   &&ruins.every(o=>dist(o,p)>Math.max(o.width,o.depth)+radius+55);
 };
 // Fixed visual zones, deterministic small offsets. Gameplay paths are never
 // inferred from this decoration; the block grid is built from exact footprints.
 const anchors=[[.2,.2],[.8,.22],[.21,.75],[.77,.77],[.48,.2],[.5,.79],[.1,.48],[.9,.53]];
 for(const [ax,ay] of anchors){
  for(let n=0;n<3;n++){
   let added=false;
   for(let trial=0;trial<32&&!added;trial++){
    const variant=Math.floor(random()*3);
    const r:CanyonRuin={x:(ax+(random()-.5)*.09)*size,y:(ay+(random()-.5)*.09)*size,
      width:variant===1?120:80+random()*35,depth:variant===1?88:66+random()*29,
      height:variant===1?63:39+random()*26,rotation:(random()-.5)*.24,variant};
    if(safe(r)){ruins.push(r);added=true;}
   }
  }
 }
 return {ridges:[ridge],ruins};
}

function shape(c:CanvasRenderingContext2D,pts:readonly Point[],color:string):void{
 if(!pts.length)return;
 c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
 c.closePath();c.fillStyle=color;c.fill();
}
function ridgeAtX(r:CanyonRidge,x:number):Point{
 for(let i=1;i<r.spine.length;i++)if(x<=r.spine[i].x){
  const a=r.spine[i-1],b=r.spine[i],t=Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)));
  return {x,y:a.y+(b.y-a.y)*t};
 }
 return {...r.spine.at(-1)!};
}
/** Faces are extruded in world x/y/z and orthographically projected onto the
 * ground layer. Meshes are static, so baking once is cheaper than per-frame draw. */
export function paintCanyonRidges(c:CanvasRenderingContext2D,ridges:readonly CanyonRidge[]):void{
 for(const ridge of ridges){
  for(const ramp of ridge.ramps){
   const p=ridgeAtX(ridge,ramp.x),half=ramp.width*.5;
   const rampSurface=c.createLinearGradient(p.x,p.y-95,p.x,p.y+95);
   rampSurface.addColorStop(0,'#bb955d');rampSurface.addColorStop(.45,'#e3c18b');rampSurface.addColorStop(1,'#b58a52');
   shape(c,[{x:p.x-half,y:p.y-95},{x:p.x+half,y:p.y-95},{x:p.x+half*.85,y:p.y+95},{x:p.x-half*.85,y:p.y+95}],'#97734b');
   c.fillStyle=rampSurface;c.fillRect(p.x-half*.83,p.y-92,half*1.66,182);
   c.strokeStyle='#f8ddb06b';c.lineWidth=2;c.beginPath();c.moveTo(p.x-half*.7,p.y-86);c.lineTo(p.x-half*.7,p.y+90);c.moveTo(p.x+half*.7,p.y-86);c.lineTo(p.x+half*.7,p.y+90);c.stroke();
  }
  // Split segments finely around gaps. Physical block cells and visual wall
  // gaps use the same ramp predicate; a ramp never hides an invisible barrier.
  for(let k=1;k<ridge.spine.length;k++){
   const a=ridge.spine[k-1],b=ridge.spine[k],n=7;
   for(let i=0;i<n;i++){
    const t=i/n,u=(i+1)/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},q={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
    if(isCanyonRamp({x:(p.x+q.x)*.5,y:(p.y+q.y)*.5},ridge))continue;
    const dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1,ny=dx/l,nx=-dy/l;
    const w=ridge.width*.5;
    const back={x:p.x-nx*w,y:p.y-ny*w},back2={x:q.x-nx*w,y:q.y-ny*w};
    const front={x:p.x+nx*w,y:p.y+ny*w},front2={x:q.x+nx*w,y:q.y+ny*w};
    const high={x:back.x,y:back.y-ridge.height},high2={x:back2.x,y:back2.y-ridge.height};
    const lip={x:front.x,y:front.y-ridge.height*.77},lip2={x:front2.x,y:front2.y-ridge.height*.77};
    shape(c,[back,back2,front2,front],'#65513a35');
    const side=c.createLinearGradient(0,high.y,0,front.y);
    side.addColorStop(0,'#f5dab0');side.addColorStop(.43,'#d2a46c');side.addColorStop(1,'#836044');
    c.beginPath();c.moveTo(lip.x,lip.y);c.lineTo(lip2.x,lip2.y);c.lineTo(front2.x,front2.y);c.lineTo(front.x,front.y);c.closePath();c.fillStyle=side;c.fill();
    shape(c,[high,high2,lip2,lip],'#e4c493');
    c.strokeStyle='#7f5b3b80';c.lineWidth=1.2;c.beginPath();c.moveTo(lip.x,lip.y+ridge.height*.27);c.lineTo(lip2.x,lip2.y+ridge.height*.27);c.stroke();
    c.strokeStyle='#fbe0b080';c.beginPath();c.moveTo(high.x,high.y);c.lineTo(high2.x,high2.y);c.stroke();
   }
  }
 }
}
type Vertex={x:number;y:number;z:number};
const project=(v:Vertex):Point=>({x:v.x,y:v.y-v.z});
function wall(c:CanvasRenderingContext2D,vs:Vertex[],color:string):void{shape(c,vs.map(project),color);}
export function paintCanyonRuins(c:CanvasRenderingContext2D,ruins:readonly CanyonRuin[]):void{
 for(const r of [...ruins].sort((a,b)=>a.y-b.y)){
  c.save();c.translate(r.x,r.y);c.rotate(r.rotation);
  const w=r.width*.5,d=r.depth*.5,h=r.height;
  c.fillStyle='#5d422c42';c.beginPath();c.ellipse(7,12,w*1.35,d*.95,0,0,Math.PI*2);c.fill();
  shape(c,[{x:-w-7,y:-d-5},{x:w+7,y:-d-5},{x:w+8,y:d+8},{x:-w-8,y:d+8}],'#c8a579');
  // Exposed inner courtyard floor; faceted roof remnants read as broken
  // masonry rather than a solid undamaged building.
  shape(c,[{x:-w+8,y:-d+9},{x:w-8,y:-d+9},{x:w-8,y:d-8},{x:-w+8,y:d-8}],'#9d7a53');
  wall(c,[{x:-w,y:-d,z:0},{x:w,y:-d,z:0},{x:w,y:-d,z:h},{x:-w,y:-d,z:h}],'#c8ad87');
  wall(c,[{x:-w,y:-d,z:0},{x:-w,y:d,z:0},{x:-w,y:d,z:h*.48},{x:-w*.68,y:d*.35,z:h*.88},{x:-w,y:-d,z:h}],'#e0c29a');
  wall(c,[{x:w,y:-d,z:0},{x:w,y:d,z:0},{x:w,y:d,z:h*.38},{x:w*.78,y:d*.1,z:h*.74},{x:w,y:-d,z:h}],'#bfa07c');
  wall(c,[{x:-w,y:d,z:0},{x:w,y:d,z:0},{x:w*.83,y:d,z:h*.33},{x:w*.18,y:d,z:h*.17},{x:-w*.38,y:d,z:h*.65},{x:-w,y:d,z:h*.49}],'#d4b28a');
  // Broken rooftop slab with a distinct top/edge, plus fractured wall rim.
  if(r.variant!==2){
   wall(c,[{x:-w,y:-d,z:h},{x:w*.15,y:-d,z:h},{x:w*.28,y:0,z:h*.9},{x:-w*.25,y:d*.12,z:h*.88},{x:-w,y:d*.15,z:h}],'#cdb58f');
   wall(c,[{x:-w,y:d*.15,z:h},{x:-w*.25,y:d*.12,z:h*.88},{x:-w*.25,y:d*.12,z:h*.78},{x:-w,y:d*.15,z:h*.86}],'#83694c');
  }
  // Dark doorways and windows are on the visible front face. Scraps stay
  // outside the collision footprint.
  if(r.variant===1){
   shape(c,[{x:-15,y:d-h*.42},{x:6,y:d-h*.42},{x:6,y:d},{x:-15,y:d}],'#4f4236');
   shape(c,[{x:w*.42,y:d-h*.52},{x:w*.68,y:d-h*.52},{x:w*.68,y:d-h*.27},{x:w*.42,y:d-h*.27}],'#544637');
  }
  const random=mix(Math.round(r.x*43+r.y*97));
  for(let i=0;i<15;i++){
   const side=i%4,dx=(random()-.5)*r.width*1.7,dy=(random()-.5)*r.depth*1.9;
   if(Math.abs(dx)<w*.75&&Math.abs(dy)<d*.75)continue;
   const z=2+random()*9;
   wall(c,[{x:dx,y:dy,z:0},{x:dx+z,y:dy,z:0},{x:dx+z*.5,y:dy-z*.55,z:z*.6}],[ '#c5a37c','#9c7854','#e1c19a','#ad8963'][side]);
  }
  c.restore();
 }
}
