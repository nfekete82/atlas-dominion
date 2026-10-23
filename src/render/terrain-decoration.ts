import {COUNTRIES,WORLD_WIDTH,WORLD_HEIGHT} from '../data/europe.js';
import {LAKES} from '../data/topography.js';
import {drawSprite,loadPixelArt} from './sprite-atlas.js';
import {visualHash} from './pixel-art-style.js';

export interface TerrainLayers {broad:HTMLCanvasElement;detail:HTMLCanvasElement;ready:Promise<void>}
/** Two immutable native-pixel caches. Relief is geographical evidence for
 * ridges, not an elevation model; forest vignettes are sparse decoration,
 * explicitly not a land-cover dataset or additional game terrain. */
export function createTerrainDecoration():TerrainLayers {
  const broad=document.createElement('canvas'),detail=document.createElement('canvas');
  for(const layer of [broad,detail]){layer.width=WORLD_WIDTH;layer.height=WORLD_HEIGHT;}
  const ready=(async()=>{
    const relief=new Image();
    const loaded=new Promise<boolean>(resolve=>{relief.onload=()=>resolve(true);relief.onerror=()=>resolve(false);});
    relief.src=new URL('../assets/europe-relief.png',import.meta.url).href;
    const [hasRelief]=await Promise.all([loaded,loadPixelArt()]);
    const mask=document.createElement('canvas');mask.width=WORLD_WIDTH;mask.height=WORLD_HEIGHT;
    const m=mask.getContext('2d',{willReadFrequently:true})!,land=new Path2D();
    for(const country of COUNTRIES)for(const ring of country.rings){
      ring.forEach(([x,y],i)=>i?land.lineTo(x,y):land.moveTo(x,y));land.closePath();
    }
    m.fillStyle='#fff';m.fill(land);
    m.globalCompositeOperation='destination-out';
    for(const lake of LAKES){const p=new Path2D();for(const ring of lake.rings){
      ring.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();
    }m.fill(p,'evenodd');}
    const pixels=m.getImageData(0,0,WORLD_WIDTH,WORLD_HEIGHT).data;
    const isLand=(x:number,y:number)=>x>=0&&y>=0&&x<WORLD_WIDTH&&y<WORLD_HEIGHT&&pixels[(Math.floor(y)*WORLD_WIDTH+Math.floor(x))*4+3]>245;
    m.globalCompositeOperation='source-over';m.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    if(hasRelief)m.drawImage(relief,0,0,WORLD_WIDTH,WORLD_HEIGHT);
    const shade=m.getImageData(0,0,WORLD_WIDTH,WORLD_HEIGHT).data;
    const strength=(x:number,y:number)=>shade[(Math.floor(y)*WORLD_WIDTH+Math.floor(x))*4+3];
    const b=broad.getContext('2d')!,d=detail.getContext('2d')!;
    // Broad ground strokes are distributed independently of gameplay sectors.
    for(let y=16;y<WORLD_HEIGHT;y+=30)for(let x=16;x<WORLD_WIDTH;x+=30){
      if(!isLand(x,y))continue;
      drawSprite(b,'terrain',`grass-${Math.floor(visualHash(x,y,1)*4)}`,x,y,1);
    }
    for(let y=20;y<WORLD_HEIGHT-20;y+=18)for(let x=20;x<WORLD_WIDTH-20;x+=18){
      const px=x+Math.floor(visualHash(x,y,2)*10),py=y+Math.floor(visualHash(x,y,3)*10);
      if(!isLand(px,py)||!isLand(px-9,py-5)||!isLand(px+9,py-10))continue;
      let reliefEnergy=0;
      for(let sy=-5;sy<=5;sy+=5)for(let sx=-5;sx<=5;sx+=5)reliefEnergy+=strength(px+sx,py+sy);
      reliefEnergy/=9;
      const roll=visualHash(x,y,4),variant=Math.floor(visualHash(x,y,5)*3);
      if(reliefEnergy>13&&roll<.42){
        drawSprite(d,'terrain',`mountain-${variant}`,px,py,.55);
      }else if(reliefEnergy<9&&roll<.055&&py<660&&px>330){
        // Coherent small temperate vignettes, not evenly sprinkled tree noise.
        drawSprite(d,'terrain',`forest-${variant}`,px,py,.6);
      }
    }
    // Clip every ground/forest/ridge pixel to genuine land, excluding lakes.
    for(const ctx of [b,d]){
      ctx.globalCompositeOperation='destination-in';
      m.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);m.fillStyle='#fff';m.fill(land);
      m.globalCompositeOperation='destination-out';
      for(const lake of LAKES){const p=new Path2D();for(const ring of lake.rings){ring.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();}m.fill(p,'evenodd');}
      m.globalCompositeOperation='source-over';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
    }
    // Short water highlights occur only where a real coast is nearby.
    const coast=document.createElement('canvas');coast.width=WORLD_WIDTH;coast.height=WORLD_HEIGHT;
    const coastContext=coast.getContext('2d')!;
    for(let y=20;y<WORLD_HEIGHT-20;y+=28)for(let x=20;x<WORLD_WIDTH-20;x+=28){
      if(isLand(x,y)||visualHash(x,y,7)>.16)continue;
      if(![[-12,0],[12,0],[0,-12],[0,12]].some(([dx,dy])=>isLand(x+dx,y+dy)))continue;
      if([[-7,0],[7,0],[0,-7],[0,7]].some(([dx,dy])=>isLand(x+dx,y+dy)))continue;
      drawSprite(coastContext,'terrain',`water-${Math.floor(visualHash(x,y,8)*2)}`,x,y,.65);
    }
    // Every accent pixel is clipped to water, even beside narrow peninsulas.
    coastContext.globalCompositeOperation='destination-out';coastContext.drawImage(mask,0,0);
    b.drawImage(coast,0,0);
    for(const layer of [broad,detail])layer.dataset.ready='true';
  })();
  return {broad,detail,ready};
}
