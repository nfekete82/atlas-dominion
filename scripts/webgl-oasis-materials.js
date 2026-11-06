import * as THREE from 'three';
/** PBR layers applied directly to existing sand triangles. No overlay seams. */
export function blendOasisTerrain(material,oases,half){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
 const capacity=Math.max(4,oases.length);
 const centers=Array.from({length:capacity},(_,i)=>{
  const o=oases[i];return new THREE.Vector4(o?o.x-half:1e8,o?o.y-half:1e8,o?.radius??1,o?.phase??0);
 });
 material.onBeforeCompile=shader=>{
  previous.call(material,shader);
  shader.uniforms.oasisCenters={value:centers};
  shader.uniforms.oasisShapes={value:Array.from({length:capacity},(_,i)=>{
   const o=oases[i];return new THREE.Vector3(o?.aspect??1,o?.rotation??0,o?.type==='dry'?0:o?.type==='semi'?.55:1);
  })};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vOasisXZ;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvOasisXZ=position.xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vOasisXZ;uniform vec4 oasisCenters[${capacity}];uniform vec3 oasisShapes[${capacity}];
   float oasisWet=0.;float oasisSoil=0.;
   float sediment(vec2 p){return sin(p.x*.16+sin(p.y*.09))*sin(p.y*.19-p.x*.05);}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   for(int i=0;i<${capacity};i++){
    vec4 o=oasisCenters[i];vec3 shape=oasisShapes[i];vec2 d=vOasisXZ-o.xy;
    float c=cos(shape.y),s=sin(shape.y);vec2 q=vec2(d.x*c+d.y*s,(-d.x*s+d.y*c)/shape.x);
    float a=atan(q.y,q.x);
    float edge=1.+.13*sin(a*3.+o.w)+.085*sin(a*5.-o.w*1.7)+.045*cos(a*9.+o.w);
    float dist=length(q)/o.z/edge+sediment(vOasisXZ)*.022;
    float soil=(1.-smoothstep(.64,1.18,dist))*.55;
    float wet=(1.-smoothstep(.27,.70,dist))*shape.z;
    oasisSoil=max(oasisSoil,soil);oasisWet=max(oasisWet,wet);
   }
   float grain=sediment(vOasisXZ);
   diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb*vec3(.67,.64,.54),vec3(.29,.235,.15),.34),oasisSoil);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.63,.69,.65),oasisWet*.64);
   diffuseColor.rgb*=1.+grain*oasisSoil*.055;
   // Fine branching sediment fractures fade out with the dry soil mask.
   float cracks=pow(1.-abs(sin(vOasisXZ.x*.32+sin(vOasisXZ.y*.21)*2.)),18.);
   diffuseColor.rgb*=1.-cracks*oasisSoil*(1.-oasisWet)*.11;`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.49,oasisWet*.6);');
 };
 material.customProgramCacheKey=()=>capacity===4?'sandforge-oasis-soil-v1':'sandforge-oasis-soil-v1-'+capacity;material.needsUpdate=true;
 const restore=()=>{material.onBeforeCompile=previous;material.customProgramCacheKey=previousKey;material.needsUpdate=true;};
 restore.setHidden=ids=>centers.forEach((v,i)=>{v.x=ids.has(i)?1e8:(oases[i]?.x??1e8)-half;});
 return restore;
}
export function waterMaterial(o,half){
 const time={value:0};
 const material=new THREE.MeshStandardMaterial({color:'#687f6b',roughness:.35,metalness:.08,
  transparent:true,opacity:.67,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 material.onBeforeCompile=shader=>{
  shader.uniforms.oasisTime=time;
  shader.uniforms.poolShape={value:new THREE.Vector4(o.x-half,o.y-half,o.radius*(o.type==='semi'?.30:.46),o.phase)};
  shader.uniforms.poolAspect={value:new THREE.Vector2(o.aspect,o.rotation)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPool;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvPool=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPool;uniform float oasisTime;uniform vec4 poolShape;uniform vec2 poolAspect;')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 wave=vec2(sin(vPool.x*.13+vPool.z*.09+oasisTime*.65),cos(vPool.z*.17-vPool.x*.07+oasisTime*.48));
    normal=normalize(normal+vec3(wave.x,wave.y,0.)*.055);`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec2 d=vPool.xz-poolShape.xy;float c=cos(poolAspect.y),s=sin(poolAspect.y);
    vec2 q=vec2(d.x*c+d.y*s,(-d.x*s+d.y*c)/poolAspect.x);float a=atan(q.y,q.x);
    float contour=1.+.13*sin(a*3.+poolShape.w)+.085*sin(a*5.-poolShape.w*1.7)+.045*cos(a*9.+poolShape.w);
    float edge=1.-length(q)/(poolShape.z*contour);if(edge<=0.)discard;
    diffuseColor.rgb=vec3(.14,.265,.235);
    diffuseColor.rgb=mix(vec3(.30,.27,.17),diffuseColor.rgb,edge);
    diffuseColor.a*=smoothstep(0.,.30,edge);`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.32+.065*sin(vPool.x*.15+vPool.z*.11+oasisTime*.5);')
   .replace('#include <opaque_fragment>',`float fresnel=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),4.);
    outgoingLight+=vec3(.12,.15,.14)*fresnel;
    #include <opaque_fragment>`);
 };
 material.userData.time=time;return material;
}
