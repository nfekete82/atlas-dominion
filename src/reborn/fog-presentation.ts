/**
 * Smooth, inward-feathered fog of war. Fog boundaries fade only into known
 * visible terrain: unexplored cells stay fully opaque, and explored but no
 * longer visible cells stay at least as dark as the original remembered fog.
 * Gameplay line-of-sight and saved exploration masks are never modified.
 */
export const FOG_SCALE=2;
export const FOG_REMEMBERED_ALPHA=177;
export const FOG_UNKNOWN_ALPHA=255;
export const FOG_FEATHER_CELLS=2.4;
export const FOG_BACKGROUND='#080b0d';
const DIAGONAL=Math.SQRT2;

/** Approximate Euclidean distance between grid-cell centers (8-neighbor chamfer). */
function distanceField(target:Uint8Array,width:number):Float32Array {
  const distances=new Float32Array(target.length),far=width*2;
  for(let i=0;i<target.length;i++)distances[i]=target[i]?0:far;
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const i=y*width+x;
    if(x)distances[i]=Math.min(distances[i],distances[i-1]+1);
    if(y){
      distances[i]=Math.min(distances[i],distances[i-width]+1);
      if(x)distances[i]=Math.min(distances[i],distances[i-width-1]+DIAGONAL);
      if(x+1<width)distances[i]=Math.min(distances[i],distances[i-width+1]+DIAGONAL);
    }
  }
  for(let y=width-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x;
    if(x+1<width)distances[i]=Math.min(distances[i],distances[i+1]+1);
    if(y+1<width){
      distances[i]=Math.min(distances[i],distances[i+width]+1);
      if(x)distances[i]=Math.min(distances[i],distances[i+width-1]+DIAGONAL);
      if(x+1<width)distances[i]=Math.min(distances[i],distances[i+width+1]+DIAGONAL);
    }
  }
  return distances;
}
/**
 * Gently irregular, deterministic shoreline. The perturbation is well below a
 * grid cell; it affects only the presentation, never visibility or exploration.
 */
export function fogEdgeOffset(x:number,y:number):number {
  return Math.sin(x*.21+y*.10)*.13
    +Math.sin(x*.11-y*.19)*.10
    +Math.sin(x*.051+y*.049)*.08;
}
function feather(distance:number):number {
  const t=Math.max(0,Math.min(1,distance/FOG_FEATHER_CELLS));
  return 1-t*t*(3-2*t);
}

/** Muted desert dust tint, painted only in genuinely visible boundary pixels. */
export function fogOverlayRgb(alpha:number,isVisible:boolean,x:number,y:number):readonly [number,number,number] {
  if(!isVisible||alpha<=0||alpha>=250)return [8,11,13];
  const band=Math.max(0,1-Math.abs(alpha-96)/129);
  if(band===0)return [8,11,13];
  const grain=((Math.imul(x,374761393)^Math.imul(y,668265263))>>>0)%9-4;
  const strength=band*.72;
  return [Math.round(8+112*strength+grain*.40*strength),
          Math.round(11+77*strength+grain*.32*strength),
          Math.round(13+43*strength+grain*.20*strength)];
}
interface SampleAxis {lo:number;hi:number;t:number}
function sampleAxes(width:number,scale:number):SampleAxis[] {
  return Array.from({length:width*scale},(_,i)=>{
    const p=(i+.5)/scale-.5,lo=Math.max(0,Math.min(width-1,Math.floor(p))),hi=Math.min(width-1,lo+1);
    return {lo,hi,t:Math.max(0,Math.min(1,p-lo))};
  });
}
function sample(field:Float32Array,width:number,x:SampleAxis,y:SampleAxis):number {
  const row=y.lo*width,next=y.hi*width;
  const a=field[row+x.lo]+(field[row+x.hi]-field[row+x.lo])*x.t;
  const b=field[next+x.lo]+(field[next+x.hi]-field[next+x.lo])*x.t;
  return a+(b-a)*y.t;
}

/** Alpha-only mask, generated on visibility changes at 2x grid resolution. */
export function makeSmoothFogAlpha(visible:Uint8Array,explored:Uint8Array,grid:number,scale=FOG_SCALE):Uint8ClampedArray {
  if(!Number.isInteger(grid)||grid<1||!Number.isInteger(scale)||scale<1||visible.length!==grid*grid||explored.length!==grid*grid)
    throw new Error('Invalid fog dimensions');
  const unseen=new Uint8Array(visible.length),unknown=new Uint8Array(visible.length);
  for(let i=0;i<visible.length;i++){
    unseen[i]=visible[i]?0:1;
    unknown[i]=explored[i]?0:1;
  }
  const unseenDistance=distanceField(unseen,grid),unknownDistance=distanceField(unknown,grid);
  const width=grid*scale,alpha=new Uint8ClampedArray(width*width),axes=sampleAxes(grid,scale);
  for(let y=0;y<width;y++){
    const gy=(y/scale)|0,row=y*width,base=gy*grid;
    for(let x=0;x<width;x++){
      const cell=base+((x/scale)|0);
      if(!explored[cell]){alpha[row+x]=FOG_UNKNOWN_ALPHA;continue;}
      // Interior pixels use the unchanged semantic alpha without interpolation.
      if(!visible[cell]&&unknownDistance[cell]>FOG_FEATHER_CELLS+1.2){alpha[row+x]=FOG_REMEMBERED_ALPHA;continue;}
      if(visible[cell]&&unseenDistance[cell]>FOG_FEATHER_CELLS+1.2&&unknownDistance[cell]>FOG_FEATHER_CELLS+1.2){alpha[row+x]=0;continue;}
      const wobble=fogEdgeOffset(x,y);
      const dim=FOG_REMEMBERED_ALPHA*feather(sample(unseenDistance,grid,axes[x],axes[y])+wobble);
      const blind=FOG_UNKNOWN_ALPHA*feather(sample(unknownDistance,grid,axes[x],axes[y])+wobble);
      alpha[row+x]=visible[cell]?Math.max(dim,blind):Math.max(FOG_REMEMBERED_ALPHA,blind);
    }
  }
  return alpha;
}

/** Compare actual visibility bits; simulation revisions may change without new sight. */
export function fogMaskChanged(visible:Uint8Array,explored:Uint8Array,previousVisible:Uint8Array,previousExplored:Uint8Array):boolean {
  if(visible.length!==previousVisible.length||explored.length!==previousExplored.length)return true;
  for(let i=0;i<visible.length;i++)if(visible[i]!==previousVisible[i]||explored[i]!==previousExplored[i])return true;
  return false;
}
