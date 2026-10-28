/** Deterministic embedded PBR textures shared by authored desert vehicles. */
import * as T from 'three';
export function makeDesertSurfaceMaps({uniform=false}={}){
 const size=1024,canvases=Array.from({length:3},()=>Object.assign(document.createElement('canvas'),{width:size,height:size}));
 const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size));let seed=17317;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,noise=rand(),wave=Math.sin(x*.018+Math.sin(y*.012)*3)+Math.cos(y*.023+Math.cos(x*.011)*2),cam=uniform?[188,162,118]:wave>.65?[142,134,99]:wave<-.8?[107,110,81]:[183,163,121];
  const seam=x%256<2||y%256<2,scratch=noise>.998||((x+y*13)%397===0&&noise>.55),wear=seam?-.3:scratch?.28:(noise-.5)*.11;
  for(let c=0;c<3;c++)images[0].data[i+c]=cam[c]*(1+wear);images[0].data[i+3]=255;
  images[1].data.set([126+(noise-.5)*18,128+(rand()-.5)*18,253,255],i);
  images[2].data.set([seam?155:245,Math.round(175+noise*55),Math.round(95+noise*30),255],i);
 }
 const textures=canvases.map((canvas,i)=>{contexts[i].putImageData(images[i],0,0);const t=new T.CanvasTexture(canvas);t.name=['Desert camouflage / scratches','Sandblasted metal normal','Packed occlusion roughness metallic'][i];t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;return t;});return textures;
}
