/** Sprite-sheet portrait extraction shared by the WebGL HUD.
 * The classic game crops one idle frame rather than scaling down the entire
 * 8/16-direction animation atlas (which looks like tiny dots). */
const iconCache=new Map();
const folders=kind=>['infantry','engineer','medic','heavy'].includes(kind)?'prototype':'animation';
export const unitAtlasUrl=kind=>'/src/assets/reborn/'+folders(kind)+'/'+kind+'-0';
export const buildingIconUrl=kind=>'/src/assets/reborn/buildings-3d/'+kind+'-0.png';

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
export function unitIcon(kind){
 if(!iconCache.has(kind))iconCache.set(kind,rasterizeUnitIcon(kind).catch(error=>{
  iconCache.delete(kind);throw error;
 }));
 return iconCache.get(kind);
}
// Transparent padding in original building PNGs makes their thumbnails
// look tiny. Trim alpha bounds at low resolution and draw the whole building
// into a consistent wide tile without clipping its silhouette.
const buildingIconCache=new Map();
async function rasterizeBuildingIcon(kind){
 const image=await loadImage(buildingIconUrl(kind));
 const ratio=Math.min(1,384/Math.max(image.naturalWidth,image.naturalHeight));
 const probe=document.createElement('canvas');
 probe.width=Math.max(1,Math.round(image.naturalWidth*ratio));
 probe.height=Math.max(1,Math.round(image.naturalHeight*ratio));
 const pc=probe.getContext('2d',{willReadFrequently:true});
 pc.drawImage(image,0,0,probe.width,probe.height);
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
 ctx.drawImage(image,sx,sy,w,h,(320-dw)/2,(220-dh)/2,dw,dh);
 return target.toDataURL('image/png');
}
export function buildingIcon(kind){
 if(!buildingIconCache.has(kind))
  buildingIconCache.set(kind,rasterizeBuildingIcon(kind).catch(error=>{
   buildingIconCache.delete(kind);throw error;
  }));
 return buildingIconCache.get(kind);
}
export function hydrateBuildingIcons(root){
 for(const img of root.querySelectorAll('img[data-sf-building-icon]')){
  const kind=img.dataset.sfBuildingIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  buildingIcon(kind).then(url=>{
   if(img.isConnected&&img.dataset.sfBuildingIcon===kind){
    img.src=url;img.dataset.sfIconStatus='ready';
   }
  }).catch(error=>{
   if(img.isConnected)img.dataset.sfIconStatus='error';
   console.warn('Building portrait fallback:',kind,error);
  });
 }
}

export function hydrateUnitIcons(root){
 for(const img of root.querySelectorAll('img[data-sf-unit-icon]')){
  const kind=img.dataset.sfUnitIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  unitIcon(kind).then(url=>{
   if(img.isConnected&&img.dataset.sfUnitIcon===kind){img.src=url;img.dataset.sfIconStatus='ready';}
  }).catch(error=>{
   if(img.isConnected){img.dataset.sfIconStatus='error';img.alt=kind;}
   console.warn('Unit portrait fallback:',kind,error);
  });
 }
}
