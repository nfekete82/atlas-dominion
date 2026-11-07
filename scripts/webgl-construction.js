import * as THREE from 'three';
import {BUILDINGS} from '/src/reborn/catalog.js';

/** Render-only construction states driven by the classic Simulation's
 * buildRemaining / buildTime. No new gameplay timers or construction rules.
 *
 * Unlike simply scaling a complete model to 58%, we reveal the actual GLB
 * from its foundation upward and assemble a segmented structural frame,
 * scaffolding posts and the roof sequentially.
 */
export class SandforgeConstructionPresentation{
 constructor(renderer){this.renderer=renderer;renderer.localClippingEnabled=true;}
 ensure(entry,base){
  if(entry.construction)return entry.construction;
  const spec=BUILDINGS[base.kind],width=spec.width*.76,depth=spec.width*.52;
  const frame=new THREE.Group();frame.name='construction-parts-'+base.id;
  const steel=new THREE.MeshStandardMaterial({color:base.owner===0?'#4b8592':'#986858',metalness:.65,roughness:.65});
  const foundationMat=new THREE.MeshStandardMaterial({color:'#867861',roughness:1});
  const roofMat=new THREE.MeshStandardMaterial({color:'#a8a08c',metalness:.2,roughness:.8});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(width,5,depth),foundationMat);
  slab.position.y=2.5;frame.add(slab);
  const columns=[];
  const height=Math.min(154,Math.max(58,spec.width*.56));
  for(const x of [-1,1])for(const z of [-1,1]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(4,height,4),steel);
   post.position.set(x*width*.43,height*.5,z*depth*.42);
   frame.add(post);columns.push(post);
  }
  const rails=[];
  for(const t of [0.37,0.68]){
   const beamA=new THREE.Mesh(new THREE.BoxGeometry(width*.88,4,4),steel);
   beamA.position.set(0,height*t,-depth*.42);
   const beamB=beamA.clone();beamB.position.z=depth*.42;
   const beamC=new THREE.Mesh(new THREE.BoxGeometry(4,4,depth*.84),steel);
   beamC.position.set(width*.43,height*t,0);
   const beamD=beamC.clone();beamD.position.x=-width*.43;
   frame.add(beamA,beamB,beamC,beamD);rails.push({threshold:t,meshes:[beamA,beamB,beamC,beamD]});
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(width*.93,6,depth*.94),roofMat);
  roof.position.y=height*.88;frame.add(roof);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const texture=new THREE.CanvasTexture(canvas);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.86,depthTest:false,depthWrite:false}));
  // Move the BAU label up without moving the green progress/health bar.
  label.scale.set(83,21,1);label.position.set(0,height+38,0);frame.add(label);
  entry.node.add(frame);
  const construction={frame,columns,rails,slab,roof,canvas,texture,label,
   height,clip:new THREE.Plane(new THREE.Vector3(0,-1,0),0),
   model:null,materials:[],lastLabel:-1,finished:false};
  entry.construction=construction;return construction;
 }
 update(entry,base){
  const spec=BUILDINGS[base.kind],active=base.buildRemaining>0;
  if(!active){
   if(entry.construction)this.finish(entry);
   return;
  }
  const state=this.ensure(entry,base);
  const progress=THREE.MathUtils.clamp(1-base.buildRemaining/spec.buildTime,0,1);
  state.frame.visible=true;
  state.slab.visible=progress>=.015;
  const postGrowth=THREE.MathUtils.clamp((progress-.06)/.53,0,1);
  for(const post of state.columns){
   post.scale.y=Math.max(.025,postGrowth);
   post.position.y=state.height*post.scale.y*.5;
  }
  for(const rail of state.rails)
   for(const beam of rail.meshes)beam.visible=progress>=rail.threshold;
  state.roof.visible=progress>=.77;
  // Clip a construction model at the current built height, not the entire
  // entry.node: healthbars, labels, and scaffolding must remain readable.
  const model=entry.detail??entry.placeholder;
  if(state.model!==model){
   for(const mat of state.materials){mat.clippingPlanes=[];mat.needsUpdate=true;}
   state.materials=[];
   model.traverse(obj=>{
    if(!obj.isMesh)return;
    const convert=mat=>{
     const copy=mat.clone();copy.clippingPlanes=[state.clip];copy.clipShadows=true;
     copy.needsUpdate=true;state.materials.push(copy);return copy;
    };
    obj.material=Array.isArray(obj.material)?obj.material.map(convert):convert(obj.material);
   });
   state.model=model;
  }
  const realHeight=entry.modelHeight??state.height;
  state.clip.constant=entry.node.position.y+Math.max(1.5,realHeight*progress);
  const tick=Math.floor(progress*20),working=base.constructionActive!==false;
  if(tick!==state.lastLabel||state.lastWorking!==working){
   state.lastLabel=tick;state.lastWorking=working;
   const c=state.canvas.getContext('2d');
   c.clearRect(0,0,256,64);
   c.fillStyle='rgba(16,28,30,.32)';c.fillRect(3,8,250,48);
   c.strokeStyle='rgba(220,194,148,.25)';c.lineWidth=2;c.strokeRect(3,8,250,48);
   c.fillStyle=working?'rgba(245,223,181,.86)':'rgba(251,181,157,.86)';
   c.font=working?'600 23px system-ui':'600 18px system-ui';
   c.textAlign='center';c.textBaseline='middle';
   c.fillText(working?'BAU '+Math.round(progress*100)+' %':'PAUSIERT · PIONIER',128,32);
   state.texture.needsUpdate=true;
  }
 }
 finish(entry){
  const state=entry.construction;if(!state)return;
  for(const mat of state.materials){mat.clippingPlanes=[];mat.needsUpdate=true;}
  entry.node.remove(state.frame);
  state.frame.traverse(o=>{
   if(o.isMesh){o.geometry.dispose();}
  });
  state.texture.dispose();state.label.material.dispose();
  entry.construction=null;
 }
 dispose(entry){this.finish(entry);}
}
