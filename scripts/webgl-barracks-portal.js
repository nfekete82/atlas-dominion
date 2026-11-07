import * as THREE from 'three';

// The shipped barracks facade consists of separate textured airlock panels and
// solid hull volumes. Build an actual portal by clipping ONLY the handful of
// hull meshes intersecting the door cavity; preserve their original UV/PBR.
// No second opaque wall is left behind the sliding panels.
const localDoorBox=[
 [new THREE.Vector3( 1,0,0), .57], // x >= -.57
 [new THREE.Vector3(-1,0,0), .20], // x <=  .20
 [new THREE.Vector3(0, 1,0),-.25], // y >=  .25
 [new THREE.Vector3(0,-1,0),1.25], // y <= 1.25
 [new THREE.Vector3(0,0, 1),-.68], // z >=  .68
 [new THREE.Vector3(0,0,-1),1.64]  // z <= 1.64
];
const cutNames=/ArmouredHull|CeramicHull|AirlockHousing|AirlockArmour|EntryRecess/;
const panelNames=/AirlockDoor|DoorCeramic|BarracksBlastDoor|BarracksDoorStiffener/;
const box=new THREE.BoxGeometry(1,1,1);
const dark=new THREE.MeshStandardMaterial({color:'#101716',roughness:1});
const floor=new THREE.MeshStandardMaterial({color:'#666054',roughness:.95});
export function prepareBarracksPortal(entry,renderer){
 if(entry?.barracksPortal)return entry.barracksPortal;
 const root=entry?.detail;
 if(!root)return null;
 const doorPanels=[],materials=[];
 const planes=localDoorBox.map(()=>new THREE.Plane());
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  if(panelNames.test(obj.name)){
   doorPanels.push({mesh:obj,y:obj.position.y,scaleY:obj.scale.y});
  }
  if(cutNames.test(obj.name)){
   const original=obj.material;
   const clipMaterial=material=>{
    const m=material.clone();
    m.clippingPlanes=planes;m.clipIntersection=true;m.clipShadows=true;
    materials.push(m);return m;
   };
   obj.material=Array.isArray(original)?original.map(clipMaterial):clipMaterial(original);
  }
 });
 if(!doorPanels.some(p=>/BarracksBlastDoor/.test(p.mesh.name)))return null;
 renderer.localClippingEnabled=true;
 const hall=new THREE.Group();
 hall.name='BarracksInterior';
 function part(name,size,at,material){
  const mesh=new THREE.Mesh(box,material);
  mesh.name=name;mesh.position.set(...at);mesh.scale.set(...size);
  hall.add(mesh);return mesh;
 }
 // Interior is behind the true cavity, not pasted over the closing panels.
 part('BarracksInteriorFloor',[.78,.035,.90],[-.18,.275,.91],floor);
 part('BarracksInteriorRear',[.80,.95,.025],[-.18,.73,.66],dark);
 part('BarracksInteriorCeiling',[.82,.025,.88],[-.18,1.24,1.08],dark);
 const portal={kind:'barracks',root,doorPanels,materials,planes,box:localDoorBox,
  hall,transform:null};
 root.add(hall);entry.barracksPortal=portal;
 updateBarracksPortalPlanes(portal,true);
 return portal;
}
export function updateBarracksPortalPlanes(portal,force=false){
 portal.root.updateWorldMatrix(true,false);
 const matrix=portal.root.matrixWorld;
 if(!force&&portal.transform?.equals(matrix))return;
 portal.transform=matrix.clone();
 for(let i=0;i<portal.planes.length;i++){
  const [normal,constant]=portal.box[i];
  portal.planes[i].set(normal,constant).applyMatrix4(matrix);
 }
}
export function setBarracksDoorOpen(portal,open){
 for(const panel of portal.doorPanels){
  panel.mesh.position.y=panel.y+open*.66;
  panel.mesh.scale.y=panel.scaleY*(1-open*.97);
 }
 portal.hall.visible=open>.03;
}
export function disposeBarracksPortal(entry){
 const p=entry?.barracksPortal;if(!p)return;
 setBarracksDoorOpen(p,0);
 for(const m of p.materials)m.dispose();
 p.hall.removeFromParent();
 delete entry.barracksPortal;
}
