import {COUNTRIES,WORLD_WIDTH,WORLD_HEIGHT} from '../data/europe.js';
import {LAKES} from '../data/topography.js';

/** Render once at DPR 2. Geography never touches the simulation raster. */
export function createTopographyLayer():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=WORLD_WIDTH*2;canvas.height=WORLD_HEIGHT*2;
  const image=new Image();
  image.onload=()=>{
    const c=canvas.getContext('2d')!;c.scale(2,2);
    const land=new Path2D();
    for(const country of COUNTRIES)for(const ring of country.rings){
      ring.forEach(([x,y],i)=>i===0?land.moveTo(x,y):land.lineTo(x,y));land.closePath();
    }
    c.save();c.clip(land);c.globalAlpha=.65;c.drawImage(image,0,0,WORLD_WIDTH,WORLD_HEIGHT);c.globalAlpha=1;
    c.fillStyle='rgba(65,108,133,.50)';c.strokeStyle='rgba(174,207,217,.30)';c.lineWidth=.3;
    for(const lake of LAKES){
      const path=new Path2D();for(const ring of lake.rings){ring.forEach(([x,y],i)=>i===0?path.moveTo(x,y):path.lineTo(x,y));path.closePath();}
      c.fill(path,'evenodd');c.stroke(path);
    }
    c.restore();canvas.dataset.ready='true';
  };
  image.src=new URL('../assets/europe-relief.png',import.meta.url).href;
  return canvas;
}
