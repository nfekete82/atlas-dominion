/** One-time conservative 2D texture unsharp mask for the helicopter atlas.
 * Never fabricates detail: improves definition of already baked color seams.
 * Operates on fully opaque interior RGB only; leaves outlines/alpha untouched.
 * Tile boundaries are excluded to avoid bleeding adjacent animation frames. */
export function sharpenAtlasOpaqueRGB(data:Uint8ClampedArray,width:number,height:number,cell:number,strength=.32):Uint8ClampedArray {
 if(!Number.isInteger(width)||!Number.isInteger(height)||!Number.isInteger(cell)||width<3||height<3||cell<3||
   data.length!==width*height*4||!Number.isFinite(strength)||strength<0||strength>1)
   throw Error('Invalid atlas sharpening geometry');
 const result=new Uint8ClampedArray(data);
 for(let y=1;y<height-1;y++){
  if(y%cell===0||y%cell===cell-1)continue;
  for(let x=1;x<width-1;x++){
   if(x%cell===0||x%cell===cell-1)continue;
   const i=(y*width+x)*4,l=i-4,r=i+4,t=i-width*4,b=i+width*4;
   if(data[i+3]<245||data[l+3]<245||data[r+3]<245||data[t+3]<245||data[b+3]<245)continue;
   for(let c=0;c<3;c++)result[i+c]=Math.max(0,Math.min(255,
     Math.round(data[i+c]+strength*(data[i+c]-(data[l+c]+data[r+c]+data[t+c]+data[b+c])/4))));
  }
 }
 return result;
}
