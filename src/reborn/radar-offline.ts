/** Pure white/grey receiver noise. Deliberately accepts no game/map state. */
export function offlineRadarPixels(size:number,time:number,reducedMotion=false):Uint8ClampedArray {
 const pixels=new Uint8ClampedArray(size*size*4),frame=reducedMotion?0:Math.floor(time*12);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let n=Math.imul((x>>1)+11,374761393)^Math.imul((y>>1)+31,668265263)^Math.imul(frame,1597334677);
  n=Math.imul(n^(n>>>13),1274126177);const noise=((n^(n>>>16))>>>0)/4294967296;
  const value=Math.round(45+noise*145+(y%4===0?-20:0)),i=(y*size+x)*4;
  pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;
 }
 return pixels;
}
export function paintOfflineRadar(c:CanvasRenderingContext2D,size:number,time:number,reducedMotion=false):void {
 const image=c.createImageData(size,size);image.data.set(offlineRadarPixels(size,time,reducedMotion));c.putImageData(image,0,0);
}
