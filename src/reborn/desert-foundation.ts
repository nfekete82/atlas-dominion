import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';

/** Low-profile compacted desert pads, painted beneath units, fog and buildings. */
export interface FoundationSite {id:number;kind:BuildingKind;x:number;y:number}
export interface FoundationFootprint {
  width:number;depth:number;front:number;corner:number;lip:number;skew:number;
}

const major=new Set<BuildingKind>(['headquarters','barracks','factory','airfield']);

/** Visual geometry only: does not change collision radii or valid build sites. */
export function foundationFootprint(kind:BuildingKind):FoundationFootprint {
  const spec=BUILDINGS[kind],large=major.has(kind),visualWidth=buildingArtWidth(kind,spec.width);
  const width=large?visualWidth*1.015:Math.max(spec.radius*1.70,visualWidth*.82);
  return {
    width,
    depth:large?Math.max(spec.radius*.82,width*(kind==='airfield'?.27:.31)):Math.max(spec.radius*.83,width*.38),
    front:large?4:3,
    corner:Math.min(12,Math.max(4,width*.035)),
    lip:large?2:1.5,
    skew:Math.min(4,Math.max(1,width*.008)),
  };
}

/** Align the front rim with the actual lower edge of the baked 3D body.
 * The sprite pivot is NOT at the bottom of the building image.
 * This is what kept the old slab hanging behind and beside the headquarters.
 */
export function foundationGroundOffset(kind:BuildingKind,body:{
  pivot:readonly [number,number];solidBounds:{w:number;y:number;h:number}
}):number {
  const pixelFoot=body.solidBounds.y+body.solidBounds.h-body.pivot[1];
  return pixelFoot*buildingArtWidth(kind,BUILDINGS[kind].width)/body.solidBounds.w;
}

interface Pt {x:number;y:number}
function outline(site:FoundationSite,f:FoundationFootprint):Pt[] {
  const x=site.x,y=site.y,half=f.width/2,back=y+f.front-f.depth,front=y+f.front,skew=f.skew,corner=f.corner;
  return [
    {x:x-half+corner-skew,y:back},
    {x:x+half-corner-skew,y:back},
    {x:x+half-skew,y:back+corner*.45},
    {x:x+half+skew*.4,y:front-corner*.35},
    {x:x+half-corner+skew*.4,y:front},
    {x:x-half+corner+skew*.4,y:front},
    {x:x-half+skew*.4,y:front-corner*.35},
    {x:x-half-skew,y:back+corner*.45},
  ];
}
function polygon(c:CanvasRenderingContext2D,points:readonly Pt[],dx=0,dy=0):void {
  c.beginPath();
  points.forEach((p,i)=>i?c.lineTo(p.x+dx,p.y+dy):c.moveTo(p.x+dx,p.y+dy));
  c.closePath();
}

/** Stable grain placement: the terrain never flickers when the camera moves. */
function grain(seed:number):()=>number {
  let state=seed>>>0;
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

/** The material is deliberately warm sand-toned, almost absorbed by the ground. */
export function paintDesertFoundation(c:CanvasRenderingContext2D,site:FoundationSite,opacity=1):void {
  if(opacity<=0)return;
  const f=foundationFootprint(site.kind),points=outline(site,f),back=site.y+f.front-f.depth,front=site.y+f.front;
  c.save();
  c.globalAlpha*=Math.min(1,opacity);

  // Dry sand contact shadow: not a floating slab.
  polygon(c,points,1,2);
  c.fillStyle='rgba(92,55,26,0.08)';
  c.fill();

  // A shallow chamfer along the southern and eastern edges (2–3 world units).
  c.beginPath();
  c.moveTo(points[5].x,points[5].y);
  c.lineTo(points[4].x,points[4].y);
  c.lineTo(points[4].x+1,points[4].y+f.lip);
  c.lineTo(points[5].x+1,points[5].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(100,64,32,0.19)';
  c.fill();
  c.beginPath();
  c.moveTo(points[4].x,points[4].y);
  c.lineTo(points[3].x,points[3].y);
  c.lineTo(points[3].x+1,points[3].y+f.lip);
  c.lineTo(points[4].x+1,points[4].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(110,72,36,0.11)';
  c.fill();

  polygon(c,points);
  const sand=c.createLinearGradient(0,back,0,front);
  sand.addColorStop(0,'rgba(222,174,109,0.08)');
  sand.addColorStop(.56,'rgba(203,152,91,0.11)');
  sand.addColorStop(1,'rgba(168,119,61,0.12)');
  c.fillStyle=sand;
  c.fill();
  c.strokeStyle='rgba(115,75,36,0.035)';
  c.lineWidth=1;
  c.stroke();

  // A barely visible worn upper rim, without bright/high-contrast outlining.
  c.beginPath();
  c.moveTo(points[7].x,points[7].y);
  c.lineTo(points[0].x,points[0].y);
  c.lineTo(points[1].x,points[1].y);
  c.strokeStyle='rgba(240,184,106,0.055)';
  c.lineWidth=1.2;
  c.stroke();

  // Settled sand grains along the front edge; deterministic per structure.
  const random=grain((site.id*2246822519+Math.round(site.x)*97+Math.round(site.y)*193)>>>0);
  c.fillStyle='rgba(227,173,97,0.13)';
  for(let i=0;i<(major.has(site.kind)?10:5);i++){
    const px=site.x+(random()-.5)*(f.width-f.corner*2),py=front+1+random()*5;
    c.beginPath();
    c.ellipse(px,py,1+random()*2,.45+random()*.65,0,0,Math.PI*2);
    c.fill();
  }
  c.restore();
}
