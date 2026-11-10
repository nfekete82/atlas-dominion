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
 // Sedimentary sandstone fragments are built as fractured ledges, not
 // deformed near-spheres. Shared across thousands of instanced stones.
 // Faceted caps and offset shelves break up the repeated "potato" outline.
 const segments=lowQuality?9:13;
 const rings=lowQuality?
  [[-.88,.54],[-.67,.90],[-.15,1.0],[.42,.75],[.78,.24]]:
  [[-.91,.55],[-.73,.88],[-.47,1.0],[-.19,.94],[.17,.99],
   [.43,.78],[.70,.56],[.84,.20]];
 const positions=[],uvs=[];
 const ringPoint=(index,i)=>{
  const a=i/segments*Math.PI*2;
  const [baseY,baseRadius]=rings[index];
  // Periodic angular warps add chipped corners and asymmetric stratum lips.
  const chip=1+.12*Math.sin(a*3+.3)+.065*Math.cos(a*7-1.4)+
   .045*Math.sin(a*11+index*.56);
  const radial=baseRadius*chip;
  const banding=.045*Math.sin(a*4+index*.9)+
   .023*Math.cos(a*9-index*.75);
  return [
   Math.cos(a)*radial+.045*Math.sin(index*2.31),
   baseY+banding,
   Math.sin(a)*radial*(.94+.05*Math.cos(a*2))+.04*Math.cos(index*1.61)
  ];
 };
 const vertex=point=>{
  positions.push(...point);
  // Roughly planar rock-space UVs: the shared mineral atlas supplies
  // micro-strata/normal relief without introducing per-rock textures.
  uvs.push(point[0]*.44+point[1]*.10+.5,point[2]*.39+point[1]*.28+.5);
 };
 const triangle=(a,b,c)=>{vertex(a);vertex(b);vertex(c);};
 for(let k=0;k<rings.length-1;k++)for(let j=0;j<segments;j++){
  const a=ringPoint(k,j),b=ringPoint(k,j+1);
  const c=ringPoint(k+1,j),d=ringPoint(k+1,j+1);
  triangle(a,c,b);triangle(b,c,d);
 }
 for(let i=0;i<segments;i++){
  triangle([.02,rings.at(-1)[0]+.025,-.02],
   ringPoint(rings.length-1,i),ringPoint(rings.length-1,i+1));
  triangle([0,rings[0][0]-.04,0],ringPoint(0,i+1),ringPoint(0,i));
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 geometry.userData={sedimentaryLedges:true,segments,strata:rings.length};
 return geometry;
}
