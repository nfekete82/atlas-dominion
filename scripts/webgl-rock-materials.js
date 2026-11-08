import * as THREE from 'three';

/** Shared, procedurally baked PBR stone atlas. It exists once per quality
 * level, NOT per stone or render frame. A dozen materials and thousands of
 * InstancedMesh stones reuse the same albedo/normal/roughness GPU textures.
 * Local, deterministic, no fetches and no changes to physics/collisions. */
const cache=new Map();
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const hash=(x,y,seed)=>{
 let n=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+seed)|0;
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
};
function tileNoise(u,v,freq,seed){
 const x=u*freq,y=v*freq,ix=Math.floor(x),iy=Math.floor(y);
 const tx=smooth(x-ix),ty=smooth(y-iy);
 const x0=((ix%freq)+freq)%freq,x1=(x0+1)%freq;
 const y0=((iy%freq)+freq)%freq,y1=(y0+1)%freq;
 return mix(
  mix(hash(x0,y0,seed),hash(x1,y0,seed),tx),
  mix(hash(x0,y1,seed),hash(x1,y1,seed),tx),ty
 );
}
function dataTexture(data,size,srgb=false){
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.magFilter=THREE.LinearFilter;
 t.generateMipmaps=true;
 t.anisotropy=8;
 if(srgb)t.colorSpace=THREE.SRGBColorSpace;
 t.needsUpdate=true;
 return t;
}
export function sharedStoneMaps(lowQuality=false){
 const key=lowQuality?'lite':'standard';
 if(cache.has(key))return cache.get(key);
 const size=lowQuality?128:512,count=size*size;
 const height=new Float32Array(count);
 const color=new Uint8Array(count*4);
 const roughness=new Uint8Array(count*4);
 const normal=new Uint8Array(count*4);
 // Four scales: weathered sandstone strata, mica/quartz flecks,
 // fracture veins, and the finest pitted grain. All frequencies tile.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;
  const broad=tileNoise(u,v,4,0x52de001);
  const middle=tileNoise(u,v,16,0x7158ac3);
  const grain=tileNoise(u,v,64,0x10ca8be);
  const fine=tileNoise(u,v,128,0x4aedb09);
  const strata=Math.sin(v*Math.PI*2*8+broad*3.4+middle*1.7);
  const layered=Math.pow(Math.abs(strata),8);
  const fissure=clamp((.23-Math.abs(middle-.51))*4.3);
  const quartz=Math.pow(clamp((fine-.78)*5.7),3);
  const sediment=.47*broad+.31*middle+.17*grain+.05*fine;
  height[y*size+x]=.49*sediment+.13*layered-.12*fissure+.08*quartz;
  const shade=clamp(.79+.26*sediment-.14*layered-.14*fissure+.09*quartz,.47,1);
  const p=(y*size+x)*4;
  // Almost neutral stone pigment: its main hue remains the material tint.
  // Avoid the old evenly saturated orange and the dark black pebble look.
  color[p]=Math.round(clamp(245*shade+5,0,255));
  color[p+1]=Math.round(clamp(238*shade+4,0,255));
  color[p+2]=Math.round(clamp(223*shade+1,0,255));
  color[p+3]=255;
  const r=Math.round(214+27*(1-grain)+11*fissure);
  roughness[p]=roughness[p+1]=roughness[p+2]=r;
  roughness[p+3]=255;
 }
 // Normal texture from the same actual baked bump field; no per-fragment
 // noise loops or separate shader draw passes.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const left=height[y*size+(x+size-1)%size];
  const right=height[y*size+(x+1)%size];
  const up=height[((y+size-1)%size)*size+x];
  const down=height[((y+1)%size)*size+x];
  const nx=(left-right)*2.15,ny=(up-down)*2.15;
  const len=Math.hypot(nx,ny,1);
  const p=(y*size+x)*4;
  normal[p]=Math.round((nx/len*.5+.5)*255);
  normal[p+1]=Math.round((ny/len*.5+.5)*255);
  normal[p+2]=Math.round((1/len*.5+.5)*255);
  normal[p+3]=255;
 }
 const maps=Object.freeze({
  map:dataTexture(color,size,true),
  normalMap:dataTexture(normal,size),
  roughnessMap:dataTexture(roughness,size),
  resolution:size
 });
 cache.set(key,maps);
 return maps;
}
export function stoneMaterial(color='#c9ad8d',options={}){
 const {lowQuality=false,roughness=.96,normalScale=.58,flatShading=true}=options;
 const maps=sharedStoneMaps(lowQuality);
 return new THREE.MeshStandardMaterial({
  color,map:maps.map,normalMap:maps.normalMap,
  roughnessMap:maps.roughnessMap,
  normalScale:new THREE.Vector2(normalScale,normalScale),
  roughness,metalness:0,flatShading
 });
}
/** One authored asymmetric rock mesh reused by every stone instance.
 * Higher-detail geometry is selected once; thousands of stones still
 * require exactly one instanced draw call per palette group. */
export function weatheredStoneGeometry(lowQuality=false){
 const geometry=new THREE.DodecahedronGeometry(1,lowQuality?0:1);
 const p=geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const fracture=.13*Math.sin(x*12.7+y*3.9+z*7.8)+
   .075*Math.cos(x*23.2-y*11.4+z*9.1);
  const r=1+fracture;
  p.setXYZ(i,x*r,y*r*(y<-.05?.79:.91),z*r*(1-.07*Math.sin(y*7.2)));
 }
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
}
