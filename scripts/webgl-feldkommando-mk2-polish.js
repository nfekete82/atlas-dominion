import * as THREE from 'three';

/**
 * Sandforge Feldkommando MK2 presentation: no edits to its source GLB,
 * cached GLTFLoader assets, gameplay collisions, save state or vegetation.
 * The local XYZ coordinates below are measured in the author's Z-up stage;
 * SF_Y_UP_ROOT transforms them to Three.js Y-up.
 */
const FENCE_PARTS=['YardFencePosts','YardFenceRails','YardFenceMesh'];
const OWNED='sfMk2PolishOwned';
export const MK2_FENCE_OUTSET=1.35; // Authored metres, never scene/game scale

export function isFeldkommandoMk2(model){
 return Boolean(model?.getObjectByName?.('Door_Left_Pivot')&&
  model.getObjectByName('Door_Right_Pivot')&&
  model.getObjectByName('Fence_Gate_Left_Pivot')&&
  model.getObjectByName('Fence_Gate_Right_Pivot'));
}

export function hideMk2DuplicateFence(yard){
 if(!yard)return 0;
 let count=0;
 for(const name of FENCE_PARTS){
  const part=yard.getObjectByName(name);
  if(part&&part.visible){part.visible=false;count++;}
 }
 return count;
}

function roofSteel(model){
 const template=model.getObjectByName('STAGE_02_Roof_and_Entrances__steel')?.material ??
  model.getObjectByName('STAGE_03_Radar_Utilities_and_Details__steel')?.material;
 if(!template)return 0;
 // Preserve the original PBR metal structure, just tint it anthracite.
 const metal=template.clone();
 metal.name='SF_MK2_Anthracite_BrushedSteel';
 metal.color.set('#43474d');
 metal.metalness=.68;metal.roughness=.66;metal.envMapIntensity=.72;
 metal.userData={...metal.userData,[OWNED]:true};
 let surfaces=0;
 const candidates=[];
 model.traverse(mesh=>{if(mesh.isMesh&&/^STAGE_0[123]_.*__(roof|camo|camo_light)$/.test(mesh.name))candidates.push(mesh);});
 for(const mesh of candidates){
  // The *entire* upper communications-tower roof is a camouflage mesh,
  // not a roof mesh. Its Z bounds are 4.40–4.88 m (no wall surfaces).
  // Assign the real metal PBR material directly, without brittle face tests.
  if(/__roof$/.test(mesh.name)||mesh.name==='STAGE_02_Roof_and_Entrances__camo'){
   mesh.material=metal;surfaces++;continue;
  }
  // Only reassign upward-facing rooftop triangles. Grouping every face
  // into a draw call would be disastrous for an RTS; split into two
  // indexed geometries with one draw each instead.
  const original=mesh.geometry,normal=original?.getAttribute('normal'),
   positions=original?.getAttribute('position');
  if(!normal||!positions)continue;
  const ix=original.index?.array??Array.from({length:positions.count},(_,i)=>i);
  const roof=[],walls=[];
  for(let i=0;i<ix.length;i+=3){
   const a=ix[i],b=ix[i+1],c=ix[i+2];
   const up=(normal.getZ(a)+normal.getZ(b)+normal.getZ(c))/3;
   const z=(positions.getZ(a)+positions.getZ(b)+positions.getZ(c))/3;
   // The MK2's light-tan upper and sloped roofs also live in __camo_light.
   // Their face normals have a positive authoring Z component; steep ramps
   // were excluded by the old .45 threshold and 2.85-metre cutoff.
   (up>.18&&z>2.35?roof:walls).push(a,b,c);
  }
  if(!roof.length)continue;
  const top=original.clone();top.clearGroups();top.setIndex(roof);
  top.userData={...top.userData,[OWNED]:true};
  const roofMesh=new THREE.Mesh(top,metal);
  roofMesh.name='SF_MK2_AnthraciteRoof';
  roofMesh.position.copy(mesh.position);roofMesh.quaternion.copy(mesh.quaternion);
  roofMesh.scale.copy(mesh.scale);
  roofMesh.castShadow=true;roofMesh.receiveShadow=true;
  roofMesh.raycast=()=>{};
  mesh.parent.add(roofMesh);
  if(walls.length){
   const base=original.clone();base.clearGroups();base.setIndex(walls);
   base.userData={...base.userData,[OWNED]:true};
   mesh.geometry=base;
  }else mesh.visible=false;
  surfaces++;
 }
 if(!surfaces)metal.dispose();
 return surfaces;
}

function widenMk2Perimeter(model){
 if(model.userData.sfMk2PerimeterExpanded)return 0;
 let moved=0;
 // The real outer perimeter is baked into the STAGE_03 steel + concrete
 // meshes. Only its low, outlying vertices are translated; the antenna,
 // radar, pipes, doors and building walls retain their exact positions.
 for(const name of [
  'STAGE_03_Radar_Utilities_and_Details__steel',
  'STAGE_03_Radar_Utilities_and_Details__sandstone'
 ]){
  const mesh=model.getObjectByName(name);
  const source=mesh?.geometry;
  if(!source?.getAttribute('position'))continue;
  const geometry=source.clone(),position=geometry.getAttribute('position');
  let count=0;
  for(let i=0;i<position.count;i++){
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
   if(z>2.52)continue;
   let nx=x,ny=y;
   if(Math.abs(x)>7.0)nx+=Math.sign(x)*MK2_FENCE_OUTSET;
   if(y< -6.7)ny-=MK2_FENCE_OUTSET;
   if(y>5.35)ny+=MK2_FENCE_OUTSET;
   if(nx===x&&ny===y)continue;
   position.setXY(i,nx,ny);count++;
  }
  if(!count){geometry.dispose();continue;}
  position.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...geometry.userData,[OWNED]:true};
  mesh.geometry=geometry;moved+=count;
 }
 // The two real sliding gate leaves have their own authored pivots,
 // so they follow the fence without affecting the sliding HQ doors.
 for(const name of ['Fence_Gate_Left_Pivot','Fence_Gate_Right_Pivot']){
  const pivot=model.getObjectByName(name);
  if(pivot)pivot.position.y-=MK2_FENCE_OUTSET;
 }
 model.userData.sfMk2PerimeterExpanded=true;
 return moved;
}

function matchMk2DesertCamouflage(model){
 // Keep the user's authored high-resolution texture and the olive/tan
 // patches. A restrained PBR coating removes the previous washed-out look.
 for(const name of [
  'STAGE_01_Bunker_Shell__camo',
  'STAGE_01_Bunker_Shell__camo_light'
 ]){
  const mesh=model.getObjectByName(name),base=mesh?.material;
  if(!base?.isMeshStandardMaterial)continue;
  const material=base.clone();
  material.name='SF_MK2_Reference_DesertCamouflage';
  material.color.set(name.endsWith('__camo_light')?'#e5dfce':'#e0dccd');
  material.roughness=.91;material.metalness=.045;
  material.userData={...material.userData,[OWNED]:true};
  mesh.material=material;
 }
}

function addMk2Interior(model){
 if(model.getObjectByName('SF_MK2_Interior'))return false;
 const left=model.getObjectByName('Door_Left_Pivot');
 const right=model.getObjectByName('Door_Right_Pivot');
 const stage=left?.parent;
 if(!left||!right||!stage||stage!==right.parent)return false;
 const doorY=(left.position.y+right.position.y)*.5;
 const doorZ=(left.position.z+right.position.z)*.5;
 const width=Math.max(2.55,Math.abs(right.position.x-left.position.x)+.35);
 const height=3.08,depth=3.35,centerY=doorY+depth*.5+.12;
 const group=new THREE.Group();group.name='SF_MK2_Interior';
 // Place interior in the same original Z-up authoring stage as the doors.
 const wall=new THREE.MeshStandardMaterial({name:'SF_MK2_InteriorWall',
  color:'#171b1c',metalness:.12,roughness:.93,side:THREE.DoubleSide});
 const floor=new THREE.MeshStandardMaterial({name:'SF_MK2_InteriorFloor',
  color:'#323435',metalness:.24,roughness:.84});
 const strip=new THREE.MeshStandardMaterial({name:'SF_MK2_InteriorLamp',
  color:'#d6b67e',emissive:'#9a6d33',emissiveIntensity:.63,
  metalness:.35,roughness:.38});
 const add=(name,shape,at,mat)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...shape),mat);
  mesh.name=name;mesh.position.set(...at);
  mesh.receiveShadow=true;mesh.castShadow=false;mesh.raycast=()=>{};
  group.add(mesh);return mesh;
 };
 // Dark portal backdrop stands just behind the closed shutter, in front
 // of the older baked wall. A soldier already visible on the front side
 // will emerge naturally, without the wall shining through the doorway.
 // Place the recess before the model's original opaque interior panel,
 // but behind the moving shutter, so opening never reveals the old wall.
 add('SF_MK2_Recess',[width,.055,height],[0,doorY+.022,doorZ],wall);
 add('SF_MK2_HallFloor',[width,depth,.065],[0,centerY,.22],floor);
 add('SF_MK2_HallCeiling',[width,depth,.09],[0,centerY,doorZ+height*.52],wall);
 for(const side of [-1,1]){
  add('SF_MK2_HallSide',[.085,depth,height],
   [side*(width*.5-.04),centerY,doorZ],wall);
  add('SF_MK2_HallLamp',[.055,1.35,.075],
   [side*(width*.5-.115),doorY+1.15,doorZ+height*.33],strip);
 }
 add('SF_MK2_HallBack',[width,.09,height],[0,doorY+depth+.2,doorZ],wall);
 stage.add(group);
 group.userData[OWNED]=true;
 group.userData.ownedMaterials=[wall,floor,strip];
 return true;
}

export function polishFeldkommandoMk2(model,yard=null){
 if(!isFeldkommandoMk2(model))return false;
 if(!model.userData.sfMk2Polished){
  roofSteel(model);
  matchMk2DesertCamouflage(model);
  widenMk2Perimeter(model);
  addMk2Interior(model);
  model.userData.sfMk2Polished=true;
 }
 hideMk2DuplicateFence(yard);
 return true;
}

export function disposeFeldkommandoMk2Polish(model){
 if(!model?.userData?.sfMk2Polished)return;
 const materials=new Set();
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const arr=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of arr)if(material?.userData?.[OWNED])materials.add(material);
  if(mesh.geometry?.userData?.[OWNED])mesh.geometry.dispose();
 });
 for(const material of materials)material.dispose();
 const hall=model.getObjectByName('SF_MK2_Interior');
 if(hall){
  hall.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
  for(const material of hall.userData.ownedMaterials??[])material.dispose();
  hall.removeFromParent();
 }
 delete model.userData.sfMk2Polished;
}
