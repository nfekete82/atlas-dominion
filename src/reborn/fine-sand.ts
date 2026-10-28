/**
 * Seamless 2048² sand material, generated once on map load. Tiny mineral grains
 * and wind ripples live in the texture; rocks and impact craters remain separate
 * world decorations, so no repeated craters are baked into the ground.
 */
export const FINE_SAND_TILE_SIZE=2048;
const TWO_PI=Math.PI*2;
let cachedTile:HTMLCanvasElement|undefined;

function hash(a:number,b:number,seed:number):number {
  let h=(Math.imul(a,374761393)+Math.imul(b,668265263)+seed)>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return ((h^(h>>>16))>>>0)/4294967296;
}
function lattice(cells:number,seed:number):Float32Array {
  const values=new Float32Array(cells*cells);
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)values[y*cells+x]=hash(x,y,seed)*2-1;
  return values;
}
function smooth(t:number):number{return t*t*(3-2*t);}
function sample(values:Float32Array,cells:number,x:number,y:number):number {
  const px=x*cells/FINE_SAND_TILE_SIZE,py=y*cells/FINE_SAND_TILE_SIZE;
  const ix=Math.floor(px),iy=Math.floor(py),fx=smooth(px-ix),fy=smooth(py-iy),mask=cells-1;
  const x0=ix&mask,x1=(ix+1)&mask,y0=iy&mask,y1=(iy+1)&mask;
  const a=values[y0*cells+x0],b=values[y0*cells+x1];
  const c=values[y1*cells+x0],d=values[y1*cells+x1];
  return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
}
const macro=lattice(16,0x47c91),medium=lattice(64,0x15ea7);

/** Periodic in both axes; useful for tests and preserving a seamless pattern. */
export function fineSandColor(x:number,y:number):readonly [number,number,number] {
  const size=FINE_SAND_TILE_SIZE;
  x=((x%size)+size)%size;y=((y%size)+size)%size;
  const broad=sample(macro,16,x,y),detail=sample(medium,64,x,y);
  const dune=Math.sin(TWO_PI*(x*7+y*37)/size+broad*.62+detail*.18);
  const ripple=Math.sin(TWO_PI*(x*11+y*79)/size+detail*.44+broad*.32);
  const grain=(hash(x,y,0xa6731)-.5)*8;
  const shade=broad*8+detail*3+dune*2.3+ripple*.85+grain;
  return [229+shade,184+shade*.84,115+shade*.62];
}

/** One-time allocation; no sand synthesis is performed in the render loop. */
export function fineSandPattern(context:CanvasRenderingContext2D):CanvasPattern {
  if(!cachedTile){
    const tile=document.createElement('canvas');tile.width=tile.height=FINE_SAND_TILE_SIZE;
    const ctx=tile.getContext('2d')!;
    const data=ctx.createImageData(tile.width,tile.height);
    for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
      const [r,g,b]=fineSandColor(x,y),i=(y*tile.width+x)*4;
      data.data[i]=r;data.data[i+1]=g;data.data[i+2]=b;data.data[i+3]=255;
    }
    ctx.putImageData(data,0,0);cachedTile=tile;
  }
  return context.createPattern(cachedTile,'repeat')!;
}
