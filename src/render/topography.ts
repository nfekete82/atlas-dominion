import {COUNTRIES,WORLD_WIDTH,WORLD_HEIGHT} from '../data/europe.js';
import {LAKES} from '../data/topography.js';

/** Render once at DPR 2. Geography never touches the simulation raster. */
export function createTopographyLayer():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=WORLD_WIDTH*2;canvas.height=WORLD_HEIGHT*2;
  const image=new Image();
  image.onload=()=>{
    const c=canvas.getContext('2d')!;c.scale(2,2);
    // Convert real hillshade into broad, stepped material clusters once.
    // The original relief remains the sole source of slope placement.
    const relief=document.createElement('canvas');relief.width=WORLD_WIDTH/2;relief.height=WORLD_HEIGHT/2;
    const rc=relief.getContext('2d')!;rc.drawImage(image,0,0,relief.width,relief.height);
    const data=rc.getImageData(0,0,relief.width,relief.height);
    for(let i=0;i<data.data.length;i+=4){
      const light=data.data[i]>128;
      const color=light?[209,190,159]:[98,89,79];
      data.data[i]=color[0];data.data[i+1]=color[1];data.data[i+2]=color[2];
      data.data[i+3]=Math.min(66,Math.round(data.data[i+3]/9)*12);
    }
    rc.putImageData(data,0,0);
    const land=new Path2D();
    for(const country of COUNTRIES)for(const ring of country.rings){
      ring.forEach(([x,y],i)=>i===0?land.moveTo(x,y):land.lineTo(x,y));land.closePath();
    }
    c.save();c.clip(land);c.imageSmoothingEnabled=false;c.drawImage(relief,0,0,WORLD_WIDTH,WORLD_HEIGHT);
    c.fillStyle='rgba(65,108,133,.85)';c.strokeStyle='rgba(146,183,185,.65)';c.lineWidth=.4;
    for(const lake of LAKES){
      const path=new Path2D();for(const ring of lake.rings){ring.forEach(([x,y],i)=>i===0?path.moveTo(x,y):path.lineTo(x,y));path.closePath();}
      c.fill(path,'evenodd');c.stroke(path);
    }
    c.restore();canvas.dataset.ready='true';
  };
  image.src=new URL('../assets/europe-relief.png',import.meta.url).href;
  return canvas;
}
