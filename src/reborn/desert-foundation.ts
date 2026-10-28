import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';

/**
 * Grounded desert architecture: an opaque, shallow sandstone slab with windblown
 * sand along its edges. Rendering only; pathfinding and saved games are untouched.
 */
export interface FoundationSite {id:number;kind:BuildingKind;x:number;y:number}
export interface FoundationFootprint {
  width:number;depth:number;front:number;corner:number;lip:number;skew:number;
}
const major=new Set<BuildingKind>(['headquarters','barracks','factory','airfield']);
const FULL_CIRCLE=Math.PI*2;

export function foundationFootprint(kind:BuildingKind):FoundationFootprint {
  const spec=BUILDINGS[kind],large=major.has(kind),visualWidth=buildingArtWidth(kind,spec.width);
  const width=large?visualWidth*1.085:Math.max(spec.radius*1.88,visualWidth*.88);
  return {
    width,
    depth:large?Math.max(spec.radius*.95,width*(kind==='airfield'?.34:.35)):Math.max(spec.radius*.88,width*.41),
    front:large?7:4,
    corner:Math.min(17,Math.max(5,width*.047)),
    lip:large?3:2,
    skew:Math.min(6,Math.max(1,width*.013)),
  };
}

/** Actual bottom of the authored building, NOT its higher sprite pivot. */
export function foundationGroundOffset(kind:BuildingKind,body:{
  pivot:readonly [number,number];solidBounds:{w:number;y:number;h:number}
}):number {
  const bottom=body.solidBounds.y+body.solidBounds.h-body.pivot[1];
  return bottom*buildingArtWidth(kind,BUILDINGS[kind].width)/body.solidBounds.w;
}

interface Pt {x:number;y:number}
function outline(site:FoundationSite,f:FoundationFootprint):Pt[] {
  const x=site.x,y=site.y,half=f.width/2,back=y+f.front-f.depth,front=y+f.front,s=f.skew,k=f.corner;
  return [
    {x:x-half+k-s,y:back},
    {x:x+half-k-s,y:back},
    {x:x+half-s,y:back+k*.48},
    {x:x+half+s*.35,y:front-k*.40},
    {x:x+half-k+s*.35,y:front},
    {x:x-half+k+s*.35,y:front},
    {x:x-half+s*.35,y:front-k*.40},
    {x:x-half-s,y:back+k*.48},
  ];
}
function polygon(c:CanvasRenderingContext2D,p:readonly Pt[],dx=0,dy=0):void {
  c.beginPath();
  for(let i=0;i<p.length;i++){
    const x=p[i].x+dx,y=p[i].y+dy;
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.closePath();
}
function grain(seed:number):()=>number {
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}

/** Soft elliptical wind deposits with genuinely feathered edges (no hard ellipses). */
function windDeposit(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,angle:number,strength=1):void {
  c.save();
  c.translate(x,y);
  c.rotate(angle);
  c.scale(rx,ry);
  const dust=c.createRadialGradient(0,0,.02,0,0,1);
  dust.addColorStop(0,`rgba(244,191,111,${(.89*strength).toFixed(3)})`);
  dust.addColorStop(.40,`rgba(239,178,93,${(.76*strength).toFixed(3)})`);
  dust.addColorStop(.73,`rgba(226,162,77,${(.38*strength).toFixed(3)})`);
  dust.addColorStop(1,'rgba(225,155,65,0)');
  c.fillStyle=dust;
  c.beginPath();
  c.arc(0,0,1,0,FULL_CIRCLE);
  c.fill();
  c.restore();
}

/** Solid, walkable-looking pad with a weathered stone edge and sand collecting on top. */
export function paintDesertFoundation(c:CanvasRenderingContext2D,site:FoundationSite,opacity=1):void {
  if(opacity<=0)return;
  const f=foundationFootprint(site.kind);
  const p=outline(site,f),half=f.width/2,back=site.y+f.front-f.depth,front=site.y+f.front;
  const rnd=grain((Math.imul(site.id,2246822519)+Math.round(site.x)*97+Math.round(site.y)*193)>>>0);
  c.save();
  c.globalAlpha*=Math.min(1,opacity);

  // Sand is already packed around the foundation before the slab is drawn.
  windDeposit(c,site.x-half*.94,front-f.depth*.22,f.width*.23,f.depth*.44,-.13,.70);
  windDeposit(c,site.x+half*.94,front-f.depth*.38,f.width*.22,f.depth*.43,.12,.72);
  windDeposit(c,site.x-half*.17,front+f.lip+3,f.width*.42,Math.max(9,f.depth*.23),0,.65);

  // Contact shadow and visible shallow cut-stone skirt.
  polygon(c,p,2,f.lip+2);
  c.fillStyle='rgba(70,42,20,0.28)';
  c.fill();
  c.beginPath();
  c.moveTo(p[5].x,p[5].y);
  c.lineTo(p[4].x,p[4].y);
  c.lineTo(p[4].x+1,p[4].y+f.lip);
  c.lineTo(p[5].x+1,p[5].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(120,80,43,0.89)';
  c.fill();
  c.beginPath();
  c.moveTo(p[4].x,p[4].y);
  c.lineTo(p[3].x,p[3].y);
  c.lineTo(p[3].x+2,p[3].y+f.lip);
  c.lineTo(p[4].x+1,p[4].y+f.lip);
  c.closePath();
  c.fillStyle='rgba(102,65,35,0.83)';
  c.fill();

  // Opaque, sandy sandstone surface rather than the previous translucent ghost.
  polygon(c,p);
  const stone=c.createLinearGradient(0,back,0,front);
  stone.addColorStop(0,'#d8b584');
  stone.addColorStop(.48,'#caa272');
  stone.addColorStop(1,'#b58a56');
  c.fillStyle=stone;
  c.fill();
  c.lineWidth=1.1;
  c.strokeStyle='rgba(108,72,39,0.59)';
  c.stroke();

  c.beginPath();
  c.moveTo(p[7].x,p[7].y);
  c.lineTo(p[0].x,p[0].y);
  c.lineTo(p[1].x,p[1].y);
  c.strokeStyle='rgba(250,219,165,0.60)';
  c.lineWidth=1.25;
  c.stroke();

  // Deposits overlap the sandstone surface, but not the structure drawn later.
  // Clipping means no translucent rectangles can spill behind the building.
  c.save();
  polygon(c,p);
  c.clip();
  windDeposit(c,site.x-half*.76,front-f.depth*.17,f.width*.29,f.depth*.45,-.14,.99);
  windDeposit(c,site.x+half*.77,front-f.depth*.20,f.width*.28,f.depth*.51,.13,.96);
  windDeposit(c,site.x-half*.15,front-f.depth*.03,f.width*.40,f.depth*.25,-.05,.74);
  windDeposit(c,site.x+half*.52,back+f.depth*.20,f.width*.25,f.depth*.25,.10,.66);

  // A handful of curved wind ridges and tiny embedded grains break up flatness.
  for(let i=0;i<10;i++){
    const x=site.x+(rnd()-.5)*(f.width-12);
    const y=back+5+rnd()*(f.depth-11);
    const length=5+rnd()*Math.min(21,f.width*.07);
    c.beginPath();
    c.moveTo(x,y);
    c.bezierCurveTo(x+length*.25,y-1,x+length*.58,y-1.5,x+length,y-2.5);
    c.strokeStyle=i%3===0?'rgba(115,79,42,0.13)':'rgba(250,211,148,0.31)';
    c.lineWidth=.75+rnd()*.55;
    c.stroke();
  }
  for(let i=0;i<12;i++){
    const x=site.x+(rnd()-.5)*(f.width-12);
    const y=back+4+rnd()*(f.depth-9);
    c.beginPath();
    c.ellipse(x,y,.45+rnd()*1.1,.25+rnd()*.55,0,0,FULL_CIRCLE);
    c.fillStyle=i%3===0?'rgba(113,76,40,0.26)':'rgba(246,203,138,0.47)';
    c.fill();
  }
  c.restore();
  c.restore();
}
