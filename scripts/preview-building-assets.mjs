import {readFile,writeFile} from 'node:fs/promises';
import {OfflineCanvas,decodePNG,encodePNG} from './animation/offline-canvas.mjs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';

// Review the shipped sprites (including all moving layers), at the existing
// relative game scale. This is an offline contact sheet, not a browser capture.
const dir=new URL('../src/assets/reborn/buildings-3d/',import.meta.url),canvas=new OfflineCanvas(1500,1080),c=canvas.getContext('2d');
c.fillStyle='#a48a64';c.fillRect(0,0,1500,1080);
const image=async name=>decodePNG(await readFile(new URL(name,dir)));
const kinds=['headquarters','factory','barracks','airfield','generator','turret','bastion'];let i=0;
for(const kind of kinds)for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
 const a=JSON.parse(await readFile(new URL(`${kind}-${team}.json`,dir),'utf8')),body=await image(a.body.image),width=kind==='bastion'?67:buildingArtWidth(kind,BUILDINGS[kind].width),scale=width*.83/a.body.solidBounds.w,x=150+i%5*300,y=275+Math.floor(i/5)*345;
 c.drawImage(body,x-a.body.pivot[0]*scale,y-a.body.pivot[1]*scale,512*scale,512*scale);
 for(const key of ['sweep','activity','beacon','turret'])if(a[key]){
  const layer=a[key],frame=layer.frames[key==='beacon'?0:key==='turret'?12:16],source=await image(layer.image);
  c.drawImage(source,frame.x,frame.y,frame.w,frame.h,x-layer.pivot[0]*scale,y-layer.pivot[1]*scale,frame.w*scale,frame.h*scale);
 }
 c.fillStyle=team===0?'#244d7d':team===1?'#852e27':'#d6ceb0';c.fillRect(x-100,y+62,200,4);
 c.font='14px monospace';c.textAlign='center';c.fillStyle='#282b27';c.fillText((kind==='headquarters'?'HQ':kind.toUpperCase())+' / '+(team===-1?'N':team?'02':'01'),x,y+85);
 i++;
}
await writeFile(new URL('../docs/buildings-3d/pbr-sprite-overview.png',import.meta.url),encodePNG(canvas.width,canvas.height,canvas.pixels));
console.log('Wrote offline overview: 15 variants at the existing relative game scale.');
