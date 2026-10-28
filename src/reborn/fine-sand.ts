/**
 * High-detail, seamless 2K material based on the original painted sand ripples.
 * The source artwork supplies all dune relief, highlights and natural shadows:
 * unlike synthetic noise, the material preserves its original microstructure.
 *
 * Built only on image load, never per animation frame. Rocks and impact marks
 * remain separate decorations instead of being duplicated in the repeating tile.
 */
export const FINE_SAND_TILE_SIZE=2048;
const EDGE_BLEND=112;
let cachedTile:HTMLCanvasElement|undefined;
let cachedSource:HTMLImageElement|undefined;

/** Periodic edge blend: keep the original interior, blend only the tile border. */
export function sandSeamWeight(position:number):number {
  const size=FINE_SAND_TILE_SIZE;
  const x=((position%size)+size)%size;
  const t=Math.min(1,Math.min(x,size-x)/EDGE_BLEND);
  return Math.sin(t*Math.PI/2)**2;
}

/** Keep added fine-grain contrast below 1.1 RGB units to avoid flat/noisy sand. */
function micrograin(x:number,y:number):number {
  let value=(Math.imul(x,374761393)^Math.imul(y,668265263)^0x6f24ac31)>>>0;
  value=Math.imul(value^(value>>>13),1274126177)>>>0;
  return (((value^(value>>>16))>>>0)/4294967296-.5)*2.2;
}

export function fineSandPattern(context:CanvasRenderingContext2D,source:HTMLImageElement):CanvasPattern {
  if(!source.complete||source.naturalWidth===0)throw new Error('Original sand artwork has not loaded');
  if(!cachedTile||cachedSource!==source){
    const size=FINE_SAND_TILE_SIZE,half=size/2;
    const tile=document.createElement('canvas');tile.width=tile.height=size;
    const c=tile.getContext('2d',{willReadFrequently:true})!;
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(source,0,0,size,size);
    const original=c.getImageData(0,0,size,size).data;
    const finished=c.createImageData(size,size);
    const target=finished.data;
    const weight=Float32Array.from({length:size},(_,x)=>sandSeamWeight(x));
    for(let y=0;y<size;y++){
      const wy=weight[y],row=y*size,shiftedRow=((y+half)%size)*size;
      for(let x=0;x<size;x++){
        const wx=weight[x],sx=(x+half)%size;
        const a=(row+x)*4,b=(row+sx)*4,d=(shiftedRow+x)*4,e=(shiftedRow+sx)*4;
        const grain=micrograin(x,y);
        for(let channel=0;channel<3;channel++){
          const top=original[a+channel]*wx+original[b+channel]*(1-wx);
          const bottom=original[d+channel]*wx+original[e+channel]*(1-wx);
          target[a+channel]=top*wy+bottom*(1-wy)+grain;
        }
        target[a+3]=255;
      }
    }
    c.putImageData(finished,0,0);
    cachedTile=tile;cachedSource=source;
  }
  return context.createPattern(cachedTile,'repeat')!;
}
