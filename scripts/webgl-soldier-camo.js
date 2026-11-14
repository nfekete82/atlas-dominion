import * as THREE from 'three';

/** The old Atlas GLB reuses an atlas-like UV arrangement for 200+ separate
 * armour pieces. Applying a whole desert 002 tile to that UV layout makes a
 * shoulder/helmet sample one cream pixel, producing apparently white plates.
 *
 * Soldier-only local object-space projection gives every panel several
 * readable camouflage patches. Geometry attributes (including skinning,
 * morph targets and indices) stay shared; just a tiny new UV buffer is added.
 * The original GLB and its animation rig are never modified. */
export const SOLDIER_CAMO_UV_REVISION='desert-002-projected-uniform-v2';
const projected=new WeakMap();

export function soldierUniformUVs(original){
 if(!original?.getAttribute?.('position'))return original;
 if(original.userData?.sandforgeSoldierCamoUV===SOLDIER_CAMO_UV_REVISION)return original;
 const cached=projected.get(original);
 if(cached)return cached;
 const pos=original.getAttribute('position');
 const box=new THREE.Box3().setFromBufferAttribute(pos);
 const span=box.getSize(new THREE.Vector3());
 // The original rig is in metres but per-panel GLB mesh local scales vary.
 // Normalize small disconnected armour components to avoid sampling a single
 // pale region of the texture. Bigger contiguous cloth panels retain scale.
 const sx=1/Math.max(.36,span.x),sy=1/Math.max(.52,span.y),
  sz=1/Math.max(.36,span.z);
 const data=new Float32Array(pos.count*2);
 for(let i=0;i<pos.count;i++){
  const x=(pos.getX(i)-box.min.x)*sx;
  const y=(pos.getY(i)-box.min.y)*sy;
  const z=(pos.getZ(i)-box.min.z)*sz;
  data[2*i]=x*.76+z*.45;
  data[2*i+1]=y*.86-z*.22;
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,attribute] of Object.entries(original.attributes))
  if(name!=='uv')geometry.setAttribute(name,attribute);
 geometry.setAttribute('uv',new THREE.BufferAttribute(data,2));
 geometry.setIndex(original.index);
 geometry.groups=original.groups.map(g=>({...g}));
 geometry.drawRange={...original.drawRange};
 geometry.boundingBox=original.boundingBox?.clone()??null;
 geometry.boundingSphere=original.boundingSphere?.clone()??null;
 geometry.morphAttributes=original.morphAttributes;
 geometry.morphTargetsRelative=original.morphTargetsRelative;
 geometry.userData={...original.userData,
  sandforgeSoldierCamoUV:SOLDIER_CAMO_UV_REVISION};
 projected.set(original,geometry);
 return geometry;
}

export function applyUniformProjection(mesh){
 if(!mesh?.isMesh)return false;
 // A multi-material mesh may also have glass/metal with authored texture UVs.
 // Do not override those UVs across protected sub-materials.
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 if(!materials.length||!materials.every(material=>
  material?.userData?.sandforgeMasterCamo==='desert-002'))return false;
 mesh.geometry=soldierUniformUVs(mesh.geometry);
 return true;
}
