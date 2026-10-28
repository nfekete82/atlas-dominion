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
  const width=large?visualWidth*1.045:Math.max(spec.radius*2.02,visualWidth*.72);
  return {
    width,
    depth:large?Math.max(spec.radius*.9,width*(kind==='airfield'?.40:.39)):Math.max(spec.radius*1.05,width*.43),
    front:large?Math.min(16,Math.max(8,width*.045)):Math.min(9,Math.max(5,width*.055)),
    corner:Math.min(22,Math.max(5,width*.075)),
    lip:large?3:2,
    skew:Math.min(10,width*.035),
  };
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

/** The material is deliberately sand-toned, not a bright concrete plinth. */
export function paintDesertFoundation(c:CanvasRenderingContext2D,site:FoundationSite,opacity=1):void {
  if(opacity<=0)return;
  const f=foundationFootprint(site.kind),points=outline(site,f),back=site.y+f.front-f.depth,front=site.y+f.front;
  c.save();
  c.globalAlpha*=Math.min(1,opacity);

  // Dry sand contact shadow: not a floating slab.
  polygon(c,points,2,4);
  c.fillStyle='rgba(64,43,26,0.12)';
  c.fill();

  // A shallow chamfer along the southern and eastern edges (2–3 world units).
  c.beginPath();
  c.moveTo(points[5].x,points[5].y);
  c.lineTo(points[4].x,points[4].y);
  c.lineTo(points[4].x+1,points[4].y+f.lip);
  c.lineTo(points[5].x+1,points[5].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(76,53,35,0.24)';
  c.fill();
  c.beginPath();
  c.moveTo(points[4].x,points[4].y);
  c.lineTo(points[3].x,points[3].y);
  c.lineTo(points[3].x+1,points[3].y+f.lip);
  c.lineTo(points[4].x+1,points[4].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(92,66,44,0.15)';
  c.fill();

  polygon(c,points);
  const sand=c.createLinearGradient(0,back,0,front);
  sand.addColorStop(0,'rgba(195,162,117,0.26)');
  sand.addColorStop(.56,'rgba(177,151,112,0.35)');
  sand.addColorStop(1,'rgba(151,123,86,0.28)');
  c.fillStyle=sand;
  c.fill();
  c.strokeStyle='rgba(77,54,33,0.16)';
  c.lineWidth=1;
  c.stroke();

  // A barely visible worn upper rim, without bright/high-contrast outlining.
  c.beginPath();
  c.moveTo(points[7].x,points[7].y);
  c.lineTo(points[0].x,points[0].y);
  c.lineTo(points[1].x,points[1].y);
  c.strokeStyle='rgba(239,203,151,0.15)';
  c.lineWidth=1.2;
  c.stroke();

  // Settled sand grains along the front edge; deterministic per structure.
  const random=grain((site.id*2246822519+Math.round(site.x)*97+Math.round(site.y)*193)>>>0);
  c.fillStyle='rgba(213,162,99,0.15)';
  for(let i=0;i<(major.has(site.kind)?10:5);i++){
    const px=site.x+(random()-.5)*(f.width-f.corner*2),py=front+1+random()*5;
    c.beginPath();
    c.ellipse(px,py,1+random()*2,.45+random()*.65,0,0,Math.PI*2);
    c.fill();
  }
  c.restore();
}
