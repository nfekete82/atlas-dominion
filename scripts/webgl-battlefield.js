import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {UNITS,BUILDINGS,unitKinds,buildingKinds,unitSpec,buildingSpec} from '/src/reborn/catalog.js';
import {RULES} from '/src/reborn/config.js';
import {installClassicHud} from '/webgl-classic-hud.js';
import {hydrateUnitIcons,unitIcon,buildingIconUrl} from '/webgl-portraits.js';
import {SandforgeActorPresentation} from '/webgl-actor-presentation.js';
import {calibratedScale,visualUnitScale} from '/webgl-scale.js';
import {SandforgeGroundingPass} from '/webgl-grounding.js';
import {SandforgeConstructionPresentation} from '/webgl-construction.js';
import {createBastionCaptureBar,updateBastionCaptureBar} from '/webgl-bastion-capture.js';

// Runtime adapter: game state, movement, combat, production and AI are owned
// exclusively by the original Simulation. 3D nodes are presentation only.
const UP=new THREE.Vector3(0,1,0);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const colors={blue:'#62c6e9',red:'#f19b73',neutral:'#d3c09b'};
const title=(v)=>v.name||v.kind||'';
const format=(n)=>Math.round(n).toLocaleString('de-DE');
const plain=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class SandforgeBattlefield {
 constructor({game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,lite=false}){
  Object.assign(this,{game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,lite});
  this.units=new Map();this.bases=new Map();this.bastions=new Map();
  this.announcedBuildings=new Set(game.bases.filter(b=>b.buildRemaining<=0).map(b=>b.id));
  this.models=new Map();this.pending=new Set();this.selected=new Set();
  this.selectedBase=null;this.buildKind=null;this.attackMode=false;
  this.rallyMode=false;
  this.rallyMarker=new THREE.Mesh(
   new THREE.RingGeometry(19,25,32),
   new THREE.MeshBasicMaterial({color:'#ffcf6a',transparent:true,opacity:.9,depthTest:false,depthWrite:false,side:THREE.DoubleSide})
  );
  this.rallyMarker.rotation.x=-Math.PI/2;
  this.rallyMarker.renderOrder=1012;
  this.rallyMarker.visible=false;
  this.scene.add(this.rallyMarker);
  // Every ground right-click gets a short, expanding Zero Hour-style ping.
  // Unlike the permanent rally ring it never enters World or save data.
  this.commandPulse=new THREE.Mesh(
   new THREE.RingGeometry(23,26,48),
   new THREE.MeshBasicMaterial({color:'#7ce7ef',transparent:true,
    opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide})
  );
  this.commandPulse.name='visual-ground-command-pulse';
  this.commandPulse.userData={visualOnly:true,nonPlayable:true,commandPulse:true};
  this.commandPulse.rotation.x=-Math.PI/2;
  this.commandPulse.renderOrder=1013;this.commandPulse.visible=false;
  this.commandPulseTime=.7;this.scene.add(this.commandPulse);
  this.miniLast=0;this.uiLast=0;this.fogLast=0;
  this.fogEnabled=true;this.selectedRings=new Map();this.animations=new Map();
  this.presentation=new SandforgeActorPresentation(scene,camera,game);
  this.grounding=new SandforgeGroundingPass(scene);
  this.construction=new SandforgeConstructionPresentation(renderer);
  // Dedicated second render pass: the building hologram must remain visible
  // over fog, units, rocks and terrain, independent of transparent sorting.
  // Visual only; the game's real 3D collision/raycast scene is unchanged.
  this.buildPreviewScene=new THREE.Scene();
  this.buildPreviewScene.add(new THREE.HemisphereLight('#fff4e4','#796d5b',2.5));
  const hologramSun=new THREE.DirectionalLight('#fff6e2',2.1);
  hologramSun.position.set(420,750,310);this.buildPreviewScene.add(hologramSun);
  this.buildPreview=null;this.previewKind=null;this.placementFacing=0;
  this.buildHint=document.createElement('div');
  this.buildHint.id='sf3d-build-hint';this.buildHint.setAttribute('role','status');
  this.buildHint.style.cssText='position:fixed;z-index:18;pointer-events:none;display:none;min-width:156px;max-width:250px;padding:7px 10px;background:#14221ef0;border:1px solid #b5a177;color:#e7dbb7;font:bold 12px system-ui;box-shadow:0 5px 16px #0008';
  document.body.append(this.buildHint);
  this.defaultFactions=[0,1];
  this.maxModels=80;this.loadingCount=0;this.modelQueue=[];
  this.clickStart=null;this.groups=new Map();
  this.selectionBox=document.createElement('div');
  this.selectionBox.style.cssText='position:fixed;z-index:11;pointer-events:none;border:1px solid #9be5ef;background:#4ca4ce35;display:none;box-shadow:inset 0 0 0 1px #1c3945a8';
  document.body.append(this.selectionBox);
  this.tracer=new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.96,depthWrite:false}));
  this.tracer.frustumCulled=false;scene.add(this.tracer);
  this.buildInterface();this.addFog();this.createBastions();
  this.attachInput();this.sync(true);
 }
 entityPosition(p){return this.pos(p.x,p.y,this.heightAt(p.x,p.y)+(UNITS[p.kind]?.flying?75+100*(p.flightHeight??1):0));}
 createFallback(kind,owner,type){
  const group=new THREE.Group(),team=owner===0?'#397f9d':'#9f5541',metal=new THREE.MeshStandardMaterial({color:team,metalness:.55,roughness:.53}),
   dark=new THREE.MeshStandardMaterial({color:'#444743',metalness:.45,roughness:.7});
  const make=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  if(type==='unit'){
   if(['tank','rover','artillery'].includes(kind)){
    const length=kind==='tank'?77:kind==='artillery'?84:57;
    make(new THREE.BoxGeometry(44,15,length),metal,0,16,0);
    make(new THREE.BoxGeometry(32,12,length*.45),dark,0,30,0);
    for(const x of [-22,22])for(const z of [-length*.33,length*.33])make(new THREE.CylinderGeometry(10,10,7,12),dark,x,9,z).rotation.z=Math.PI*.5;
   }else if(['scout','bomber'].includes(kind)){
    make(new THREE.CapsuleGeometry(13,36,4,8),metal,0,15,0).rotation.x=Math.PI*.5;
    make(new THREE.BoxGeometry(95,2,15),dark,0,18,0);
   }else{
    make(new THREE.CapsuleGeometry(8,13,4,10),metal,0,22,0);
    make(new THREE.SphereGeometry(9,10,8),dark,0,42,0);
    make(new THREE.BoxGeometry(4,4,27),dark,10,23,-9);
   }
  }else{
   const w=BUILDINGS[kind]?.width??150,depth=w*.65;
   make(new THREE.BoxGeometry(w,9,depth),dark,0,5,0);
   make(new THREE.BoxGeometry(w*.84,42,depth*.8),metal,0,30,0);
   make(new THREE.BoxGeometry(w*.9,7,depth*.83),dark,0,56,0);
   make(new THREE.CylinderGeometry(6,9,45,10),dark,w*.2,80,-depth*.18);
  }
  return group;
 }
 async getModel(url){
  if(!this.models.has(url))this.models.set(url,this.loader.loadAsync(url).catch(e=>{this.models.delete(url);throw e;}));
  return this.models.get(url);
 }
 asset(kind,owner,type){
  const prefix='/src/assets/reborn/';
  if(type==='building')return prefix+'buildings-3d/'+kind+'-'+owner+'.glb';
  return prefix+(['rover','tank','artillery','scout','bomber'].includes(kind)?'animation/':'prototype/')+kind+'-'+owner+'.glb';
 }
 // Do not download every 15–25 MB faction model on the first frame.
 scheduleDetail(entry,entity,type){
  // Lite mode reduces terrain/actor detail, but authored PBR buildings must
  // still appear. Falling back to primitive grey cubes would make the actual
  // player's base look markedly worse than the 2D game.
  if((this.lite&&type!=='building')||entry.requested||
     this.loadingCount+this.modelQueue.length>=this.maxModels)return;
  entry.requested=true;
  const url=this.asset(entity.kind,entity.owner,type);
  this.modelQueue.push({url,entry,type});
  this.pumpModelQueue();
 }
 pumpModelQueue(){
  while(this.loadingCount<2&&this.modelQueue.length){
   const task=this.modelQueue.shift();this.loadingCount++;
   this.getModel(task.url).then(data=>{
    const {entry,type}=task;
    if(!entry.node.parent)return;
    const model=cloneSkeleton(data.scene),box0=new THREE.Box3().setFromObject(model);
    const dims=box0.getSize(new THREE.Vector3());
    const desired=type==='unit'?UNITS[entry.kind].width:BUILDINGS[entry.kind].width;
    const extent=Math.max(dims.x,dims.z);
    if(extent>.0001){
     const scale=calibratedScale(entry.kind,type,dims,desired)*
       (type==='unit'?visualUnitScale(entry.kind):1);
     model.scale.multiplyScalar(scale);
     model.position.set(-box0.getCenter(new THREE.Vector3()).x*scale,
      -box0.min.y*scale,-box0.getCenter(new THREE.Vector3()).z*scale);
    }
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    // Visual normalization is independent of collision/pathfinding. Re-ground
    // imported GLBs against the same heightfield sample as their placeholder.
    entry.node.remove(entry.placeholder);entry.node.add(model);entry.detail=model;
    const visualScale=calibratedScale(entry.kind,type,dims,desired)*
      (type==='unit'?visualUnitScale(entry.kind):1);
    entry.modelHeight=dims.y*visualScale;
    entry.modelFootprint=Math.max(dims.x,dims.z)*visualScale;
    entry.visualBaseY=model.position.y;entry.visualBaseZ=model.position.z;
    if(type==='unit'&&data.animations.length){
     const mixer=new THREE.AnimationMixer(model);
     const idle=data.animations.find(a=>/idle|stand|hover|engine/i.test(a.name))||data.animations[0];
     const walk=data.animations.find(a=>/walk|run|move|drive|roll|fly|operation/i.test(a.name))||idle;
     const attack=data.animations.find(a=>/attack|shoot|fire|recoil|strike/i.test(a.name))||null;
     const hit=data.animations.find(a=>/hit|damage|hurt/i.test(a.name))||null;
     const death=data.animations.find(a=>/death|die|destroy/i.test(a.name))||null;
     entry.animation={mixer,idle,walk,attack,hit,death,playing:null};
     entry.playAnimation=(clip,retrigger=false)=>this.playClip(entry,clip,retrigger);
     this.playClip(entry,idle);
    }
   }).catch(err=>console.warn('3D asset fallback:',task.url,err.message))
    .finally(()=>{this.loadingCount--;this.pumpModelQueue();});
  }
 }
 playClip(entry,clip,retrigger=false){
  const anim=entry.animation;
  if(!anim||!clip||anim.playing===clip&&!retrigger)return;
  const prev=anim.playing?anim.mixer.existingAction(anim.playing):null;
  const next=anim.mixer.clipAction(clip);
  next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(1);
  // Smooth idle -> walking -> combat changes. Fire clips repeat once,
  // walking/idle loops continuously, without restarting every frame.
  if(clip===anim.attack||clip===anim.hit||clip===anim.death){
   next.setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;
  }else{
   next.setLoop(THREE.LoopRepeat,Infinity);next.clampWhenFinished=false;
  }
  if(retrigger||next!==prev)next.reset();
  next.play();
  if(prev&&prev!==next){next.crossFadeFrom(prev,.12,false);}
  else if(retrigger&&prev===next){next.reset().play();}
  anim.playing=clip;
 }
 spawnNode(entity,type){
  const node=new THREE.Group();
  node.name=type+'-'+entity.kind+'-'+entity.id;
  node.userData={id:entity.id,type};
  const placeholder=this.createFallback(entity.kind,entity.owner,type);
  // Lite mode must match detailed mode: both receive the same visual scale.
  if(type==='unit')placeholder.scale.setScalar(visualUnitScale(entity.kind));
  node.add(placeholder);node.position.copy(this.entityPosition(entity));
  this.scene.add(node);
  const entry={node,placeholder,kind:entity.kind,owner:entity.owner,requested:false};
  this.scheduleDetail(entry,entity,type);return entry;
 }
 beginPlacement(kind){
  this.clearPlacement();
  this.buildKind=kind;this.previewKind=kind;this.placementFacing=0;
  const spec=BUILDINGS[kind],group=new THREE.Group();
  group.name='ghost-building-'+kind;group.userData={buildGhost:true,nonPlayable:true};
  const placeholder=this.createFallback(kind,0,'building');
  const tint=(root)=>{
   root.traverse(obj=>{
    if(!obj.isMesh)return;
    const make=mat=>{
     const m=mat.clone();m.color?.lerp(new THREE.Color('#8ad6b3'),.32);
     m.transparent=true;m.opacity=.72;m.depthWrite=false;
     m.depthTest=false;m.side=THREE.DoubleSide;
     return m;
    };
    obj.material=Array.isArray(obj.material)?obj.material.map(make):make(obj.material);
    obj.renderOrder=1010;obj.castShadow=false;obj.receiveShadow=false;
   });
  };
  tint(placeholder);group.add(placeholder);
  const circle=new THREE.Mesh(
   new THREE.RingGeometry(spec.radius-2.5,spec.radius+1.5,48),
   new THREE.MeshBasicMaterial({color:'#80efae',transparent:true,opacity:.92,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
  circle.rotation.x=-Math.PI/2;circle.position.y=2;circle.renderOrder=1009;group.add(circle);
  this.buildPreviewScene.add(group);
  this.buildPreview=group;group.visible=false;
  this.getModel(this.asset(kind,0,'building')).then(data=>{
   if(this.buildPreview!==group||this.buildKind!==kind)return;
   const model=cloneSkeleton(data.scene),bounds=new THREE.Box3().setFromObject(model);
   const size=bounds.getSize(new THREE.Vector3());
   if(size.y>0&&Math.max(size.x,size.z)>0){
    const scale=calibratedScale(kind,'building',size,spec.width);
    model.scale.multiplyScalar(scale);
    model.position.set(-bounds.getCenter(new THREE.Vector3()).x*scale,
      -bounds.min.y*scale,-bounds.getCenter(new THREE.Vector3()).z*scale);
   }
   tint(model);group.remove(placeholder);group.add(model);
  }).catch(error=>console.warn('Baupreview: vereinfachtes 3D-Modell',error));
 }
 clearPlacement(){
  this.buildKind=null;this.previewKind=null;
  if(this.buildPreview){this.buildPreviewScene.remove(this.buildPreview);this.buildPreview=null;}
  if(this.buildHint)this.buildHint.style.display='none';
 }
 updatePlacementPreview(event){
  const ghost=this.buildPreview;if(!this.buildKind||!ghost)return;
  const p=this.terrainPoint(event);
  ghost.visible=Boolean(p);
  if(!p){this.buildHint.style.display='none';return;}
  ghost.position.copy(this.pos(p.x,p.y));
  ghost.rotation.y=this.placementFacing?Math.PI:0;
  const error=this.game.buildError(0,this.buildKind,p);
  const engineer=this.game.units.some(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
  const valid=!error&&engineer;
  const ring=ghost.children.find(x=>x.geometry?.type==='RingGeometry');
  if(ring)ring.material.color.set(valid?'#87efb5':'#ff796b');
  this.buildHint.style.display='block';
  this.buildHint.style.left=Math.max(4,Math.min(event.clientX+17,window.innerWidth-265))+'px';
  this.buildHint.style.top=Math.max(4,Math.min(event.clientY+15,window.innerHeight-85))+'px';
  this.buildHint.textContent=BUILDINGS[this.buildKind].name+' · '+
   (valid?'Bauplatz frei · Klick baut':error??'Pionier benötigt')+
   ' · R drehen';
  this.buildHint.style.borderColor=valid?'#9edfbe':'#ee8875';
 }
 sync(force=false,dt=0,active=true,alpha=1){
  const aliveUnits=new Set(),aliveBases=new Set();
  const blend=Math.max(0,Math.min(1,alpha));
  this.presentation.refreshStats();
  this.presentation.stepRemnants(dt,active);
  for(const u of this.game.units){
   if(u.hp<=0||u.carrier)continue;
   aliveUnits.add(u.id);
   let entry=this.units.get(u.id);
   if(!entry){entry=this.spawnNode(u,'unit');this.units.set(u.id,entry);}
   // Interpolate between authoritative 20 Hz snapshots for smooth 60–120 FPS
   // visuals. Simulation, pathfinding and orders use true u.x/u.y only.
   const travel=Math.hypot(u.x-u.previousX,u.y-u.previousY);
   const lerp=Number.isFinite(travel)&&travel<180?blend:1;
   const x=Number.isFinite(u.previousX)?u.previousX+(u.x-u.previousX)*lerp:u.x;
   const z=Number.isFinite(u.previousY)?u.previousY+(u.y-u.previousY)*lerp:u.y;
   entry.node.position.copy(this.pos(x,z,this.heightAt(x,z)+(UNITS[u.kind]?.flying?75+100*(u.flightHeight??1):0)));
   entry.node.rotation.y=Math.PI*.5-u.angle;
   entry.node.visible=u.owner===0||this.game.canSee(0,u);
  }
  for(const [id,e] of this.units)if(!aliveUnits.has(id)){this.presentation.remove(e,this.game.units.find(u=>u.id===id));this.scene.remove(e.node);this.units.delete(id);this.selected.delete(id);}
  for(const b of this.game.bases){
   if(b.hp<=0)continue;
   aliveBases.add(b.id);
   let entry=this.bases.get(b.id);
   if(!entry){entry=this.spawnNode(b,'building');this.bases.set(b.id,entry);this.grounding.attachBuilding(entry,b);}
   entry.node.position.copy(this.entityPosition(b));
   entry.node.visible=b.owner===0||this.game.canSee(0,b);
   entry.node.scale.y=1;
   entry.node.rotation.y=b.facing===1?Math.PI:0;
   this.construction.update(entry,b);
   if(b.buildRemaining<=0&&!this.announcedBuildings.has(b.id)){
    this.announcedBuildings.add(b.id);
    if(b.owner===0&&this.sound?.enabled)this.sound.announceReady('building');
   }
  }
  for(const [id,e] of this.bases)if(!aliveBases.has(id)){this.presentation.remove(e,this.game.bases.find(base=>base.id===id));this.construction.dispose(e);this.grounding.detachBuilding(id);this.scene.remove(e.node);this.bases.delete(id);if(this.selectedBase===id)this.selectedBase=null;}
  this.presentation.consumeShots(this.units,this.bases);
  for(const u of this.game.units){
   const entry=this.units.get(u.id);
   if(entry)this.presentation.update(entry,u,'unit',dt,this.selected.has(u.id),active);
  }
  for(const b of this.game.bases){
   const entry=this.bases.get(b.id);
   if(entry)this.presentation.update(entry,b,'building',dt,this.selectedBase===b.id,active);
  }
  const known=new Set(this.game.territories.map(t=>t.id));
  for(const [id,entry] of this.bastions)if(!known.has(id)){this.scene.remove(entry.node);this.bastions.delete(id);}
  for(const territory of this.game.territories){
   const entry=this.bastions.get(territory.id);
   if(entry&&entry.owner!==territory.owner){
    const previousOwner=entry.owner;
    entry.owner=territory.owner;
    entry.core.material.color.set(territory.owner===0?colors.blue:territory.owner===1?colors.red:colors.neutral);
    entry.halo.material.color.set(territory.owner===0?colors.blue:territory.owner===1?colors.red:colors.neutral);
    if(!this.lite)this.loadBastionModel(entry,territory.owner);
    // Only announce ownership changes involving the local faction. Unknown
    // battles between other factions must never leak through Fog of War.
    if(territory.owner===0){
     this.message('SEKTOR '+(territory.id+1)+' EROBERT · +'+territory.income+' Credits / 10 s');
     this.panel.querySelector('#sf-message')?.setAttribute('data-sector-event','secured');
     this.sound?.command?.();
    }else if(previousOwner===0){
     this.message('SEKTOR '+(territory.id+1)+' VERLOREN');
     this.panel.querySelector('#sf-message')?.setAttribute('data-sector-event','lost');
    }
   }
   if(entry)updateBastionCaptureBar(entry.captureBar,territory,this.game,this.fogEnabled);
  }
  this.updateSelectionRings();
  this.updateShots();
  const now=performance.now();
  if(force||now-this.fogLast>350){this.updateFog();this.fogLast=now;}
  if(force||now-this.uiLast>280){this.drawInterface();this.uiLast=now;}
  if(force||now-this.miniLast>700){this.drawMinimap();this.miniLast=now;}
 }
 async loadBastionModel(entry,owner){
  const version=(entry.version??0)+1;entry.version=version;
  try{
   const modelPath='/src/assets/reborn/buildings-3d/bastion-'+owner+'.glb';
   const data=await this.getModel(modelPath);
   if(version!==entry.version||!entry.node.parent)return;
   const detail=cloneSkeleton(data.scene);
   const box=new THREE.Box3().setFromObject(detail),size=box.getSize(new THREE.Vector3());
   const factor=116/Math.max(.0001,size.x,size.z),center=box.getCenter(new THREE.Vector3());
   detail.scale.multiplyScalar(factor);
   detail.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
   detail.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
   if(entry.detail)entry.node.remove(entry.detail);
   entry.detail=detail;entry.node.add(detail);
   entry.pad.visible=false;entry.core.visible=false;
  }catch(error){console.warn('Bastion 3D model fallback',error);}
 }
 createBastions(){
  const base=new THREE.CylinderGeometry(38,40,9,12),ob=new THREE.CylinderGeometry(11,18,45,12);
  const stone=new THREE.MeshStandardMaterial({color:'#c4a77d',roughness:1});
  for(const t of this.game.territories){
   const node=new THREE.Group();node.name='bastion-'+t.id;
   node.position.copy(this.pos(t.point.x,t.point.y));
   const pad=new THREE.Mesh(base,stone);pad.position.y=5;pad.receiveShadow=true;node.add(pad);
   const core=new THREE.Mesh(ob,new THREE.MeshStandardMaterial({color:t.owner===0?colors.blue:t.owner===1?colors.red:colors.neutral,metalness:.7,roughness:.35}));
   core.position.y=33;core.castShadow=true;node.add(core);
   const halo=new THREE.Mesh(new THREE.TorusGeometry(49,2,6,48),new THREE.MeshBasicMaterial({color:t.owner===0?colors.blue:t.owner===1?colors.red:colors.neutral,transparent:true,opacity:.75}));
   halo.rotation.x=-Math.PI/2;halo.position.y=5;node.add(halo);
   const captureBar=createBastionCaptureBar();node.add(captureBar);
   this.scene.add(node);
   const entry={node,core,pad,owner:t.owner,halo,captureBar};
   this.bastions.set(t.id,entry);
   if(!this.lite)this.loadBastionModel(entry,t.owner);
  }
 }
 addFog(){
  const grid=RULES.grid,bytes=new Uint8Array(grid*grid*4);
  this.fogTexture=new THREE.DataTexture(bytes,grid,grid,THREE.RGBAFormat,THREE.UnsignedByteType);
  this.fogTexture.magFilter=THREE.LinearFilter;this.fogTexture.minFilter=THREE.LinearFilter;
  this.fogTexture.wrapS=this.fogTexture.wrapT=THREE.ClampToEdgeWrapping;
  const mat=new THREE.ShaderMaterial({
   uniforms:{fogTex:{value:this.fogTexture},mapSize:{value:this.world.size},fogStep:{value:1/RULES.grid}},
   // Fog must share the actual terrain plane. A raised sheet causes severe
   // screen-space parallax: revealed tiles shift away from their soldiers.
   // Composite the aligned fog last to conceal objects in unseen territory.
   vertexShader:'uniform float mapSize; varying vec2 fogUv; void main(){fogUv=vec2(position.x/mapSize+.5,position.z/mapSize+.5);vec3 p=position;p.y+=3.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
   // Only real playable terrain receives authoritative fog-of-war; the
   // decorative outer ring contains no units, buildings or discovery data.
   // Covering that ring would hide its mountains and palm groves completely.
   fragmentShader:'uniform sampler2D fogTex;uniform float mapSize;uniform float fogStep;varying vec2 fogUv;void main(){vec2 uv=clamp(fogUv,vec2(0.001),vec2(0.999));float a=texture2D(fogTex,uv).a;vec2 d=vec2(fogStep*1.6,0.0);float n=max(max(texture2D(fogTex,clamp(uv+d,vec2(0.001),vec2(0.999))).a,texture2D(fogTex,clamp(uv-d,vec2(0.001),vec2(0.999))).a),max(texture2D(fogTex,clamp(uv+d.yx,vec2(0.001),vec2(0.999))).a,texture2D(fogTex,clamp(uv-d.yx,vec2(0.001),vec2(0.999))).a));a=max(a,n*0.44);vec2 beyond=max(max(-fogUv,fogUv-1.0),vec2(0.0));float edge=max(beyond.x,beyond.y);a=max(a,smoothstep(0.0,420.0/mapSize,edge));gl_FragColor=vec4(0.14,0.108,0.075,a);}',
   transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide
  });
  // Decorative, non-playable perimeter is always visible. Fog remains
  // fully opaque in undiscovered playable cells and cannot leak enemy data.
  this.fogNodes=this.groundMeshes.map(mesh=>{
   const layer=new THREE.Mesh(mesh.geometry,mat);layer.frustumCulled=false;
   layer.renderOrder=990;layer.userData={fogOverlay:true,visualOnly:true};
   this.scene.add(layer);return layer;
  });
 }
 updateFog(){
  const {visible,explored}=this.game;
  const data=this.fogTexture.image.data;
  for(let i=0;i<this.world.blocked.length;i++){
   const k=i*4;
   data[k]=24;data[k+1]=30;data[k+2]=31;
   // Unexplored remains opaque (no hidden information leaks). Give the
   // cover a subtle dark-sand tint so the battlefield reads as one world.
   data[k+3]=visible[0][i]?0:explored[0][i]?215:255;
  }
  this.fogTexture.needsUpdate=true;
  this.fogNodes.forEach(n=>n.visible=this.fogEnabled);
  this.fogAtmosphere?.setFogEnabled(this.fogEnabled);
 }
 updateShots(){
  const lines=[],tints=[];
  for(const shot of this.game.shots.slice(-110)){
   if(!this.game.canSee(0,shot.from)&&!this.game.canSee(0,shot.to))continue;
   const a=this.pos(shot.from.x,shot.from.y,this.heightAt(shot.from.x,shot.from.y)+27);
   const b=this.pos(shot.to.x,shot.to.y,this.heightAt(shot.to.x,shot.to.y)+27);
   lines.push(a.x,a.y,a.z,b.x,b.y,b.z);
   const c=shot.weapon==='rocket'||shot.weapon==='cannon'?[1,.58,.17]:shot.owner===0?[.55,.89,1]:[1,.47,.25];
   tints.push(...c,...c);
  }
  const geometry=this.tracer.geometry;
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
  geometry.computeBoundingSphere();
 }
 updateSelectionRings(){
  for(const [id,ring] of this.selectedRings)if(!this.selected.has(id)||!this.units.has(id)){
   this.scene.remove(ring);this.selectedRings.delete(id);
  }
  for(const id of this.selected){
   const unit=this.game.units.find(u=>u.id===id);
   if(!unit||unit.hp<=0)continue;
   let ring=this.selectedRings.get(id);
   if(!ring){
    ring=new THREE.Mesh(new THREE.TorusGeometry((unitSpec(unit).radius||12)+11,1.8,5,40),new THREE.MeshBasicMaterial({color:colors.blue,depthWrite:false,transparent:true,opacity:.9}));
    ring.rotation.x=-Math.PI/2;ring.renderOrder=9;this.scene.add(ring);
    this.selectedRings.set(id,ring);
   }
   ring.position.copy(this.units.get(id)?.node.position??this.entityPosition(unit));ring.position.y+=3;
  }
 }
 // Selection is the source of truth for the production catalogue.
 // A builder exposes construction; a completed, selected producer exposes
 // ONLY its own unit roster. Global tech unlocks never reveal unrelated tabs.
 catalogContext(){
  const game=this.game;
  const engineer=game.units.some(u=>this.selected.has(u.id)&&u.owner===0&&u.hp>0&&!u.carrier&&u.kind==='engineer');
  const base=game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
  const producer=base&&unitKinds.some(kind=>UNITS[kind].producers.includes(base.kind))?base:null;
  return {engineer,producer,preferred:engineer?'buildings':producer?'units':'territories'};
 }
 buildInterface(){
  this.panel=installClassicHud();
  this.mini=this.panel.querySelector('#sf-map');
  this.panel.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(this.sound?.enabled)this.sound.select();
   const kind=button.dataset.build,unit=button.dataset.unit,action=button.dataset.action;
   if(kind){
    if(!this.catalogContext().engineer){this.message('Zum Bauen zuerst einen Pionier auswählen');return;}
    this.beginPlacement(kind);this.attackMode=false;this.sound?.select?.();
    this.message('Bauplatz wählen: '+BUILDINGS[kind].name+' · R: drehen · Shift: Aufträge anhängen');this.drawInterface();
   }
   if(unit){
    const producer=this.catalogContext().producer;
    if(!producer||!UNITS[unit].producers.includes(producer.kind)){
     this.message('Zum Ausbilden das passende Produktionsgebäude auswählen');return;
    }
    if(this.game.recruit(producer.id,unit))this.message(UNITS[unit].name+' in Auftrag');
    else this.message('Nicht möglich: Gebäude, Kapazität oder Credits prüfen');
    this.drawInterface();
   }
   if(button.dataset.territory!==undefined){
    const t=this.game.territories.find(t=>t.id===Number(button.dataset.territory));
    if(t){
     const dest=this.pos(t.point.x,t.point.y),delta=dest.clone().sub(this.controls.target);
     this.controls.target.add(delta);this.camera.position.add(delta);this.controls.update();
    }
   }
   if(action==='rally'){
    const base=this.game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
    if(base){this.rallyMode=!this.rallyMode;this.clearPlacement();this.attackMode=false;
     this.message(this.rallyMode?'Linksklick auf Gelände: Sammelpunkt setzen · Escape: Abbruch':'Sammelpunkt-Modus beendet');
     this.drawInterface();}
   }
   if(action==='menu'){window.Sandforge3DMenu?.openPause();}
   if(action==='health'){
    const modes=['all','damaged','selected','off'];
    const old=this.presentation.showHealth;
    this.presentation.setHealthMode(modes[(modes.indexOf(old)+1)%modes.length]);
    this.message('Lebensbalken: '+({all:'Alle',damaged:'Beschädigte',selected:'Ausgewählte',off:'Aus'}[this.presentation.showHealth]));
   }
   if(action==='fog'){this.fogEnabled=!this.fogEnabled;this.updateFog();this.message('Nebel des Krieges '+(this.fogEnabled?'aktiv':'deaktiviert'));}
   if(action==='save'){try{localStorage.setItem('sandforge:webgl:v1',JSON.stringify(this.game.save()));this.message('3D-Kampagne gespeichert');}catch(error){this.message('Speichern fehlgeschlagen: '+error.message);}}
   if(action==='load'){this.loadSave();}
   if(action==='attack'){this.attackMode=!this.attackMode;this.clearPlacement();this.drawInterface();this.message(this.attackMode?'Angriffsbewegung: Rechtsklick auf Ziel':'Angriffsbewegung beendet');}
   if(action==='stop'){
    const count=this.selected.size;
    this.game.stop([...this.selected],false);
    this.message(count?count+' Einheiten angehalten':'Keine Einheiten gewählt');
   }
   if(action==='cancel'){this.clearPlacement();this.attackMode=false;this.selected.clear();this.selectedBase=null;this.drawInterface();}
   if(action==='select-all'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.selectedBase=null;this.drawInterface();}
  });
  this.panel.addEventListener('sandforge-tabchange',event=>{
   const available={buildings:this.catalogContext().engineer,units:Boolean(this.catalogContext().producer),territories:true};
   if(!available[event.detail.tab])return;
   this.panel.querySelector('#sf-actions').scrollTop=0;
   const descriptions={units:'Wähle einen Produktionsauftrag. Gebäude schalten neue Einheiten frei.',
    buildings:'Gebäude auswählen und einen freien Bauplatz auf der Karte anklicken.',
    territories:'Kontrollpunkt wählen, um die Kamera zum Sektor zu bewegen.'};
   this.panel.querySelector('#sf-catalog-detail').textContent=descriptions[event.detail.tab]??'';
  });
  this.mini.addEventListener('click',e=>{
   const rect=this.mini.getBoundingClientRect();
   const x=(e.clientX-rect.left)/rect.width*this.world.size,z=(e.clientY-rect.top)/rect.height*this.world.size;
   const dest=this.pos(x,z);
   const delta=dest.clone().sub(this.controls.target);
   this.controls.target.add(delta);this.camera.position.add(delta);this.controls.update();
  });
 }
 loadSave(){
  try{
   const raw=localStorage.getItem('sandforge:webgl:v1');
   if(!raw){this.message('Kein gespeicherter 3D-Spielstand');return;}
   const snapshot=JSON.parse(raw);
   if(snapshot.seed!==this.game.seed||snapshot.mapVersion!==this.game.world.mapVersion){
    location.href='/webgl-preview.html?bastions='+this.game.territories.length+'&seed='+snapshot.seed+'&resume=1';return;
   }
   location.href='/webgl-preview.html?bastions='+this.game.territories.length+'&seed='+this.game.seed+'&resume=1';
  }catch(error){this.message('Laden fehlgeschlagen: '+error.message);}
 }
 message(text){
  const notice=this.panel.querySelector('#sf-message');
  notice.removeAttribute('data-sector-event');
  notice.textContent=text;
 }
 drawInterface(){
  const g=this.game,view=this.panel,actions=view.querySelector('#sf-actions');
  const context=this.catalogContext();
  const selectionKey=[...this.selected].sort((a,b)=>a-b).join(',')+'|'+String(this.selectedBase)+'|'+Boolean(context.producer);
  const available={units:Boolean(context.producer),buildings:context.engineer,territories:true};
  if(this.catalogSelectionKey!==selectionKey||!available[view.dataset.tab]){
   view.dataset.tab=context.preferred;
   this.catalogSelectionKey=selectionKey;
   actions.scrollTop=0;actions.scrollLeft=0;
  }
  view.dataset.catalogContext=context.preferred;
  for(const tab of view.querySelectorAll('#sf-tabs [data-tab]')){
   const allowed=available[tab.dataset.tab];
   tab.hidden=!allowed;
   tab.disabled=!allowed;
   tab.setAttribute('aria-pressed',String(view.dataset.tab===tab.dataset.tab));
  }
  view.querySelector('#sf-credits').textContent=format(g.credits[0]);
  view.querySelector('#sf-income').textContent='+ '+format(g.income(0));
  view.querySelector('#sf-capacity').innerHTML=g.count(0)+' <em>/ '+RULES.capacity+'</em>';
  view.querySelector('#sf-stats').textContent='Credits '+format(g.credits[0])+' · '+g.count(0)+'/'+RULES.capacity;
  view.querySelector('#sf-sectors').textContent=g.territories.filter(t=>t.owner===0).length+' / '+g.territories.length+' SEKTOREN';
  // Rebuild only when the roster/territory markup itself changes. Credits and
  // producer availability update button states in place, preserving clicks.
  const cards=(kinds,type)=>kinds.map(kind=>{
   const spec=type==='unit'?UNITS[kind]:BUILDINGS[kind];
   const image=type==='unit'
    ?'<img data-sf-unit-icon="'+kind+'" alt="" decoding="async">'
    :'<img src="'+buildingIconUrl(kind)+'" alt="" loading="lazy" decoding="async">';
   const dataset=type==='unit'?'data-unit="'+kind+'"':'data-build="'+kind+'"';
   return '<button class="catalog-card" '+dataset+
    ' title="'+plain(spec.description)+'" aria-label="'+plain(spec.name)+' – '+spec.cost+' Credits">'+
    '<span class="sf-card-image">'+image+'</span>'+
    '<span class="card-meta"><span class="card-name">'+plain(spec.name)+
    '</span><span class="card-cost">'+spec.cost+'</span></span></button>';
  }).join('');
  const producers=[['headquarters','HAUPTQUARTIER'],['barracks','KASERNE'],['factory','FAHRZEUGFABRIK'],['airfield','FLUGFELD']];
  const roster=producers.map(([kind,label])=>
   '<section class="sf-roster-section" data-sf-producer="'+kind+'"><h2>'+label+'</h2><div class="catalog-grid">'+
   cards(unitKinds.filter(k=>UNITS[k].producers.includes(kind)),'unit')+'</div></section>').join('');
  const tiles=this.game.territories.map(t=>{
   const label=t.owner===0?'BLAU':t.owner===1?'ROT':'NEUTRAL';
   const cls=t.owner===0?'blue':t.owner===1?'red':'unknown';
   const capture=t.progress>0&&t.capturing>=0
    ?' · EROBERUNG '+Math.floor(t.progress*10)/10+' s '+(t.capturing===0?'BLAU':'ROT')
    :'';
   return '<button class="territory-row '+cls+'" data-territory="'+t.id+'" aria-label="Sektor '+(t.id+1)+' zentrieren">'+
    '<i></i><strong>SEKTOR '+(t.id+1)+'</strong><small>'+label+capture+'</small></button>';
  }).join('');
  const markup='<div class="sf-group" data-sf-group="units">'+roster+'</div>'+
   '<div class="sf-group" data-sf-group="buildings"><div class="catalog-grid">'+
   cards(buildingKinds,'building')+'</div></div>'+
   '<div class="sf-group" data-sf-group="territories"><h2>KONTROLLPUNKTE</h2>'+tiles+'</div></div>';
  if(this.previousActionsMarkup!==markup){
   const scroll=actions.scrollTop;
   actions.innerHTML=markup;this.previousActionsMarkup=markup;
   actions.scrollTop=scroll;
  }
  // The DOM keeps the complete catalogue for fast updates and icon caching,
  // but only the selected producer's section can be viewed or activated.
  for(const section of actions.querySelectorAll('[data-sf-producer]'))
   section.hidden=!context.producer||section.dataset.sfProducer!==context.producer.kind;
  for(const button of actions.querySelectorAll('button[data-unit],button[data-build]')){
   const kind=button.dataset.unit??button.dataset.build;
   const spec=button.dataset.unit?UNITS[kind]:BUILDINGS[kind];
   const correctProducer=context.producer&&UNITS[kind]?.producers.includes(context.producer.kind);
   const unavailable=button.dataset.unit
    ?!correctProducer||g.needsHeadquarters(0)||context.producer.queue.length>=8||
      g.credits[0]<spec.cost||g.count(0)+g.queued(0)>=RULES.capacity
    :!context.engineer||g.credits[0]<spec.cost||!g.hasHeadquarters(0)&&kind!=='headquarters';
   const requirement=button.dataset.unit
    ?(!context.producer?'Produktionsgebäude auswählen':
       !correctProducer?'Dieses Gebäude produziert diese Einheit nicht':
       g.needsHeadquarters(0)?'Feldkommando erforderlich':
       context.producer.queue.length>=8?'Warteschlange voll':
       g.credits[0]<spec.cost?'Zu wenig Credits':
       g.count(0)+g.queued(0)>=RULES.capacity?'Einheitenlimit erreicht':'')
    :(!context.engineer?'Pionier auswählen':
       !g.hasHeadquarters(0)&&kind!=='headquarters'?'Hauptquartier zuerst fertigstellen':
       g.credits[0]<spec.cost?'Zu wenig Credits':
       kind==='headquarters'&&!g.needsHeadquarters(0)?'Hauptquartier bereits vorhanden':'');
   // Completed buildings alone unlock production. A construction site does not.
   const blocked=unavailable||(button.dataset.build==='headquarters'&&!g.needsHeadquarters(0));
   if(button.disabled!==blocked)button.disabled=blocked;
   button.classList.toggle('locked',blocked);
   const explanation=requirement||spec.description;
   if(button.title!==explanation)button.title=explanation;
   if(blocked)button.setAttribute('aria-description',explanation);
   else button.removeAttribute('aria-description');
   button.classList.toggle('sf-selected-build',button.dataset.build===this.buildKind);
  }
  hydrateUnitIcons(actions);
  const queuedBases=g.bases.filter(b=>b.owner===0&&b.hp>0&&b.queue?.length);
  const queues=queuedBases.reduce((sum,b)=>sum+b.queue.length,0);
  const constructionSites=g.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining>0);
  const producer=queuedBases.find(b=>b.id===this.selectedBase)??queuedBases[0];
  const duration=producer?.queue?.[0]??1;
  // Simulation accumulates b.production from zero up to queue[0].
  const progress=producer?Math.max(0,Math.min(100,100*producer.production/Math.max(0.001,duration))):0;
  view.querySelector('#sf-progress').style.width=progress.toFixed(1)+'%';
  const currentKind=producer?.queueTypes?.[0];
  const currentName=currentKind?UNITS[currentKind]?.name??currentKind:'';
  view.querySelector('#sf-queue-count').textContent=queues+' PRODUKTION · '+constructionSites.length+' BAU';
  view.querySelector('#sf-queue').textContent=producer
   ?BUILDINGS[producer.kind].name+': '+currentName+' ('+producer.queue.length+' Aufträge)'
   :constructionSites.length?constructionSites.map(b=>BUILDINGS[b.kind].name+' (im Bau)').join(' · ')
   :'WARTESCHLANGE LEER';
  const remaining=producer?Math.max(0,duration-producer.production):0;
  view.querySelector('#sf-queue-time').textContent=producer?Math.ceil(remaining)+' s':'--:--';
  const buildingStatus=view.querySelector('#sf-building-status');
  if(buildingStatus){
   buildingStatus.hidden=!constructionSites.length;
   buildingStatus.textContent=constructionSites.map(b=>{
    const total=BUILDINGS[b.kind]?.buildTime??1;
    const pct=Math.round(Math.max(0,Math.min(100,100*(1-b.buildRemaining/Math.max(0.001,total)))));
    return BUILDINGS[b.kind].name+' '+pct+'%';
   }).join(' · ');
  }
  const el=view.querySelector('#sf-selection');
  const chosen=g.units.filter(u=>this.selected.has(u.id)&&u.hp>0);
  const base=g.bases.find(b=>b.id===this.selectedBase&&b.hp>0);
  const rallyButton=view.querySelector('#sf-rally');
  if(rallyButton){
   rallyButton.hidden=!base||base.owner!==0||base.buildRemaining>0;
   rallyButton.setAttribute('aria-pressed',String(this.rallyMode));
  }
  const rally=base?.rally;
  this.rallyMarker.visible=Boolean(rally&&base.owner===0);
  if(this.rallyMarker.visible)this.rallyMarker.position.copy(this.pos(rally.x,rally.y,this.heightAt(rally.x,rally.y)+5));
  const item=chosen.length===1?chosen[0]:base;
  const kind=item?.kind;
  const spec=item?(item.queue?BUILDINGS[kind]:UNITS[kind]):null;
  const heading=chosen.length>1?chosen.length+' Einheiten ausgewählt':spec?.name??'Keine Auswahl';
  const hp=item?Math.max(0,Math.ceil(item.hp)):0;
  const maxHp=spec?.hp??1;
  const meta=chosen.length?'BLAUE LEGION / TRUPP':'BLAUE LEGION / STÜTZPUNKT';
  const description=base?.rally
   ?'Sammelpunkt aktiv · Neue Einheiten marschieren automatisch zum markierten Ziel.'
   :spec?.description??'Wähle eine Einheit oder ein Gebäude. Rechtsklick: Marsch oder Zielbefehl.';
  const selectedMarkup='<small>'+meta+'</small><strong>'+plain(heading)+'</strong>'+
   (item?'<div class="health-track"><i style="width:'+Math.min(100,hp/maxHp*100)+'%"></i></div>'+
   '<div class="sf-health">'+hp+' / '+maxHp+' LP</div>':'')+
   '<p>'+plain(description)+'</p>';
  if(this.previousSelectionMarkup!==selectedMarkup){
   el.innerHTML=selectedMarkup;this.previousSelectionMarkup=selectedMarkup;
  }
  const portrait=view.querySelector('#sf-portrait');
  const portraitKey=item?(item.queue?'building:':'unit:')+kind:'building:headquarters';
  if(this.previousPortraitKey!==portraitKey){
   this.previousPortraitKey=portraitKey;
   if(item&&!item.queue){
    // Use the same cropped idle portrait as in the unit roster.
    unitIcon(kind).then(url=>{
     if(this.previousPortraitKey===portraitKey)portrait.src=url;
    }).catch(error=>console.warn('Portrait fallback',error));
    portrait.src='/src/assets/reborn/infantry-grounded-v3.png';
   }else portrait.src=buildingIconUrl(item?.kind??'headquarters');
  }
  view.querySelector('[data-action="attack"]').setAttribute('aria-pressed',String(this.attackMode));
  view.querySelector('#sf-catalog-detail').textContent=
   spec?.description??'Einheiten auswählen · Rechtsklick bewegen · Pionier für Gebäude erforderlich.';
  if(g.status!=='playing')this.message(g.status==='victory'?'SIEG – alle Gegner besiegt':'NIEDERLAGE');
 }
 drawMinimap(){
  const ctx=this.mini.getContext('2d');if(!ctx)return;
  const width=this.mini.width,height=this.mini.height,map=this.world;
  ctx.fillStyle='#c9a576';ctx.fillRect(0,0,width,height);
  const cell=map.blocked.length?map.size/RULES.grid:20,scale=width/map.size;
  ctx.fillStyle='#705741';
  for(let iy=0;iy<RULES.grid;iy+=3)for(let ix=0;ix<RULES.grid;ix+=3){
   if(map.blocked[iy*RULES.grid+ix])ctx.fillRect(ix/ RULES.grid*width,iy/RULES.grid*height,3*width/RULES.grid,3*height/RULES.grid);
  }
  for(const t of this.game.territories){
   ctx.fillStyle=t.owner===0?colors.blue:t.owner===1?colors.red:'#eed3a0';
   ctx.beginPath();ctx.arc(t.point.x*scale,t.point.y*scale,3,0,Math.PI*2);ctx.fill();
   if(t.progress>0&&t.capturing>=0){
    ctx.lineWidth=2;ctx.strokeStyle=t.capturing===0?'#53f4e2':'#ff7151';
    ctx.beginPath();ctx.arc(t.point.x*scale,t.point.y*scale,6,0,Math.PI*2);ctx.stroke();
   }
  }
  for(const u of this.game.units)if(u.hp>0&&(u.owner===0||this.game.canSee(0,u))){
   ctx.fillStyle=u.owner===0?'#53f4e2':'#ff7151';
   ctx.fillRect(u.x*scale-1.3,u.y*scale-1.3,3,3);
  }
  if(this.fogEnabled){
   for(let iy=0;iy<RULES.grid;iy+=4)for(let ix=0;ix<RULES.grid;ix+=4){
    const index=iy*RULES.grid+ix,alpha=this.game.visible[0][index]?0:this.game.explored[0][index]?.82:1;
    if(!alpha)continue;ctx.fillStyle='rgba(0,0,0,'+alpha+')';
    ctx.fillRect(ix/RULES.grid*width,iy/RULES.grid*height,width/RULES.grid*4,height/RULES.grid*4);
   }
  }
  const origin=this.controls.target;
  ctx.strokeStyle='#fff7d8';ctx.strokeRect((origin.x+map.size*.5)*scale-11,(origin.z+map.size*.5)*scale-11,22,22);
 }
 selectBoxUnits(x0,y0,x1,y1,append=false){
  const rect=this.renderer.domElement.getBoundingClientRect();
  const left=Math.min(x0,x1),right=Math.max(x0,x1);
  const top=Math.min(y0,y1),bottom=Math.max(y0,y1);
  if(!append)this.selected.clear();
  for(const u of this.game.units){
   if(u.hp<=0||u.carrier||u.owner!==0)continue;
   const entry=this.units.get(u.id);if(!entry)continue;
   const p=entry.node.position.clone().project(this.camera);
   const x=(p.x*.5+.5)*rect.width+rect.left,y=(.5-p.y*.5)*rect.height+rect.top;
   if(x>=left&&x<=right&&y>=top&&y<=bottom)this.selected.add(u.id);
  }
  this.selectedBase=null;this.drawInterface();
 }
 terrainPoint(event){
  const rect=this.renderer.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
  const hits=ray.intersectObjects(this.groundMeshes,false);
  if(!hits.length)return null;
  const p=hits[0].point;return {x:p.x+this.world.size*.5,y:p.z+this.world.size*.5};
 }
 friendlyAtPointer(event){
  // Select the model under the cursor instead of a displaced terrain hit.
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const ndc=new THREE.Vector2(
   (event.clientX-rect.left)/rect.width*2-1,
   1-(event.clientY-rect.top)/rect.height*2
  );
  const candidates=[];
  for(const unit of this.game.units){
   if(unit.owner!==0||unit.hp<=0||unit.carrier)continue;
   const entry=this.units.get(unit.id);
   if(entry?.node.visible)candidates.push({entity:unit,node:entry.node,type:'unit'});
  }
  for(const base of this.game.bases){
   if(base.owner!==0||base.hp<=0)continue;
   const entry=this.bases.get(base.id);
   if(entry?.node.visible)candidates.push({entity:base,node:entry.node,type:'base'});
  }
  if(!candidates.length)return null;
  this.camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(ndc,this.camera);
  const owners=new Map(candidates.map(candidate=>[candidate.node,candidate]));
  for(const hit of ray.intersectObjects(candidates.map(candidate=>candidate.node),true)){
   let node=hit.object;
   while(node&&!owners.has(node))node=node.parent;
   if(node)return owners.get(node);
  }
  // Tiny infantry are still selectable at wide tactical zoom.
  const projected=new THREE.Vector3();
  let best=null,bestDistance=Infinity;
  for(const candidate of candidates){
   const y=candidate.type==='unit'?30:Math.min(75,(BUILDINGS[candidate.entity.kind]?.width??130)*.40);
   projected.copy(candidate.node.position);projected.y+=y;
   projected.project(this.camera);
   if(projected.z<-1||projected.z>1)continue;
   const px=rect.left+(projected.x+1)*rect.width*.5;
   const py=rect.top+(1-projected.y)*rect.height*.5;
   const distance=Math.hypot(event.clientX-px,event.clientY-py);
   const radius=candidate.type==='unit'?Math.max(20,22*this.camera.zoom)
    :Math.max(25,Math.min(70,54*this.camera.zoom));
   if(distance<=radius&&distance<bestDistance){best=candidate;bestDistance=distance;}
  }
  return best;
 }
 enemyAtPointer(event){
  // Resolve visible enemy models before terrain: clicking a soldier or a tank
  // must issue an ATTACK order, not a ground-move order.
  const targets=[];
  for(const u of this.game.units){
   if(u.owner===0||u.hp<=0||u.carrier||!this.game.canSee(0,u))continue;
   const entry=this.units.get(u.id);
   if(entry?.node.visible)targets.push({entity:u,node:entry.node,isUnit:true});
  }
  for(const b of this.game.bases){
   if(b.owner===0||b.hp<=0||!this.game.canSee(0,b))continue;
   const entry=this.bases.get(b.id);
   if(entry?.node.visible)targets.push({entity:b,node:entry.node,isUnit:false});
  }
  if(!targets.length)return null;
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const ndc=new THREE.Vector2(
   (event.clientX-rect.left)/rect.width*2-1,
   1-(event.clientY-rect.top)/rect.height*2
  );
  this.camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(ndc,this.camera);
  const rootOf=new Map(targets.map(target=>[target.node,target]));
  const hits=ray.intersectObjects(targets.map(target=>target.node),true);
  for(const hit of hits){
   let node=hit.object;
   while(node&&!rootOf.has(node))node=node.parent;
   if(node)return rootOf.get(node).entity;
  }
  // Projected pick radius lets tiny infantry remain clickable at wide RTS zoom.
  let nearest=null,nearestDist=Infinity;
  const projected=new THREE.Vector3();
  for(const t of targets){
   const x=t.node.position.x,y=t.node.position.y+(t.isUnit?28:50),z=t.node.position.z;
   projected.set(x,y,z).project(this.camera);
   if(projected.z<-1||projected.z>1)continue;
   const px=rect.left+(projected.x+1)*rect.width*.5;
   const py=rect.top+(1-projected.y)*rect.height*.5;
   const distance=Math.hypot(event.clientX-px,event.clientY-py);
   const radius=t.isUnit?Math.max(12,Math.min(30,16*this.camera.zoom)):Math.max(22,Math.min(52,30*this.camera.zoom));
   if(distance<=radius&&distance<nearestDist){nearest=t.entity;nearestDist=distance;}
  }
  return nearest;
 }
 showCommandPulse(point,attack=false){
  this.commandPulse.position.copy(this.pos(point.x,point.y,
   this.heightAt(point.x,point.y)+2.8));
  this.commandPulse.material.color.set(attack?'#ffbd76':'#7ce7ef');
  this.commandPulse.scale.setScalar(.72);
  this.commandPulse.material.opacity=.9;
  this.commandPulseTime=0;this.commandPulse.visible=true;
 }
 updateCommandPulse(dt){
  if(!this.commandPulse.visible)return;
  this.commandPulseTime+=Math.max(0,dt);
  const t=Math.min(1,this.commandPulseTime/.65);
  this.commandPulse.scale.setScalar(.72+t*.78);
  this.commandPulse.material.opacity=.9*(1-t)*(1-t);
  if(t>=1)this.commandPulse.visible=false;
 }
 pointerUp(event){
  if(!this.clickStart||event.button!==this.clickStart.button)return;
  const start=this.clickStart;
  const moved=Math.hypot(event.clientX-start.x,event.clientY-start.y);
  this.clickStart=null;this.selectionBox.style.display='none';
  if(moved>7){
   if(event.button===0)this.selectBoxUnits(start.x,start.y,event.clientX,event.clientY,event.shiftKey);
   return;
  }
  if(event.button===2&&this.buildKind){
   this.clearPlacement();this.message('Bauplatzwahl abgebrochen');this.drawInterface();return;
  }
  // Do not require a terrain hit underneath a tall enemy model.
  const clickedEnemy=event.button===2&&this.selected.size?this.enemyAtPointer(event):null;
  const p=clickedEnemy?{x:clickedEnemy.x,y:clickedEnemy.y}:this.terrainPoint(event);
  if(!p){
   if(event.button===2&&this.selected.size)this.message('Marschziel außerhalb der Karte');
   return;
  }
  // Immediate acknowledgment, including an unselected RMB click; no pulse
  // for clicks outside the terrain or for a right-button drag.
  if(event.button===2)this.showCommandPulse(p,Boolean(clickedEnemy)||this.attackMode);
  if(event.button===0){
   if(!this.rallyMode&&!this.buildKind){
    const hit=this.friendlyAtPointer(event);
    if(hit){
     if(hit.type==='unit'){
      if(!event.shiftKey)this.selected.clear();
      if(event.shiftKey&&this.selected.has(hit.entity.id))this.selected.delete(hit.entity.id);
      else this.selected.add(hit.entity.id);
      this.selectedBase=null;
     }else{
      this.selected.clear();this.selectedBase=hit.entity.id;
     }
     this.rallyMode=false;this.sound?.select?.();this.drawInterface();return;
    }
   }
   if(this.rallyMode){
    const base=this.game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
    this.rallyMode=false;
    if(base){base.rally={x:p.x,y:p.y};this.message('Sammelpunkt gesetzt: '+BUILDINGS[base.kind].name);}
    else this.message('Produktionsgebäude nicht mehr verfügbar');
    this.drawInterface();return;
   }
   if(this.buildKind){
    const kind=this.buildKind,workerIds=this.game.units.filter(u=>this.selected.has(u.id)&&u.kind==='engineer'&&u.owner===0).map(u=>u.id);
    const blocked=this.game.buildError(0,kind,p);
    if(blocked){this.message(blocked);return;}
    const result=this.game.build(0,kind,p,workerIds.length?workerIds:undefined,this.placementFacing,event.shiftKey);
    if(result){
     this.sound?.command?.();this.message(BUILDINGS[kind].name+' beauftragt');
     if(!event.shiftKey)this.clearPlacement();
     this.sync(true);
    }else this.message('Kein verfügbarer Pionier oder keine Route zum Bauplatz');
    return;
   }
   const near=this.game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier).map(u=>({u,d:dist(u,p)})).sort((a,b)=>a.d-b.d)[0];
   if(near&&near.d<Math.max(45,unitSpec(near.u).radius+25)){
    if(!event.shiftKey)this.selected.clear();
    if(this.selected.has(near.u.id)&&event.shiftKey)this.selected.delete(near.u.id);
    else this.selected.add(near.u.id);
    this.sound?.select?.();
    this.selectedBase=null;this.rallyMode=false;this.drawInterface();return;
   }
   const base=this.game.bases.filter(b=>b.owner===0&&b.hp>0).map(b=>({b,d:dist(b,p)})).sort((a,b)=>a.d-b.d)[0];
   if(base&&base.d<base.b.radius+55){this.selectedBase=base.b.id;this.rallyMode=false;this.selected.clear();this.drawInterface();return;}
   if(!event.shiftKey){this.selected.clear();this.selectedBase=null;this.drawInterface();}
  }else if(event.button===2){
   // Classic parity: selected production building + RMB sets rally directly.
   if(this.selectedBase!==null){
    const base=this.game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
    if(base){
     base.rally=this.world.nearest(p,this.game.obstacles());
     this.rallyMode=false;
     this.message('Sammelpunkt gesetzt: '+BUILDINGS[base.kind].name);
     this.sound?.command?.();
     this.drawInterface();return;
    }
   }
   if(!this.selected.size)return;
   const ids=[...this.selected],kind=clickedEnemy?'attack':this.attackMode?'attackMove':'move';
   const order={x:p.x,y:p.y,kind,...(clickedEnemy?{target:clickedEnemy.id}:{})};
   const accepted=this.game.command(ids,order,event.shiftKey);
   this.message(accepted?accepted+' Einheit(en): '+(clickedEnemy?'Ziel angreifen':this.attackMode?'Angriff':'Marsch'):'Ziel nicht erreichbar');
   if(accepted){
    this.sound?.command?.(kind!=='move');
    const unit=this.game.units.find(u=>ids.includes(u.id)&&u.owner===0&&u.hp>0);
    if(unit)this.sound?.acknowledge?.({kind:kind!=='move'?'attack':'move',unit:unit.kind,unitId:unit.id},this.game);
   }
   this.attackMode=false;
  }
 }
 attachInput(){
  // The left mouse button belongs to RTS selection; middle mouse pans and
  // right-drag rotates. A right *click* issues a command.
  // OrbitControls must never capture RMB: that caused right-click movement
  // to be consumed/turned into rotation on some browsers. Q/E handles turning.
  this.controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:null};
  const canvas=this.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{
   this.clickStart={x:e.clientX,y:e.clientY,button:e.button};
   // The Canvas RTS issues right-click commands on press, not release.
   // With RMB rotation disabled this also supports Mac trackpad clicks.
   if(e.button===2){e.preventDefault();this.pointerUp(e);}
  });
  canvas.addEventListener('pointermove',e=>{
   if(this.buildKind)this.updatePlacementPreview(e);
   const start=this.clickStart;
   if(!start||start.button!==0||!(e.buttons&1))return;
   if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<7)return;
   Object.assign(this.selectionBox.style,{
    display:'block',left:Math.min(start.x,e.clientX)+'px',
    top:Math.min(start.y,e.clientY)+'px',
    width:Math.abs(e.clientX-start.x)+'px',
    height:Math.abs(e.clientY-start.y)+'px'
   });
  });
  canvas.addEventListener('pointerup',e=>this.pointerUp(e));
  window.addEventListener('pointerup',e=>{if(this.clickStart)this.pointerUp(e);});
  canvas.addEventListener('pointerleave',()=>{if(this.buildPreview)this.buildPreview.visible=false;this.buildHint.style.display='none';});
  canvas.addEventListener('pointercancel',()=>{
   this.clickStart=null;this.selectionBox.style.display='none';
  });
  // Prevent the native menu without routing duplicate commands. Every
  // pointerup, including a normal RMB click, reaches pointerUp() unchanged.
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  // Handle Escape during capture: the original menu/toolbar may stop
  // propagation before a document-level listener receives the event.
  // The HUD settings dialog has its own earlier capture handler and
  // consumes Escape first when that dialog is open.
  window.addEventListener('keydown',event=>{
   if(event.code!=='Escape'||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(!this.rallyMode&&!this.buildKind&&!this.attackMode)return;
   event.preventDefault();
   this.clearPlacement();
   this.attackMode=false;
   this.rallyMode=false;
   this.drawInterface();
  },true);
  document.addEventListener('keydown',event=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(event.code==='KeyR'&&this.buildKind){
    event.preventDefault();this.placementFacing=this.placementFacing===0?1:0;
    if(this.buildPreview)this.buildPreview.rotation.y=this.placementFacing?Math.PI:0;
    this.sound?.select?.();this.message('Gebäude '+(this.placementFacing?'gedreht':'Standardausrichtung'));
   }
   if(event.code==='KeyF'){this.attackMode=true;this.message('Angriffsbewegung: Rechtsklick auf Ziel');}
   if(event.code==='KeyH'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.drawInterface();}
   const number=Number(event.code.replace('Digit',''));
   if(event.code.startsWith('Digit')&&number>=1&&number<=5){
    if(event.ctrlKey||event.metaKey){event.preventDefault();this.groups.set(number,new Set(this.selected));this.message('Gruppe '+number+' gespeichert');}
    else if(this.groups.has(number)){this.selected=new Set([...this.groups.get(number)].filter(id=>this.units.has(id)));this.drawInterface();}
   }
  });
 }
}
