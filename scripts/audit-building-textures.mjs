/** Decode the extracted reference pixels with the existing browser QA runtime.
 * K-means/connected components report measured colours and patch sizes, never
 * hand-picked paint values. Requires the project's optional browser test deps. */
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from '../tests/browser/node_modules/playwright/index.mjs';
import {HQ3_TILE_SPAN} from './webgl-building-design.js';
const browser=await chromium.launch({channel:process.env.SANDFORGE_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const page=await browser.newPage();
 const results={};
 for(const name of ['camouflage-albedo','roof-albedo','concrete-albedo','metal-albedo','door-albedo']){
  const bytes=readFileSync('src/assets/reborn/buildings-3d/hq3-materials/'+name+'.jpg');
  results[name]=await page.evaluate(async url=>{
   const img=new Image();img.src=url;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,384,384);
   const pixels=ctx.getImageData(0,0,384,384).data;
   const ordered=Array.from({length:pixels.length/4},(_,i)=>i).sort((a,b)=>
    (pixels[a*4]+pixels[a*4+1]+pixels[a*4+2])-(pixels[b*4]+pixels[b*4+1]+pixels[b*4+2]));
   let centers=[.1,.5,.9].map(q=>{const i=ordered[Math.floor((ordered.length-1)*q)];return Array.from(pixels.slice(i*4,i*4+3));});
   const labels=new Uint8Array(384*384);
   for(let step=0;step<20;step++){
    const sums=centers.map(()=>[0,0,0,0]);
    for(let i=0;i<labels.length;i++){
     let best=0,d=Infinity;
     for(let c=0;c<3;c++){const e=centers[c].reduce((n,v,k)=>n+(pixels[i*4+k]-v)**2,0);if(e<d){best=c;d=e;}}
     labels[i]=best;for(let k=0;k<3;k++)sums[best][k]+=pixels[i*4+k];sums[best][3]++;
    }
    centers=centers.map((c,i)=>sums[i][3]?c.map((_,k)=>sums[i][k]/sums[i][3]):c);
   }
   const swatches=centers.map((rgb,label)=>({rgb:rgb.map(v=>+v.toFixed(3)),hex:'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),fraction:labels.reduce((n,v)=>n+(v===label?1:0),0)/labels.length}));
   const visited=new Uint8Array(labels.length),patches=[];
   for(let i=0;i<labels.length;i++){
    if(visited[i])continue;
    const label=labels[i],queue=[i];visited[i]=1;let x0=384,y0=384,x1=0,y1=0;
    for(let q=0;q<queue.length;q++){
     const index=queue[q],x=index%384,y=Math.floor(index/384);
     x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
     const neighbors=[];if(x>0)neighbors.push(index-1);if(x<383)neighbors.push(index+1);if(y>0)neighbors.push(index-384);if(y<383)neighbors.push(index+384);
     for(const j of neighbors)if(!visited[j]&&labels[j]===label){visited[j]=1;queue.push(j);}
    }
    if(queue.length>=labels.length*.005)patches.push({label,areaFraction:queue.length/labels.length,uvBounds:[x0/384,y0/384,(x1+1)/384,(y1+1)/384]});
   }
   return {width:img.width,height:img.height,analysisResolution:384,method:'RGB k-means k=3, 20 iterations, connected 4-neighbour components >=0.5% image area; JPEG-decoded sRGB',swatches,patches:patches.sort((a,b)=>b.areaFraction-a.areaFraction)};
  },'data:image/jpeg;base64,'+bytes.toString('base64'));
  const family=name.split('-')[0];results[name].projectedTileSpan=HQ3_TILE_SPAN[family];
 }
 writeFileSync('docs/building-design-system/texture-audit.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{resolution:v.width,swatches:v.swatches}]))));
}finally{await browser.close();}
