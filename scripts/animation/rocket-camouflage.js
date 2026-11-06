/** Reuse the actual authored Leopard camouflage, without loading tank geometry.
 * The resulting GLBs embed their own PNG, so gameplay/gallery need no tank link. */
import * as T from 'three';
let pending;
export function loadRocketCamouflage(){
 return pending??=(async()=>{
  const response=await fetch('/src/assets/reborn/animation/tank-0.glb');if(!response.ok)throw Error('Tank camouflage source unavailable');
  const file=await response.arrayBuffer(),header=new DataView(file),jsonLength=header.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(file,20,jsonLength)));
  const material=gltf.materials.find(m=>m.name==='tan'),image=gltf.images[gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index].source],view=gltf.bufferViews[image.bufferView],offset=28+jsonLength+(view.byteOffset??0);
  const bitmap=await createImageBitmap(new Blob([file.slice(offset,offset+view.byteLength)],{type:image.mimeType}));
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);bitmap.close();
  // Fine worn paint, mineral dust and vertical rain/dirt traces, kept subtle
  // enough that the original tank's olive/brown/sand pattern remains dominant.
  let seed=0x524f434b;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1500;i++){const x=random()*canvas.width,y=random()*canvas.height;c.strokeStyle=`rgba(211,185,135,${.05+random()*.11})`;c.lineWidth=random()>.85?2:1;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+random()*15,y+(random()-.5)*3);c.stroke();}
  for(let i=0;i<100;i++){const x=random()*canvas.width,y=random()*canvas.height,length=15+random()*95;c.strokeStyle=`rgba(37,31,23,${.025+random()*.035})`;c.lineWidth=1+random()*3;c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*3,y+length);c.stroke();}
  const map=new T.CanvasTexture(canvas);map.name='Leopard woodland camouflage / weathered paint';map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;return map;
 })();
}
