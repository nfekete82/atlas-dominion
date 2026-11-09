import * as THREE from 'three';
import {createStrategicBuilding,isStrategicBuilding} from './webgl-strategic-buildings.js';
import {createRocketInfantry} from './webgl-rocket-infantry.js';
import {createResearchArtwork,RESEARCH_ARTWORK_KINDS} from './webgl-research-artworks.js';
import {tintFactionMaterials} from './webgl-faction-accents.js';

/** Sprite-sheet portrait extraction shared by the WebGL HUD.
 * The classic game crops one idle frame rather than scaling down the entire
 * 8/16-direction animation atlas (which looks like tiny dots). */
const iconCache=new Map();
const folders=kind=>['infantry','engineer','medic','heavy'].includes(kind)?'prototype':'animation';
export const unitAtlasUrl=kind=>'/src/assets/reborn/'+folders(kind)+'/'+kind+'-0';
/** Local original vector icons for the new strategic facilities; existing
 * buildings retain their authored PNGs. No missing-file fetches or tracking. */
export const strategicBuildingIcon=kind=>{
 if(!['research','silo','interceptor'].includes(kind))return null;
 const pict=kind==='research'?
  '<rect x="40" y="65" width="112" height="86" rx="6" fill="#a9997c"/>'+
  '<rect x="44" y="74" width="103" height="57" fill="#4a5860"/>'+
  '<path d="M95 79 L95 38 M65 56 Q95 8 125 56Z" fill="#6499a7" stroke="#e8c58a" stroke-width="6"/>'+
  '<circle cx="95" cy="35" r="9" fill="#e5c98b"/>':
  kind==='silo'?
  '<rect x="35" y="116" width="126" height="45" rx="6" fill="#796d57"/>'+
  '<rect x="58" y="71" width="76" height="64" rx="6" fill="#485659"/>'+
  '<path d="M96 26 Q115 56 115 79 L115 138 L77 138 L77 79 Q77 55 96 26Z" fill="#9fa79d" stroke="#efd5a1" stroke-width="5"/>'+
  '<rect x="45" y="101" width="20" height="13" fill="#5eacbd"/>'+
  '<rect x="130" y="101" width="20" height="13" fill="#5eacbd"/>':
  '<rect x="30" y="110" width="132" height="52" rx="8" fill="#877b66"/>'+
  '<rect x="48" y="63" width="98" height="60" rx="8" fill="#4c6064"/>'+
  '<path d="M60 118 L71 59 L87 33 L92 103 M104 118 L115 59 L131 33 L136 103" stroke="#d1d2bd" stroke-width="17" stroke-linecap="round" fill="none"/>'+
  '<circle cx="39" cy="95" r="14" fill="#7eb8bf" stroke="#ddc591" stroke-width="4"/>';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="192" height="190" viewBox="0 0 192 190">'+
  '<rect x="8" y="8" width="176" height="174" rx="13" fill="#222a2a"/>'+
  '<ellipse cx="97" cy="160" rx="81" ry="17" fill="#665747"/>'+pict+
  '<rect x="18" y="168" width="156" height="4" rx="2" fill="#ba9a64"/>'+
  '</svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
};
export const buildingIconUrl=kind=>strategicBuildingIcon(kind)??
 '/src/assets/reborn/buildings-3d/'+kind+'-0.png';


/** Recognizable, original tactical pictograms; no font-dependent emoji/glyphs. */
const researchPaths=Object.freeze({
 armor1:'<path d="M12 2 4 5v6c0 5 3.3 8.6 8 11 4.7-2.4 8-6 8-11V5Z"/><path d="M8 12h8"/>',
 armor2:'<path d="M12 2 4 5v6c0 5 3.3 8.6 8 11 4.7-2.4 8-6 8-11V5Z"/><path d="M12 7v10M7 12h10"/><path d="M7 4 5 7m12-3 2 3"/>',
 precision:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
 engines:'<circle cx="8" cy="14" r="5"/><circle cx="8" cy="14" r="2"/><path d="m13 6 4-3m-2 7 7-4m-6 10 6-2M3 5l3 3"/>',
 infantryTraining:'<path d="M4 12a8 8 0 0 1 16 0v2H4Z"/><path d="M2 14h20M7 14v5l5 3 5-3v-5M10 8h4"/>',
 rocketDevelopment:'<path d="m5 17 5-5c0-5 4-9 10-10 0 6-4 10-9 10l-5 5Z"/><circle cx="15" cy="8" r="2"/><path d="M5 12 2 14l1 5 5-2M12 19l-2 3-5-1 2-5M3 22l4-4"/>',
 radar:'<path d="M3 20h18M12 20V9l7-5M12 13l-6-4"/><path d="M13 4a9 9 0 0 1 7 9M16 7a5 5 0 0 1 2 5"/><circle cx="12" cy="12" r="2"/>',
 tankArmor:'<path d="M3 16h18l-2 4H5Z"/><path d="M6 16v-5h12v5M9 11V8h6v3M12 4l-5 2v2M12 4l5 2v2"/><path d="M8 18h8"/>',
 tankMobility:'<path d="M3 14h18l-2 4H5Z"/><path d="M6 14V9h12v5M9 9V6h6v3"/><path d="M3 21h18M17 3h5m-3-2 3 2-3 2"/>'
});
export const researchEffectLabel=Object.freeze({
 armor1:'+10 % Fahrzeug-LP',
 armor2:'Weitere +10 % Fahrzeug-LP',
 precision:'+15 % Waffenschaden',
 engines:'+12 % Fahrzeugtempo',
 infantryTraining:'+15 % Infanterie-LP',
 rocketDevelopment:'+20 % Raketenreichweite',
 radar:'+20 % Sichtweite',
 tankArmor:'+15 % Kampfpanzer-LP',
 tankMobility:'+15 % Kampfpanzertempo'
});
export function researchIconMarkup(kind){
 const paths=researchPaths[kind]??researchPaths.armor1;
 return '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+paths+'</svg>';
}

/** Same physically-lit 3D render pipeline for strategic buildings and
 * research objects, using the actual scene meshes. PNG generation happens
 * once per kind and never on the animation/render loop.
 */
function renderModelPortrait(model,renderer,{width=320,height=220,research=false}={}){
 const scene=new THREE.Scene();
 scene.add(model);
 const hemi=new THREE.HemisphereLight('#fff3e2','#576e73',research?2.15:2.0);
 scene.add(hemi);
 const key=new THREE.DirectionalLight('#ffedcd',research?2.9:2.6);
 key.position.set(210,390,290);scene.add(key);
 const fill=new THREE.DirectionalLight('#b6dce5',.95);
 fill.position.set(-280,170,-170);scene.add(fill);
 const bounds=new THREE.Box3().setFromObject(model);
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const aspect=width/height;
 const span=Math.max(size.y*(research?1.9:1.8),(size.x+size.z)*(research?1.03:.95),1);
 const camera=new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,2000);
 camera.position.copy(center).add(new THREE.Vector3(research?115:350,research?115:310,research?170:380));
 camera.lookAt(center);camera.updateMatrixWorld();
 const target=new THREE.WebGLRenderTarget(width,height,{format:THREE.RGBAFormat,depthBuffer:true});
 const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()).clone();
 const oldAlpha=renderer.getClearAlpha();
 const oldViewport=renderer.getViewport(new THREE.Vector4()).clone();
 const oldScissor=renderer.getScissor(new THREE.Vector4()).clone();
 const oldScissorTest=renderer.getScissorTest();
 try{
  renderer.setRenderTarget(target);
  renderer.setScissorTest(false);
  renderer.setClearColor('#000000',0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);
  const pixels=new Uint8Array(width*height*4);
  renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  const output=document.createElement('canvas');output.width=width;output.height=height;
  const ctx=output.getContext('2d'),rgba=ctx.createImageData(width,height);
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++){
   const sourceRow=(height-1-y)*width*4;
   for(let x=0;x<width;x++){
    const i=(y*width+x)*4,j=sourceRow+x*4;
    rgba.data[i]=pixels[j];rgba.data[i+1]=pixels[j+1];
    rgba.data[i+2]=pixels[j+2];rgba.data[i+3]=pixels[j+3];
    if(pixels[j+3]>25){
     left=Math.min(left,x);top=Math.min(top,y);
     right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
   }
  }
  if(right<left)throw new Error('3D portrait is empty: '+model.name);
  const raw=document.createElement('canvas');raw.width=width;raw.height=height;
  raw.getContext('2d').putImageData(rgba,0,0);
  const w=right-left+1,h=bottom-top+1;
  const scale=Math.min(width*(research?.89:.93)/w,height*(research?.89:.92)/h);
  ctx.clearRect(0,0,width,height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(raw,left,top,w,h,(width-w*scale)/2,(height-h*scale)/2,w*scale,h*scale);
  return output.toDataURL('image/png');
 }finally{
  renderer.setRenderTarget(oldTarget);
  renderer.setViewport(oldViewport);
  renderer.setScissor(oldScissor);
  renderer.setScissorTest(oldScissorTest);
  renderer.setClearColor(oldColor,oldAlpha);
  target.dispose();
  const geometries=new Set(),materials=new Set();
  model.traverse(node=>{
   if(!node.isMesh)return;
   if(node.geometry)geometries.add(node.geometry);
   for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
 }
}
function renderStrategicPortrait(kind,renderer){
 const model=createStrategicBuilding(kind,0);
 if(!model)return strategicBuildingIcon(kind);
 tintFactionMaterials(model,0,kind,'building');
 return renderModelPortrait(model,renderer);
}
const researchArtworkCache=new Map();
export function researchArtwork(kind,renderer){
 if(!RESEARCH_ARTWORK_KINDS.includes(kind))return Promise.reject(new Error('Unknown research artwork '+kind));
 if(!researchArtworkCache.has(kind))
  researchArtworkCache.set(kind,new Promise((resolve,reject)=>{
   // Render each card after the current UI frame; avoids blocking the first
   // battlefield paint and keeps the same synchronous WebGL context.
   requestAnimationFrame(()=>{
    try{
     const model=createResearchArtwork(kind);
     if(!model||!renderer)throw new Error('Research renderer unavailable');
     resolve(renderModelPortrait(model,renderer,{width:256,height:256,research:true}));
    }catch(error){reject(error);}
   });
  }).catch(error=>{researchArtworkCache.delete(kind);throw error;}));
 return researchArtworkCache.get(kind);
}
/** Large authored miniature on the left; the original vector is always a
 * readable fallback if WebGL or canvas readback is unavailable.
 */
export function hydrateResearchArtworks(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-research-artwork]')){
  const kind=img.dataset.sfResearchArtwork;
  if(!kind||img.dataset.sfArtStatus)return;
  img.dataset.sfArtStatus='loading';
  researchArtwork(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfResearchArtwork===kind){
    img.src=url;
    img.dataset.sfArtStatus='ready';
   }
  }).catch(error=>{
   if(img.isConnected)img.dataset.sfArtStatus='error';
   console.warn('Research 3D icon fallback:',kind,error);
  });
 }
}

function loadImage(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Portrait sprite missing: '+src));
  img.src=src;
 });
}
async function rasterizeUnitIcon(kind){
 const source=unitAtlasUrl(kind);
 const response=await fetch(source+'.json');
 if(!response.ok)throw new Error('Portrait metadata missing '+source+' ('+response.status+')');
 const atlas=await response.json();
 const image=await loadImage(source+'.png');
 const directions=atlas.clips?.idle?.frames;
 if(!Array.isArray(directions)||!directions.length||!Array.isArray(atlas.frames))
  throw new Error('Invalid idle frames for '+kind);
 const frameIndex=directions[Math.min(1,directions.length-1)]?.[0];
 const frame=atlas.frames[frameIndex];
 if(!frame)throw new Error('Missing idle sprite frame '+frameIndex+' for '+kind);
 const tile=document.createElement('canvas');
 tile.width=frame.w;tile.height=frame.h;
 const tc=tile.getContext('2d',{willReadFrequently:true});
 tc.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
 // Multi-layered vehicle turrets are stored as independent frames.
 for(const part of ['turret','barrel']){
  const layerIndex=atlas.clips?.[part]?.frames?.[Math.min(1,directions.length-1)]?.[0];
  const layer=atlas.frames[layerIndex];
  if(!layer)continue;
  tc.drawImage(image,layer.x,layer.y,layer.w,layer.h,
   (frame.pivot?.[0]??frame.w/2)-(layer.pivot?.[0]??layer.w/2),
   (frame.pivot?.[1]??frame.h*.8)-(layer.pivot?.[1]??layer.h*.8),
   layer.w,layer.h);
 }
 const rgba=tc.getImageData(0,0,tile.width,tile.height).data;
 let left=tile.width,top=tile.height,right=-1,bottom=-1;
 for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
  if(rgba[(y*tile.width+x)*4+3]<90)continue;
  left=Math.min(left,x);right=Math.max(right,x);
  top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(right<left)throw new Error('Empty alpha frame for '+kind);
 const target=document.createElement('canvas');target.width=192;target.height=132;
 const ctx=target.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const w=right-left+1,h=bottom-top+1;
 // Keep all four ground soldiers at the same apparent standing height,
 // matching the original role illustrations regardless of atlas whitespace.
 const infantry=['infantry','medic','engineer','heavy'].includes(kind);
 const scale=Math.min((infantry?144:164)/w,(infantry?105:112)/h);
 const dw=w*scale,dh=h*scale;
 ctx.drawImage(tile,left,top,w,h,(192-dw)/2,infantry?119-dh:(132-dh)/2,dw,dh);
 return target.toDataURL('image/png');
}
/** Offline vector backup for the original 3D portrait (no asset fetch). */
function rocketUnitIconFallback(){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 190">'+
 '<rect width="192" height="190" fill="#28322d"/>'+
 '<path fill="#8d987c" d="M62 68h67v75H62z"/>'+
 '<path fill="#baa882" d="M60 145h28v32H60zm49 0h28v32h-28z"/>'+
 '<circle cx="96" cy="51" r="25" fill="#aca787"/>'+
 '<rect x="69" y="27" width="64" height="10" fill="#516757"/>'+
 '<rect x="102" y="60" width="17" height="81" rx="6" transform="rotate(-75 110 105)" fill="#39453f"/>'+
 '<path stroke="#dcbe83" stroke-width="5" d="m147 57 23 17-25 11"/>'+
 '</svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
export function unitIcon(kind,renderer){
 if(kind==='rocket'&&!renderer)return Promise.resolve(rocketUnitIconFallback());
 if(kind==='rocket'&&!iconCache.has(kind)){
  iconCache.set(kind,new Promise((resolve,reject)=>{
   requestAnimationFrame(()=>{
    try{resolve(renderModelPortrait(createRocketInfantry(0),renderer,{width:192,height:190}));}
    catch(error){reject(error);}
   });
  }).catch(error=>{iconCache.delete(kind);console.warn('Rocket 3D portrait fallback:',error);return rocketUnitIconFallback();}));
 }
 if(!iconCache.has(kind))iconCache.set(kind,rasterizeUnitIcon(kind).catch(error=>{
  iconCache.delete(kind);throw error;
 }));
 return iconCache.get(kind);
}
// Transparent padding in original building PNGs makes their thumbnails
// look tiny. Trim alpha bounds at low resolution and draw the whole building
// into a consistent wide tile without clipping its silhouette.
const buildingIconCache=new Map();
async function rasterizeBuildingIcon(kind,renderer){
 if(isStrategicBuilding(kind)){
  if(!renderer)return buildingIconUrl(kind);
  try{return renderStrategicPortrait(kind,renderer);}
  catch(error){console.warn('Strategic portrait fallback:',kind,error);return buildingIconUrl(kind);}
 }
 const image=await loadImage(buildingIconUrl(kind));
 let source=image;
 if(kind==='turret'){
  // The authored turret body PNG deliberately EXCLUDES its moving weapon
  // head. The classic 2D renderer draws that from a separate direction
  // atlas; compose the same two layers for the static WebGL build card.
  const response=await fetch('/src/assets/reborn/buildings-3d/turret-0.json');
  if(!response.ok)throw new Error('Turret weapon metadata missing');
  const data=await response.json();
  const layer=data.turret,body=data.body;
  const frame=layer?.frames?.[0];
  if(!frame||!layer?.pivot||!body?.pivot||!layer.image)
   throw new Error('Turret weapon layer missing');
  const turret=await loadImage('/src/assets/reborn/buildings-3d/'+layer.image);
  const composed=document.createElement('canvas');
  composed.width=image.naturalWidth;composed.height=image.naturalHeight;
  const cc=composed.getContext('2d');
  cc.drawImage(image,0,0);
  cc.drawImage(turret,frame.x,frame.y,frame.w,frame.h,
   body.pivot[0]-layer.pivot[0],body.pivot[1]-layer.pivot[1],
   frame.w,frame.h);
  source=composed;
 }
 const width=source.naturalWidth??source.width;
 const height=source.naturalHeight??source.height;
 const ratio=Math.min(1,384/Math.max(width,height));
 const probe=document.createElement('canvas');
 probe.width=Math.max(1,Math.round(width*ratio));
 probe.height=Math.max(1,Math.round(height*ratio));
 const pc=probe.getContext('2d',{willReadFrequently:true});
 pc.drawImage(source,0,0,probe.width,probe.height);
 const pixels=pc.getImageData(0,0,probe.width,probe.height).data;
 let left=probe.width,top=probe.height,right=-1,bottom=-1;
 for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++){
  if(pixels[(y*probe.width+x)*4+3]<36)continue;
  left=Math.min(left,x);top=Math.min(top,y);
  right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 if(right<left)throw new Error('Empty building portrait: '+kind);
 const sx=left/ratio,sy=top/ratio;
 const w=(right-left+1)/ratio,h=(bottom-top+1)/ratio;
 const target=document.createElement('canvas');
 target.width=320;target.height=220;
 const ctx=target.getContext('2d');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const scale=Math.min(306/w,208/h);
 const dw=w*scale,dh=h*scale;
 ctx.drawImage(source,sx,sy,w,h,(320-dw)/2,(220-dh)/2,dw,dh);
 return target.toDataURL('image/png');
}
export function buildingIcon(kind,renderer){
 if(!buildingIconCache.has(kind))
  buildingIconCache.set(kind,rasterizeBuildingIcon(kind,renderer).catch(error=>{
   buildingIconCache.delete(kind);throw error;
  }));
 return buildingIconCache.get(kind);
}
export function hydrateBuildingIcons(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-building-icon]')){
  const kind=img.dataset.sfBuildingIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  buildingIcon(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfBuildingIcon===kind){
    img.src=url;img.dataset.sfIconStatus='ready';
   }
  }).catch(error=>{
   if(img.isConnected)img.dataset.sfIconStatus='error';
   console.warn('Building portrait fallback:',kind,error);
  });
 }
}

export function hydrateUnitIcons(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-unit-icon]')){
  const kind=img.dataset.sfUnitIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  unitIcon(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfUnitIcon===kind){img.src=url;img.dataset.sfIconStatus='ready';}
  }).catch(error=>{
   if(img.isConnected){img.dataset.sfIconStatus='error';img.alt=kind;}
   console.warn('Unit portrait fallback:',kind,error);
  });
 }
}
