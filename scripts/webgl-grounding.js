import * as THREE from 'three';
import {BUILDINGS} from '/src/reborn/catalog.js';

/** Soft, low-contrast contact shading to integrate models into desert sand.
 * Rendering only; never changes collision, navigation, visibility or saves. */
export function groundContactMaterial(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');
 const g=ctx.createRadialGradient(64,64,3,64,64,63);
 g.addColorStop(0,'rgba(58,43,30,.42)');
 g.addColorStop(.36,'rgba(74,53,35,.28)');
 g.addColorStop(.73,'rgba(95,72,46,.10)');
 g.addColorStop(1,'rgba(117,89,56,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity:.78,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-1,
  side:THREE.DoubleSide,toneMapped:false
 });
 return material;
}
function sandApronMaterial(){
 // Sandy erosion/dust accumulation around a building's foundations.
 // This is a procedural material, not a change to the actual footprint.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');
 const g=ctx.createRadialGradient(64,64,19,64,64,62);
 g.addColorStop(0,'rgba(173,133,78,0)');
 g.addColorStop(.42,'rgba(190,148,91,.06)');
 g.addColorStop(.64,'rgba(214,178,119,.29)');
 g.addColorStop(.84,'rgba(176,138,89,.15)');
 g.addColorStop(1,'rgba(176,138,89,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map:texture,transparent:true,
  opacity:.75,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  side:THREE.DoubleSide,toneMapped:false});
}
export class SandforgeGroundingPass{
 constructor(scene){
  this.scene=scene;
  this.material=groundContactMaterial();
  this.apronMaterial=sandApronMaterial();
  this.geometry=new THREE.PlaneGeometry(1,1);
  this.items=new Map();
 }
 attachBuilding(entry,entity){
  if(!entry||this.items.has(entity.id))return;
  const diameter=BUILDINGS[entity.kind]?.width??(entity.radius??60)*2;
  const base=new THREE.Mesh(this.geometry,this.material);
  base.name='sand-contact-'+entity.kind+'-'+entity.id;
  base.userData={decoration:true,nonPlayable:true};
  base.rotation.x=-Math.PI/2;base.position.y=.65;
  base.scale.set(diameter*1.11,diameter*.83,1);
  base.renderOrder=3;
  // Follow the building group so the decal stays grounded on the same
  // heightfield sample, including high plateaus and the construction phase.
  const apron=new THREE.Mesh(this.geometry,this.apronMaterial);
  apron.name='sand-apron-'+entity.kind+'-'+entity.id;
  apron.userData={decoration:true,nonPlayable:true};
  apron.rotation.x=-Math.PI/2;apron.position.y=.35;
  apron.scale.set(diameter*1.52,diameter*1.16,1);
  apron.renderOrder=2;
  // Each building owns the pair so deletion removes both in one operation.
  const group=new THREE.Group();
  group.name='grounding-'+entity.kind+'-'+entity.id;
  group.userData={decoration:true,nonPlayable:true};
  group.add(apron,base);entry.node.add(group);this.items.set(entity.id,group);
 }
 detachBuilding(id){
  const item=this.items.get(id);
  if(item){item.parent?.remove(item);this.items.delete(id);}
 }
}
