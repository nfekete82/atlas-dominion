/** Presentation-only original reference pack. IDs, stats and collision stay in Simulation. */
import * as THREE from 'three';
export const STYLIZED_KINDS=Object.freeze(['rover','infantry','barracks']);
export const stylizedAsset=(kind,owner)=>STYLIZED_KINDS.includes(kind)
 ?'/src/assets/stylized/'+kind+'-'+owner+'.glb':null;
export const isStylizedAsset=url=>url?.startsWith('/src/assets/stylized/');
export function stylizedProfile(root){
 if(!root)return null;
 if(root.userData?.sandforgeStylized)return root.userData;
 return root.children?.find(child=>child.userData?.sandforgeStylized)?.userData??null;
}
export function tintStylizedTeam(root,owner){
 const profile=stylizedProfile(root);if(!profile)return false;
 if((root.userData.stylizedPaintOwner??profile.owner)===owner)return true;
 const owned=new Map(),blue=new THREE.Color('#278ac7'),red=new THREE.Color('#c94c38');
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.material?.vertexColors)return;
  const original=mesh.material;let mat=original;
  if(!original.userData.stylizedTeamPaint){
   if(owned.has(original)){mesh.material=owned.get(original);return;}
   mat=original.clone();owned.set(original,mat);
   mat.userData={...original.userData,stylizedTeamPaint:true,sandforgeFactionTint:true};
   mat.onBeforeCompile=function(shader){
    shader.uniforms.sfTeamColor={value:new THREE.Color(this.userData.stylizedPaintOwner===0?'#278ac7':'#c94c38')};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 sfTeamColor;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     float sfTeamMask=1.0-step(.002,min(distance(diffuseColor.rgb,vec3(${blue.toArray().join(',')})),distance(diffuseColor.rgb,vec3(${red.toArray().join(',')}))));
     diffuseColor.rgb=mix(diffuseColor.rgb,sfTeamColor,sfTeamMask);`);
   };
   mat.customProgramCacheKey=function(){return 'SFV1-team-'+this.userData.stylizedPaintOwner;};
  }
  mat.userData.stylizedPaintOwner=owner;mat.needsUpdate=true;mesh.material=mat;
 });
 root.userData.stylizedPaintOwner=owner;return true;
}
