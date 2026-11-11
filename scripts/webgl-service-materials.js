import * as THREE from 'three';
/** Deterministic real albedo textures; no DOM/canvas/network in Node or WebGL. */
export function servicePaint(palette,{seed=1,pattern='camo',repeat=3,metalness=.18,roughness=.85}={}){
 const swatches=palette.map(hex=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255]});
 const side=96,data=new Uint8Array(side*side*4);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const wave=Math.sin((x+Math.sin(y*.11+seed)*12)*.084)+Math.cos(y*.087+Math.sin(x*.06));
  const idx=pattern==='camo'?(wave>.55?2:wave<-.42?0:1):
   pattern==='metal'?(Math.sin(x*.24+y*.07)>0?1:0):(wave>.55?2:wave<-.55?0:1);
  const noise=((((x*73+y*127+seed*37)^(x*y*11))>>>0)%29-14)/180;
  const seam=pattern==='metal'&&(x%24<2||y%24<2)?-.2:0;
  const grime=pattern==='concrete'&&y%31>27?-.1:0;
  const wear=(x*7+y*3+seed)%79===0?.17:0;
  const scale=1+noise+seam+grime+wear,k=(y*side+x)*4;
  for(let i=0;i<3;i++)data[k+i]=Math.max(0,Math.min(255,Math.round(swatches[Math.min(idx,swatches.length-1)][i]*scale)));
  data[k+3]=255;
 }
 const map=new THREE.DataTexture(data,side,side,THREE.RGBAFormat);
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeat,repeat);
 map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 const mat=new THREE.MeshStandardMaterial({color:'#ffffff',map,metalness,roughness,side:THREE.DoubleSide});
 mat.userData.sandforgeServiceTexture=map;return mat;
}
/** A Three.js material.clone() JSON-serializes userData. Storing a live
 * DataTexture there therefore creates a PLAIN OBJECT in the clone, not a
 * disposable GPU texture. That previously crashed clearPlacement() with
 * "map.dispose is not a function" after selecting a factory/airfield ghost,
 * leaving every later building card unable to start placement.
 * Ghosts share their source material.map ONLY until their original owned
 * textures are explicitly disposed, never copy the ownership metadata. */
export function previewServiceMaterial(source,{opacity=.5,color='#a7e4cc'}={}){
 const clone=source.clone();
 clone.color?.lerp(new THREE.Color(color),.14);
 clone.transparent=true;clone.opacity=Math.min(source.opacity??1,opacity);
 clone.depthWrite=false;clone.depthTest=true;
 // Intentionally DO NOT copy source.userData.sandforgeServiceTexture.
 clone.userData={sandforgePreviewMaterial:true,
  sandforgePreviewValidColor:clone.color?.clone(),
  sandforgePreviewInvalidColor:clone.color?.clone().lerp(new THREE.Color('#f1786d'),.66)};
 return clone;
}
export function disposeServicePaint(root){
 const maps=new Set();
 root?.traverse?.(mesh=>{if(!mesh.isMesh)return;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   const texture=m?.userData?.sandforgeServiceTexture;
   // Also tolerate older/cloned preview materials from existing game state.
   if(texture?.isTexture&&typeof texture.dispose==='function')maps.add(texture);
  }
 });
 for(const map of maps)map.dispose();
 return maps.size;
}
