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
  // Give the headquarters a little more visible apron at the left and right.
  const width=large?visualWidth*(kind==='headquarters'?1.11:1.085):Math.max(spec.radius*1.88,visualWidth*.88);
  return {
    width,
    // The old 0.35 depth stopped halfway beneath the sprite: its rear rim was invisible.
    // A longer pad reaches behind the roofline while the actual 3D sprite still masks its centre.
    depth:large?Math.max(spec.radius*.95,width*(kind==='headquarters'?.68:kind==='barracks'?.64:kind==='factory'?.61:.57)):Math.max(spec.radius*.88,width*.46),
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

export interface FoundationPoint {x:number;y:number}
type Pt=FoundationPoint;

/**
 * The game's camera looks down on two diagonal building axes.
 * Earlier foundations had horizontal rear/front edges and vertical sides;
 * these eight vertices describe a lightly chamfered isometric diamond instead.
 */
export function foundationOutline(site:FoundationSite,f:FoundationFootprint=foundationFootprint(site.kind)):Pt[] {
  const x=site.x,half=f.width/2,back=site.y+f.front-f.depth,front=site.y+f.front;
  const middle=(back+front)/2,k=f.corner*.44;
  return [
    {x:x-k,y:back+k*.48},          // 0 top-left chamfer
    {x:x+k,y:back},                // 1 rear tip
    {x:x+half-k,y:middle-k*.50},   // 2 upper-right chamfer
    {x:x+half,y:middle+k*.50},     // 3 right tip
    {x:x+k,y:front-k*.60},        // 4 lower-right chamfer
    {x:x-k,y:front},              // 5 front tip
    {x:x-half+k,y:middle+k*.50},  // 6 lower-left chamfer
    {x:x-half,y:middle-k*.50},    // 7 left tip
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

/**
 * Wind-built sand tongue over an isometric slab edge. A broad irregular crest is
 * nearly opaque at the border, feathered into both terrain and the stone inward.
 * The stone remains visible between tongues. All values are deterministic.
 */
function buryEdge(c:CanvasRenderingContext2D,a:Pt,b:Pt,t0:number,t1:number,depth:number,rnd:()=>number):void {
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(len<=.01)return;
  const nx=dy/len,ny=-dx/len;
  const p0={x:a.x+dx*t0,y:a.y+dy*t0},p1={x:a.x+dx*t1,y:a.y+dy*t1};
  const outer=4+depth*.27;
  const inner0=depth*(.68+rnd()*.35),inner1=depth*(.57+rnd()*.4);
  const edgeStart={x:p0.x+nx*outer,y:p0.y+ny*outer};
  const edgeEnd={x:p1.x+nx*outer,y:p1.y+ny*outer};
  const tip={x:(p0.x+p1.x)*.5-nx*(depth*(.94+rnd()*.32)),
    y:(p0.y+p1.y)*.5-ny*(depth*(.94+rnd()*.32))};
  c.beginPath();
  c.moveTo(edgeStart.x,edgeStart.y);
  c.bezierCurveTo(
    edgeStart.x+dx*(t1-t0)*.30,edgeStart.y+dy*(t1-t0)*.30,
    edgeEnd.x-dx*(t1-t0)*.25,edgeEnd.y-dy*(t1-t0)*.25,
    edgeEnd.x,edgeEnd.y
  );
  c.bezierCurveTo(
    p1.x-nx*inner1*.56,p1.y-ny*inner1*.56,
    p1.x-dx*(t1-t0)*.18-nx*inner1,p1.y-dy*(t1-t0)*.18-ny*inner1,
    tip.x,tip.y
  );
  c.bezierCurveTo(
    p0.x+dx*(t1-t0)*.19-nx*inner0,p0.y+dy*(t1-t0)*.19-ny*inner0,
    p0.x-nx*inner0*.58,p0.y-ny*inner0*.58,
    edgeStart.x,edgeStart.y
  );
  c.closePath();

  const midX=(p0.x+p1.x)*.5,midY=(p0.y+p1.y)*.5;
  const sand=c.createLinearGradient(
    midX+nx*outer,midY+ny*outer,
    midX-nx*depth*1.05,midY-ny*depth*1.05
  );
  sand.addColorStop(0,'rgba(234,178,100,0)');
  sand.addColorStop(.16,'rgba(235,181,102,0.82)');
  sand.addColorStop(.34,'rgba(238,182,102,0.98)');
  sand.addColorStop(.62,'rgba(224,164,85,0.93)');
  sand.addColorStop(.82,'rgba(217,155,79,0.63)');
  sand.addColorStop(1,'rgba(215,151,72,0)');
  c.fillStyle=sand;
  c.fill();

  // Shallow crescent of wind-packed sand on the lee side, not an outlined rectangle.
  c.beginPath();
  c.moveTo(p0.x-nx*depth*.20,p0.y-ny*depth*.20);
  c.bezierCurveTo(
    p0.x+dx*(t1-t0)*.27-nx*depth*.57,p0.y+dy*(t1-t0)*.27-ny*depth*.57,
    p1.x-dx*(t1-t0)*.34-nx*depth*.54,p1.y-dy*(t1-t0)*.34-ny*depth*.54,
    p1.x-nx*depth*.21,p1.y-ny*depth*.21
  );
  c.strokeStyle='rgba(248,209,144,0.34)';
  c.lineWidth=1.4;
  c.stroke();
}

/** Solid, walkable-looking pad with a weathered stone edge and sand collecting on top. */
export function paintDesertFoundation(c:CanvasRenderingContext2D,site:FoundationSite,opacity=1):void {
  if(opacity<=0)return;
  const f=foundationFootprint(site.kind);
  const p=foundationOutline(site,f),half=f.width/2,back=site.y+f.front-f.depth,front=site.y+f.front;
  const rnd=grain((Math.imul(site.id,2246822519)+Math.round(site.x)*97+Math.round(site.y)*193)>>>0);
  c.save();
  c.globalAlpha*=Math.min(1,opacity);

  // Sand is already packed around the foundation before the slab is drawn.
  windDeposit(c,site.x-half*.94,front-f.depth*.22,f.width*.23,f.depth*.44,-.13,.70);
  windDeposit(c,site.x+half*.94,front-f.depth*.38,f.width*.22,f.depth*.43,.12,.72);
  windDeposit(c,site.x-half*.17,front+f.lip+3,f.width*.42,Math.max(9,f.depth*.23),0,.65);

  // Contact shadow and visible shallow cut-stone skirt.
  polygon(c,p,1.5,f.lip+2);
  c.fillStyle='rgba(70,42,20,0.28)';
  c.fill();
  // The near-facing bevel follows both slanted iso axes instead of one long horizontal stripe.
  for(const [start,end,color] of [
    [6,5,'rgba(120,80,43,0.89)'],
    [5,4,'rgba(118,78,43,0.85)'],
    [4,3,'rgba(102,65,35,0.83)']
  ] as const){
    c.beginPath();
    c.moveTo(p[start].x,p[start].y);
    c.lineTo(p[end].x,p[end].y);
    c.lineTo(p[end].x+1,p[end].y+f.lip);
    c.lineTo(p[start].x+1,p[start].y+f.lip);
    c.closePath();
    c.fillStyle=color;
    c.fill();
  }

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
  windDeposit(c,site.x-half*.76,front-f.depth*.17,f.width*.29,f.depth*.45,-.14,1);
  windDeposit(c,site.x+half*.77,front-f.depth*.20,f.width*.28,f.depth*.51,.13,.96);
  windDeposit(c,site.x-half*.15,front-f.depth*.03,f.width*.40,f.depth*.25,-.05,.74);
  windDeposit(c,site.x+half*.52,back+f.depth*.20,f.width*.25,f.depth*.25,.10,.66);
  // Wind-blown sand over the rear rim: the platform is built INTO the desert.
  windDeposit(c,site.x-half*.54,back+f.depth*.08,f.width*.28,f.depth*.14,-.12,.88);
  windDeposit(c,site.x+half*.40,back+f.depth*.05,f.width*.24,f.depth*.12,.12,.86);

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
  c.restore(); // End clipping; dunes below must cross the plate/terrain boundary.

  // Actual edge occlusion (not a translucent texture clipped inside a rectangle).
  // Overlaps between deposits leave irregular exposed sandstone sections.
  windDeposit(c,site.x-half*.97,back+f.depth*.16,f.width*.18,f.depth*.15,-.28,1.10);
  windDeposit(c,site.x+half*.98,back+f.depth*.31,f.width*.19,f.depth*.17,.29,1.06);
  windDeposit(c,site.x-half*.98,front-f.depth*.30,f.width*.16,f.depth*.18,-.23,.98);
  windDeposit(c,site.x+half*.97,front-f.depth*.18,f.width*.16,f.depth*.17,.18,1.05);
  windDeposit(c,site.x-half*.55,front+f.lip,f.width*.23,Math.max(8,f.depth*.085),-.10,1.08);
  windDeposit(c,site.x+half*.31,front+f.lip+1,f.width*.23,Math.max(8,f.depth*.10),.12,.98);
  windDeposit(c,site.x+half*.12,back+1,f.width*.26,Math.max(7,f.depth*.09),.07,1.02);

  // Opaque organic dune tongues bury long but discontinuous parts of the slab rim.
  // Front, far-left, far-right and rear are all covered; no single rectangular outline.
  const edges:[[number,number,number,number,number],[number,number,number,number,number],
    [number,number,number,number,number],[number,number,number,number,number]]=[
    [1,2,.12,.77,.12], // rear/right
    [3,4,.16,.72,.18], // right/front
    [5,6,.05,.73,.18], // front/left
    [7,0,.14,.82,.14], // left/rear
  ];
  for(const [i,j,a,b,ratio] of edges){
    buryEdge(c,p[i],p[j],a,b,Math.max(8,f.width*ratio),rnd);
    // Partial second drift with a gap: stone is still recognizable.
    buryEdge(c,p[i],p[j],.84,.97,Math.max(6,f.width*.070),rnd);
  }
  c.restore();
}
