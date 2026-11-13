import * as THREE from 'three';

/** Team identifiers are painted into real PBR meshes for vehicles, while
 * infantry use their tinted armour. No floating quad markers or black
 * rectangular team patches are placed around articulated soldiers.
 */
export const TEAM_MARKING_COLORS=Object.freeze({0:'#28769b',1:'#a84f42'});
export const VEHICLE_PAINT_REVISION='sandforge-matte-unit-paint-v2';
const infantry=new Set(['infantry','heavy','medic','engineer','rocket']);
const vehicles=new Set(['tank','artillery','rover','bomber','scout']);
const reject=/flag|pennant|banner|cross|insignia|decal|marking|wheel|track|tread|tyre|tire|rotor|blade|propeller|spinner|fan|glass|window|canopy|windshield|exhaust|gun|barrel|muzzle|antenna|lamp|light|shadow|invisible/i;
const favor={
 tank:/turret|armor|armour|hull|body|ceramic|roof|paint|shell/i,
 artillery:/turret|armor|armour|hull|body|ceramic|roof|paint|shell/i,
 rover:/cabin|cab|body|roof|hull|armor|armour|panel/i,
 bomber:/wing|fuselage|body|hull|airframe/i,
 scout:/fuselage|cabin|body|hull|side|roof|armor|armour/i
};
/** Pick a broad exterior mesh with a real local bounding box. This avoids
 * painting blades, glass, flags and tiny mechanical parts. Only O(n) on load.
 */
export function selectVehiclePaintMeshes(model,kind,limit=2){
 if(!model||!vehicles.has(kind))return [];
 model.updateMatrixWorld(true);
 const all=new THREE.Box3().setFromObject(model);
 if(all.isEmpty())return [];
 const size=all.getSize(new THREE.Vector3()),maxArea=Math.max(.01,size.x*size.z);
 const result=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
  const names=[];
  for(let n=mesh;n&&n!==model;n=n.parent)names.push(n.name||'');
  const name=names.join(' ');
  if(reject.test(name))return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(m=>m?.isMeshStandardMaterial&&!m.transparent))return;
  const bb=new THREE.Box3().setFromObject(mesh),span=bb.getSize(new THREE.Vector3());
  const footprint=span.x*span.z/maxArea;
  if(footprint<.008)return;
  const label=(name+' '+materials.map(m=>m?.name??'').join(' '));
  const matches=favor[kind].test(label);
  // Favor the actual body, a tank turret, or a bomber wing over small trim.
  const priority=(matches?4:1)*Math.sqrt(footprint);
  result.push({mesh,score:priority});
 });
 result.sort((a,b)=>b.score-a.score);
 return result.slice(0,limit).map(x=>x.mesh);
}
function paintMaterial(source,owner,kind,geometry){
 if(!source?.isMeshStandardMaterial||source.transparent)return source;
 const original=source.userData?.sandforgeVehiclePaintRevision===VEHICLE_PAINT_REVISION
  ?source:source.clone();
 if(original===source&&original.userData.sandforgeVehiclePaintOwner===owner)return original;
 if(original===source){
  original.userData.sandforgeVehiclePaintOwner=owner;
  original.needsUpdate=true;
  return original;
 }
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 if(!box)return source;
 const min=box.min,max=box.max;
 const rng=new THREE.Vector3().subVectors(max,min);
 if(rng.x<.00001||rng.y<.00001||rng.z<.00001)return source;
 const up=kind==='bomber'||kind==='scout'?.20:.38;
 const oldCompile=original.onBeforeCompile;
 const oldKey=original.customProgramCacheKey.bind(original);
 original.userData={...original.userData,
  sandforgeVehiclePaintRevision:VEHICLE_PAINT_REVISION,
  sandforgeVehiclePaintOwner:owner,vehiclePaintKind:kind};
 const glsl=(n)=>Number(n).toFixed(6);
 original.onBeforeCompile=function(shader,renderer){
  // Faction can change while a vehicle survives; recompile from current owner.
  const c=new THREE.Color(TEAM_MARKING_COLORS[this.userData.sandforgeVehiclePaintOwner]);
  oldCompile?.call(this,shader,renderer);
  const decl='varying vec3 sfMarkPos; varying vec3 sfMarkNormal;';
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\n'+decl);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfMarkPos=position; sfMarkNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\n'+decl);
  const rgb=[c.r,c.g,c.b].map(glsl).join(',');
  // Two slim, weathered blue/red bands on visible armour or wing top. The
  // surface normal and vertex position are the ORIGINAL GLB geometry: paint
  // cannot extend beyond the silhouette, even on curved helicopter cabins.
  const code=`
vec3 sfUv=clamp((sfMarkPos-vec3(${glsl(min.x)},${glsl(min.y)},${glsl(min.z)}))/
 vec3(${glsl(rng.x)},${glsl(rng.y)},${glsl(rng.z)}),0.0,1.0);
float sfUp=smoothstep(${glsl(up)},0.76,normalize(sfMarkNormal).y);
float sfBand1=smoothstep(.24,.29,sfUv.x)*(1.0-smoothstep(.36,.41,sfUv.x));
float sfBand2=smoothstep(.59,.64,sfUv.x)*(1.0-smoothstep(.71,.76,sfUv.x));
float sfFront=smoothstep(.13,.22,sfUv.z)*(1.0-smoothstep(.78,.87,sfUv.z));
float sfWear=.81+.14*sin(dot(sfMarkPos.xz,vec2(19.1,33.7)));
float sfPaint=clamp((sfBand1+sfBand2)*sfFront*sfUp*sfWear,0.0,.76);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${rgb}),sfPaint);
`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   '#include <color_fragment>\n'+code);
 };
 original.customProgramCacheKey=()=>oldKey()+':'+VEHICLE_PAINT_REVISION+
  ':'+kind+':'+owner+':'+[min.x,min.y,min.z,...rng].map(glsl).join(',');
 original.needsUpdate=true;
 return original;
}
/** Intentionally returns a detached zero-mesh group for vehicles. */
export function attachTeamMarkings(entry,owner,kind,footprint=90,height=44){
 if(!entry?.node||(owner!==0&&owner!==1)||(!vehicles.has(kind)&&!infantry.has(kind)))
  return null;
 const model=entry.detail??entry.placeholder;
 const signature=[owner,kind,entry.detail?'authored':'placeholder'].join(':');
 if(entry.teamMarkings?.userData.signature===signature)return entry.teamMarkings;
 detachTeamMarkings(entry);
 const group=new THREE.Group();
 group.name='SandforgeIntegratedFactionPaint';
 group.userData={signature,owner,kind,visualOnly:true,nonPlayable:true,teamMarkings:true};
 if(infantry.has(kind)){
  // The authored 3D soldier already gets faction ownership through its
  // actual armour via applyFactionAccents(). Freestanding, double-sided
  // armband/chest quads looked like black rectangular boards next to small
  // animated soldiers (and floated away from their moving shoulders).
  // Keep the zero-geometry marker for the cache/signature lifecycle.
  group.userData.paintedMeshCount=0;
  entry.node.add(group);
 }else if(model){
  // Old authored stand-up flag props must also disappear. The unit's color
  // now lives exclusively in the original surface materials.
  model.traverse(part=>{
   if(part!==model&&/flagpole|factionflag|roofflag|teamflag|pennant|banner/i.test(part.name??''))
    part.visible=false;
  });
  const picked=selectVehiclePaintMeshes(model,kind);
  for(const mesh of picked){
   if(Array.isArray(mesh.material))
    mesh.material=mesh.material.map(m=>paintMaterial(m,owner,kind,mesh.geometry));
   else mesh.material=paintMaterial(mesh.material,owner,kind,mesh.geometry);
  }
  group.userData.paintedMeshCount=picked.length;
 }
 entry.teamMarkings=group;
 return group;
}
export function detachTeamMarkings(entry){
 if(!entry?.teamMarkings)return;
 entry.teamMarkings.removeFromParent();entry.teamMarkings.clear();
 entry.teamMarkings=null;
}
