import * as THREE from 'three';
import {SandforgeProductionGates} from '/webgl-production-gates.js';
import {nextPeriodicRefresh} from '/webgl-frame-scheduling.js';
import {wheelsShouldRoll} from '/webgl-wheel-motion.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {UNITS,BUILDINGS,MAX_GENERATORS_PER_FACTION,unitKinds,buildingKinds,unitSpec,buildingSpec} from '/src/reborn/catalog.js';
import {TERRAIN_LABELS} from '/src/reborn/battlefield-terrain.js';
import {RULES} from '/src/reborn/config.js';
import {installClassicHud} from '/webgl-classic-hud.js';
import {hydrateUnitIcons,hydrateBuildingIcons,unitIcon,buildingIcon,buildingIconUrl,researchIconMarkup,researchEffectLabel,hydrateResearchArtworks} from '/webgl-portraits.js';
import {SandforgeActorPresentation} from '/webgl-actor-presentation.js';
import {calibratedScale,visualUnitScale,unitVisualYaw,unitRenderAltitude,buildingFacingAngle,nextBuildingFacing,buildingFacingDegrees,turretAimLocalYaw} from '/webgl-scale.js';
import {SandforgeGroundingPass} from '/webgl-grounding.js';
import {createBuildingYard,disposeBuildingYard} from '/webgl-building-yard.js';
import {disposeOwnedMeshes,disposeTaggedMaterials} from '/webgl-resource-lifecycle.js';
import {selectedInfantryForTransport,selectedLoadedTransports,selectedTransportManifest} from '/webgl-transport-controls.js';
import {pointerGestureIntent,availableEngineers,shouldAppendBuild,nearestEngineer,POINTER_CLICK_SLOP} from '/webgl-builder-input.js';
import {sameKindVisibleUnits} from '/webgl-double-click-select.js';
import {tracerWindow} from '/webgl-hit-response.js';
import {applyFactionAccents} from '/webgl-faction-accents.js';
import {SandforgeConstructionPresentation} from '/webgl-construction.js';
import {createBastionCaptureBar,updateBastionCaptureBar} from '/webgl-bastion-capture.js';
import {snapToPlayableEdge,worldToMinimap} from '/webgl-map-edges.js';
import {attackBlinkAlpha} from '/src/reborn/attack-alerts.js';
import {UPGRADES,UPGRADE_KINDS,canResearchUpgrade,INTERCEPTOR_ENABLED,SILO_CHARGE_SECONDS,INTERCEPTOR_MAX_AMMO,INTERCEPTOR_REARM_COST} from '/src/reborn/strategic-tech.js';
import {createStrategicBuilding,isStrategicBuilding} from '/webgl-strategic-buildings.js';

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
  this.strategicTargetMode=false;
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
  this.productionGates=new SandforgeProductionGates(this);
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
  // Fixed-size, reusable GPU buffer: the previous code created two new
  // BufferAttributes every render frame (and old GPU buffers accumulated).
  // No per-frame geometry allocation even after hours of large battles.
  this.maxTracerShots=110;
  const tracerGeometry=new THREE.BufferGeometry();
  this.tracerPositions=new THREE.Float32BufferAttribute(
   new Float32Array(this.maxTracerShots*6),3).setUsage(THREE.DynamicDrawUsage);
  this.tracerColors=new THREE.Float32BufferAttribute(
   new Float32Array(this.maxTracerShots*6),3).setUsage(THREE.DynamicDrawUsage);
  tracerGeometry.setAttribute('position',this.tracerPositions);
  tracerGeometry.setAttribute('color',this.tracerColors);
  tracerGeometry.setDrawRange(0,0);
  this.tracer=new THREE.LineSegments(tracerGeometry,
    new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.96,depthWrite:false}));
  this.tracer.frustumCulled=false;scene.add(this.tracer);
  this.buildInterface();this.addFog();this.createBastions();
  this.attachInput();this.sync(true);
 }
 entityPosition(p){return this.pos(p.x,p.y,this.heightAt(p.x,p.y)+unitRenderAltitude(p.kind,p.flightHeight??1));}
 createFallback(kind,owner,type){
  if(type==='building'&&isStrategicBuilding(kind))return createStrategicBuilding(kind,owner);
  const group=new THREE.Group(),team=owner===0?'#397f9d':'#9f5541',metal=new THREE.MeshStandardMaterial({color:team,metalness:.55,roughness:.53}),
   dark=new THREE.MeshStandardMaterial({color:'#444743',metalness:.45,roughness:.7});
  // Placeholder structures use the same gentle ambient lift as detailed GLBs.
  // Materials are local to this fallback; soldier/vehicle surfaces stay untouched.
  if(type==='building'){
   for(const material of [metal,dark]){
    material.emissive.copy(material.color);
    material.emissiveIntensity=.065;
   }
  }
  const make=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  if(type==='unit'){
   if(['tank','rover','artillery'].includes(kind)){
    const length=kind==='tank'?77:kind==='artillery'?84:57;
    make(new THREE.BoxGeometry(44,15,length),metal,0,16,0);
    if(kind==='tank'){
     // Keep the turret and gun independently steerable while GLB is loading.
     const turret=new THREE.Group();turret.name='Tank_Turret';group.add(turret);
     const cap=new THREE.Mesh(new THREE.BoxGeometry(32,12,length*.45),dark);
     cap.position.set(0,30,-2);cap.castShadow=true;turret.add(cap);
     const gun=new THREE.Group();gun.name='Tank_Gun';group.add(gun);
     const tube=new THREE.Mesh(new THREE.CylinderGeometry(2.5,3.2,37,10),dark);
     tube.rotation.x=Math.PI/2;tube.position.set(0,29,27);
     tube.castShadow=true;gun.add(tube);
    }else if(kind==='artillery'){
     // The lite-mode rocket launcher must look and behave like a six-tube
     // launcher, not a generic MG truck while its authored GLB is absent.
     const turret=new THREE.Group();turret.name='Tank_Turret';group.add(turret);
     const gun=new THREE.Group();gun.name='Tank_Gun';turret.add(gun);
     const pod=new THREE.Mesh(new THREE.BoxGeometry(36,16,42),metal);
     pod.position.set(0,39,0);pod.castShadow=true;gun.add(pod);
     for(let row=0;row<2;row++)for(let col=0;col<3;col++){
      const index=row*3+col,x=(col-1)*10,y=35+row*8;
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.4,42,12),dark);
      tube.rotation.x=Math.PI/2;tube.position.set(x,y,0);tube.castShadow=true;
      gun.add(tube);
      const muzzle=new THREE.Object3D();
      muzzle.name='RocketMuzzle_'+index;
      muzzle.position.set(x,y,26);gun.add(muzzle);
     }
    }else make(new THREE.BoxGeometry(32,12,length*.45),dark,0,30,0);
    for(const x of [-22,22])for(const z of [-length*.33,length*.33])make(new THREE.CylinderGeometry(10,10,7,12),dark,x,9,z).rotation.z=Math.PI*.5;
   }else if(['scout','bomber'].includes(kind)){
    make(new THREE.CapsuleGeometry(13,36,4,8),metal,0,15,0).rotation.x=Math.PI*.5;
    make(new THREE.BoxGeometry(95,2,15),dark,0,18,0);
   }else if(kind==='medic'){
    // Human medical fallback while the authored soldier GLB streams in.
    const cloth=new THREE.MeshStandardMaterial({color:owner===0?'#b9afa0':'#ac8276',roughness:.86}),
     armor=new THREE.MeshStandardMaterial({color:owner===0?'#385d67':'#805044',roughness:.7}),
     white=new THREE.MeshStandardMaterial({color:'#eae4d6',roughness:.82}),
     cross=new THREE.MeshStandardMaterial({color:'#ca3035',roughness:.76});
    make(new THREE.BoxGeometry(17,20,12),cloth,0,22,0);
    for(const x of [-5.5,5.5]){
     make(new THREE.BoxGeometry(5,17,7),cloth,x,5,0);
     make(new THREE.BoxGeometry(5,15,6),armor,x*1.8,23,-.5);
    }
    make(new THREE.SphereGeometry(7.5,10,8),cloth,0,39,0);
    make(new THREE.SphereGeometry(9,10,8,0,Math.PI*2,0,Math.PI*.53),armor,0,43,0);
    make(new THREE.BoxGeometry(14,17,6),white,0,23,8.5);
    make(new THREE.BoxGeometry(3,11,1),cross,0,23,12);
    make(new THREE.BoxGeometry(10,3,1),cross,0,23,12.1);
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
  // Medics always load their authored 3D soldier, even in lite mode.
  if((this.lite&&type!=='building'&&entity.kind!=='medic')||
     type==='building'&&isStrategicBuilding(entity.kind)||entry.requested||
     this.loadingCount+this.modelQueue.length>=this.maxModels)return;
  entry.requested=true;
  const url=this.asset(entity.kind,entity.owner,type);
  if(type==='unit'&&entity.kind==='medic')this.modelQueue.unshift({url,entry,type});
  else this.modelQueue.push({url,entry,type});
  this.pumpModelQueue();
 }
 // Render-only ambient fill for authored building and bastion GLBs.
 // Reuse the model's own albedo texture so the shaded facades brighten
 // without flattening metal panels, camo or the surrounding desert.
 // Clone material instances per model: cached glTF templates, soldiers,
 // vehicles, fog, shadow casting and gameplay all remain unchanged.
 lightBuildingMeshes(root){
  const materials=new Map();
  const brighten=original=>{
   if(!original?.isMeshStandardMaterial)return original;
   if(materials.has(original))return materials.get(original);
   const material=original.clone();
   if(material.map){
    material.emissive.setRGB(1,1,1);
    material.emissiveMap=material.map;
   }else material.emissive.copy(material.color);
   material.emissiveIntensity=.22;
   material.userData={...material.userData,sandforgeBuildingFill:true};
   material.needsUpdate=true;
   materials.set(original,material);
   return material;
  };
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   mesh.castShadow=true;mesh.receiveShadow=true;
   mesh.material=Array.isArray(mesh.material)
    ?mesh.material.map(brighten):brighten(mesh.material);
  });
 }
 // The authored tank exposes two rigid GLB nodes, Tank_Turret and
 // Tank_Gun. Handle both sibling and parented variations of the rig.
 installTankRig(entry,model){
  if(entry.kind!=='tank'&&entry.kind!=='artillery')return;
  const turret=model.getObjectByName('Tank_Turret');
  const gun=model.getObjectByName('Tank_Gun');
  let gunNested=false;
  if(turret&&gun)for(let p=gun.parent;p;p=p.parent)if(p===turret){gunNested=true;break;}
  entry.tankRig={turret,gun,gunNested,
   turretRest:turret?.rotation.y??0,gunRest:gun?.rotation.y??0};
  if(entry.kind==='artillery')
   entry.rocketMuzzles=Array.from({length:6},(_,i)=>model.getObjectByName('RocketMuzzle_'+i));
 }
 orientTankRig(entry,unit){
  const hull=Number.isFinite(unit.hullAngle)?unit.hullAngle:unit.angle;
  const gun=Number.isFinite(unit.angle)?unit.angle:hull;
  // Local +Z points forwards. The outer actor follows the slower physical
  // hullAngle; both rigid gun groups independently track the aimed bearing.
  const relative=hull-gun;
  const rig=entry.tankRig;
  if(rig?.turret)rig.turret.rotation.y=rig.turretRest+relative;
  if(rig?.gun&&!rig.gunNested)rig.gun.rotation.y=rig.gunRest+relative;
 }
 // Restore authored building activity. Clip-controlled rotors get driven by
 // authoritative turretAngle; exported static models receive an unobtrusive
 // procedural animated attachment instead of freezing permanently.
 createMechanicalRotor(kind,height,width=105){
  const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial({
   color:kind==='turret'?'#777f79':'#a9b6ad',metalness:.68,roughness:.42
  });
  const dark=new THREE.MeshStandardMaterial({color:'#303c42',metalness:.65,roughness:.6});
  if(kind==='turret'){
   const body=new THREE.Mesh(new THREE.CylinderGeometry(13,17,8,12),mat);
   body.castShadow=true;root.add(body);
   for(const x of [-5.5,5.5]){
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.3,31,8),dark);
    barrel.rotation.x=Math.PI/2;barrel.position.set(x,1,-23);
    barrel.castShadow=true;root.add(barrel);
    const muzzle=new THREE.Object3D();
    muzzle.name=x<0?'TurretMuzzleL':'TurretMuzzleR';
    muzzle.position.set(x,1,-39);root.add(muzzle);
   }
  }else{
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.6,16,8),dark);
   pole.position.y=6;root.add(pole);
   const frame=new THREE.Mesh(new THREE.BoxGeometry(29,2.2,6),mat);
   frame.position.y=15;frame.rotation.z=-.2;frame.castShadow=true;root.add(frame);
   for(const x of [-12,12]){
    const reflector=new THREE.Mesh(new THREE.BoxGeometry(2,15,5),mat);
    reflector.position.set(x,16,0);reflector.castShadow=true;root.add(reflector);
   }
  }
  root.position.set(kind==='turret'?0:width*.18,height*(kind==='turret'?.84:.78),kind==='turret'?0:-width*.12);
  root.name='sandforge-animated-'+(kind==='turret'?'gun':'radar');
  root.userData={visualOnly:true,mechanicalMotion:true};
  return root;
 }
 attachBuildingMotion(entry,data){
  if(!['turret','headquarters'].includes(entry.kind))return;
  // Read the actual glTF hierarchy instead of sampling an animation by
  // elapsed time: the two visible imported barrels face local +Z, while
  // the old animation sampling assumed local +X and drifted by 90 degrees.
  if(entry.kind==='turret'){
   const head=entry.detail?.getObjectByName('TurretHead');
   if(head){
    const left=entry.detail.getObjectByName('TurretMuzzleL');
    const right=entry.detail.getObjectByName('TurretMuzzleR');
    entry.motion={kind:'turret',rotor:head,muzzles:left&&right?[left,right]:null,
     mode:'authored-rig'};
    return;
   }
  }
  if(entry.kind==='headquarters'){
   const clip=data.animations?.find(c=>c.name==='RadarSpin');
   if(clip?.tracks?.length){
    const mixer=new THREE.AnimationMixer(entry.detail),action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat,Infinity);action.play();
    entry.motion={kind:'headquarters',mixer,clip,action,mode:'authored'};
    return;
   }
  }
  const rotor=this.createMechanicalRotor(entry.kind,entry.modelHeight,BUILDINGS[entry.kind].width);
  entry.node.add(rotor);
  entry.motion={kind:entry.kind,rotor,
   muzzles:entry.kind==='turret'?
    [rotor.getObjectByName('TurretMuzzleL'),rotor.getObjectByName('TurretMuzzleR')]:null,
   mode:'fallback'};
 }
 animateBuildingMotion(entry,base,dt,active){
  const motion=entry.motion;
  if(!motion||base.buildRemaining>0)return;
  if(motion.kind==='turret'){
   const angle=Number.isFinite(base.turretAngle)?base.turretAngle:0;
   if(motion.rotor)motion.rotor.rotation.y=turretAimLocalYaw(angle,base.facing,motion.mode==='fallback');
  }else if(active){
   if(motion.mixer)motion.mixer.update(dt);
   else if(motion.rotor)motion.rotor.rotation.y+=dt*.52;
  }
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
    if(type==='building')this.lightBuildingMeshes(model);
    else model.traverse(o=>{
     if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
    });
    // Visual normalization is independent of collision/pathfinding. Re-ground
    // imported GLBs against the same heightfield sample as their placeholder.
    // Each procedural fallback owns unique geometries/materials. Once its
    // cached authored GLB is ready, reclaim those GPU resources immediately.
    if(entry.placeholder){
     entry.node.remove(entry.placeholder);
     disposeOwnedMeshes(entry.placeholder);
     entry.placeholder=null;
    }
    entry.node.add(model);entry.detail=model;
    const visualScale=calibratedScale(entry.kind,type,dims,desired)*
      (type==='unit'?visualUnitScale(entry.kind):1);
    entry.modelHeight=dims.y*visualScale;
    entry.modelFootprint=Math.max(dims.x,dims.z)*visualScale;
    applyFactionAccents(entry,{kind:entry.kind,owner:entry.owner},type,
     entry.modelFootprint,entry.modelHeight);
    entry.visualBaseY=model.position.y;entry.visualBaseZ=model.position.z;
    if(type==='building'){
     this.attachBuildingMotion(entry,data);
     if(entry.kind==='factory'||entry.kind==='barracks')this.productionGates.prepare(entry);
    }
    if(type==='unit'&&['tank','artillery'].includes(entry.kind))this.installTankRig(entry,model);
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
   }).catch(err=>{
    entry.modelLoadError=String(err.message);
    console.warn('3D asset fallback:',task.url,err.message);
   }).finally(()=>{
    this.loadingCount--;this.pumpModelQueue();
    // Recover actor detail omitted while the model queue was saturated.
    // Buildings must be retried too: without this pass a newly completed
    // barracks/factory can stay a fallback indefinitely and never gain its
    // real 3D door, even after the cache and queue have cleared.
    if(this.loadingCount+this.modelQueue.length>=4)return;
    for(const base of this.game.bases){
     if(base.hp<=0)continue;
     const pending=this.bases.get(base.id);
     if(!pending||pending.requested||pending.detail)continue;
     this.scheduleDetail(pending,base,'building');
     if(this.loadingCount+this.modelQueue.length>=4)break;
    }
    for(const unit of this.game.units){
     if(unit.hp<=0||unit.carrier)continue;
     const pending=this.units.get(unit.id);
     if(!pending||pending.requested||pending.detail)continue;
     if(this.lite&&unit.kind!=='medic')continue;
     this.scheduleDetail(pending,unit,'unit');
     if(this.loadingCount+this.modelQueue.length>=4)break;
    }
   });
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
  const unit=type==='unit';
  const footprint=unit?(UNITS[entity.kind]?.width??44)*visualUnitScale(entity.kind):
   BUILDINGS[entity.kind]?.width??130;
  const height=unit?(['infantry','medic','engineer','heavy'].includes(entity.kind)?43:55)*visualUnitScale(entity.kind):
   Math.max(65,footprint*.55);
  applyFactionAccents(entry,entity,type,footprint,height);
  if(type==='unit'&&['tank','artillery'].includes(entity.kind))this.installTankRig(entry,placeholder);
  this.scheduleDetail(entry,entity,type);return entry;
 }
 beginPlacement(kind){
  this.clearPlacement();
  this.buildKind=kind;this.previewKind=kind;this.placementFacing=0;
  const spec=BUILDINGS[kind],group=new THREE.Group();
  group.name='ghost-building-'+kind;group.userData={buildGhost:true,nonPlayable:true};
  const placeholder=this.createFallback(kind,0,'building');
  const tint=(root,ownSource=false)=>{
   const oldMats=new Set();
   root.traverse(obj=>{
    if(!obj.isMesh)return;
    const make=mat=>{
     const m=mat.clone();m.color?.lerp(new THREE.Color('#8ad6b3'),.32);
     m.transparent=true;m.opacity=.72;m.depthWrite=false;
     m.depthTest=false;m.side=THREE.DoubleSide;
     m.userData={...m.userData,sandforgePreviewMaterial:true};
     if(ownSource)oldMats.add(mat);
     return m;
    };
    obj.material=Array.isArray(obj.material)?obj.material.map(make):make(obj.material);
    obj.renderOrder=1010;obj.castShadow=false;obj.receiveShadow=false;
   });
   for(const mat of oldMats)mat.dispose();
  };
  tint(placeholder,true);
  group.userData.previewPlaceholder=placeholder;
  group.add(placeholder);
  const circle=new THREE.Mesh(
   new THREE.RingGeometry(spec.radius-2.5,spec.radius+1.5,48),
   new THREE.MeshBasicMaterial({color:'#80efae',transparent:true,opacity:.92,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
  circle.rotation.x=-Math.PI/2;circle.position.y=2;circle.renderOrder=1009;
  group.userData.previewCircle=circle;group.add(circle);
  this.buildPreviewScene.add(group);
  this.buildPreview=group;group.visible=false;
  if(isStrategicBuilding(kind))return;
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
   tint(model);
   group.remove(placeholder);disposeOwnedMeshes(placeholder);
   group.userData.previewPlaceholder=null;group.userData.previewDetail=model;
   group.add(model);
  }).catch(error=>console.warn('Baupreview: vereinfachtes 3D-Modell',error));
 }
 clearPlacement(){
  this.buildKind=null;this.previewKind=null;
  if(this.buildPreview){
   const preview=this.buildPreview;
   this.buildPreviewScene.remove(preview);
   if(preview.userData.previewPlaceholder)disposeOwnedMeshes(preview.userData.previewPlaceholder);
   if(preview.userData.previewCircle)disposeOwnedMeshes(preview.userData.previewCircle);
   if(preview.userData.previewDetail)
    disposeTaggedMaterials(preview.userData.previewDetail,'sandforgePreviewMaterial');
   this.buildPreview=null;
  }
  if(this.buildHint)this.buildHint.style.display='none';
 }
 updatePlacementPreview(event){
  const ghost=this.buildPreview;if(!this.buildKind||!ghost)return;
  const p=this.terrainPoint(event);
  ghost.visible=Boolean(p);
  if(!p){this.buildHint.style.display='none';return;}
  ghost.position.copy(this.pos(p.x,p.y));
  ghost.rotation.y=buildingFacingAngle(this.placementFacing);
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
   ' · R drehen ('+buildingFacingDegrees(this.placementFacing)+'°)';
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
   const oldEntry=this.units.get(u.id);if(oldEntry)oldEntry.productionMotion=null;
   let entry=this.units.get(u.id);
   if(!entry){entry=this.spawnNode(u,'unit');this.units.set(u.id,entry);}
   if(entry.factionOwner!==u.owner)applyFactionAccents(entry,u,'unit');
   entry.lastAliveAt=this.game.time;
   // Interpolate between authoritative 20 Hz snapshots for smooth 60–120 FPS
   // visuals. Simulation, pathfinding and orders use true u.x/u.y only.
   const travel=Math.hypot(u.x-u.previousX,u.y-u.previousY);
   // AI orders, path retries and the rally hand-off can report moving=true
   // while an actor has made no actual progress. Never rotate rover tyres
   // from the command flag alone; use authoritative 20-Hz displacement.
   if(u.kind==='rover')entry.groundedWheelMotion=
    wheelsShouldRoll(u.kind,travel);
   const lerp=Number.isFinite(travel)&&travel<180?blend:1;
   const x=Number.isFinite(u.previousX)?u.previousX+(u.x-u.previousX)*lerp:u.x;
   const z=Number.isFinite(u.previousY)?u.previousY+(u.y-u.previousY)*lerp:u.y;
   entry.node.position.copy(this.pos(x,z,this.heightAt(x,z)+unitRenderAltitude(u.kind,u.flightHeight??1)));
   const hullAngle=['tank','artillery'].includes(u.kind)&&Number.isFinite(u.hullAngle)?u.hullAngle:u.angle;
   entry.node.rotation.y=unitVisualYaw(u.kind,hullAngle);
   if(u.kind==='tank'||u.kind==='artillery')this.orientTankRig(entry,u);
   entry.node.visible=u.owner===0||this.game.canSee(0,u);
  }
  for(const [id,e] of this.units)if(!aliveUnits.has(id)){
    const stillPresent=this.game.units.find(u=>u.id===id);
    // Boarding units still exist with carrier ID. Actual casualties were
    // removed by Simulation at the fixed tick and must be identified from
    // their last visible actor snapshot. Saves/reset must not create corpses.
    const recentDeath=!stillPresent&&e.lastAliveAt!==undefined&&
     this.game.time>=e.lastAliveAt&&this.game.time-e.lastAliveAt<=.20;
    const removal=recentDeath?{id,kind:e.kind,owner:e.owner,hp:0}:stillPresent;
    this.presentation.remove(e,removal);
    if(e.animation?.mixer){
     e.animation.mixer.stopAllAction();
     if(e.detail)e.animation.mixer.uncacheRoot(e.detail);
    }
    if(e.placeholder){disposeOwnedMeshes(e.placeholder);e.placeholder=null;}
    // Authored model geometries are shared, but team-tinted materials are
    // actor-owned. Release only our owned PBR clones on death/despawn.
    if(e.detail)disposeTaggedMaterials(e.detail,'sandforgeFactionTint');
    this.scene.remove(e.node);this.units.delete(id);this.selected.delete(id);
   }
  for(const b of this.game.bases){
   if(b.hp<=0)continue;
   aliveBases.add(b.id);
   let entry=this.bases.get(b.id);
   if(!entry){entry=this.spawnNode(b,'building');this.bases.set(b.id,entry);this.grounding.attachBuilding(entry,b);}
   if(entry.factionOwner!==b.owner)applyFactionAccents(entry,b,'building');
   entry.node.position.copy(this.entityPosition(b));
   entry.node.visible=b.owner===0||this.game.canSee(0,b);
   entry.node.scale.y=1;
   entry.node.rotation.y=buildingFacingAngle(b.facing);
   this.construction.update(entry,b);
   // Recognizable physical inventory identifies each production building
   // even at tactical zoom. Purely visual, and built only once on completion.
   if(b.buildRemaining<=0&&!entry.yard){
    entry.yard=createBuildingYard(b.kind,BUILDINGS[b.kind]?.width);
    if(entry.yard)entry.node.add(entry.yard);
   }
   this.animateBuildingMotion(entry,b,dt,active);
   if(b.buildRemaining<=0&&!this.announcedBuildings.has(b.id)){
    this.announcedBuildings.add(b.id);
    if(b.owner===0&&this.sound?.enabled)this.sound.announceReady('building');
   }
  }
  for(const [id,e] of this.bases)if(!aliveBases.has(id)){
    this.presentation.remove(e,this.game.bases.find(base=>base.id===id));
    this.productionGates.detach(e);this.construction.dispose(e);
    this.grounding.detachBuilding(id);
    if(e.yard){disposeBuildingYard(e.yard);e.yard=null;}
    if(e.placeholder){disposeOwnedMeshes(e.placeholder);e.placeholder=null;}
    if(e.detail)disposeTaggedMaterials(e.detail,'sandforgeBuildingFill');
    if(e.motion?.mixer){
     e.motion.mixer.stopAllAction();
     if(e.detail)e.motion.mixer.uncacheRoot(e.detail);
    }
    if(e.motion?.mode==='fallback'&&e.motion.rotor)disposeOwnedMeshes(e.motion.rotor);
    this.scene.remove(e.node);this.bases.delete(id);
    this.announcedBuildings.delete(id);
    if(this.selectedBase===id)this.selectedBase=null;
   }
  this.productionGates.update(active,blend);
  this.presentation.consumeShots(this.units,this.bases);
  for(const u of this.game.units){
   const entry=this.units.get(u.id);
   if(entry){
    const visual=entry.productionMotion?{...u,...entry.productionMotion}:
     u.kind==='rover'?{...u,moving:entry.groundedWheelMotion===true}:u;
    this.presentation.update(entry,visual,'unit',dt,this.selected.has(u.id),active);
    // Authored vehicle clips can animate Turret/Gun quaternion and overwrite
    // our aim. Reapply authoritative heading AFTER AnimationMixer.update().
    if(u.kind==='tank'||u.kind==='artillery')this.orientTankRig(entry,visual);
   }
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
   if(entry){
    updateBastionCaptureBar(entry.captureBar,territory,this.game,this.fogEnabled);
    if(active&&entry.motion){
     if(entry.motion.mixer)entry.motion.mixer.update(dt);
     else if(entry.motion.rotor)entry.motion.rotor.rotation.y+=dt*.35;
    }
   }
  }
  this.updateSelectionRings();
  this.updateShots();
  const now=performance.now();
  // A periodic triple-refresh (fog/upload + complete HTML catalogue +
  // minimap raster) used to coincide every ~1.4 s, producing visible hitches.
  // Spread expensive periodic refreshes over successive RAF frames. Immediate
  // input/force updates still refresh everything synchronously.
  if(force){
   this.updateFog();this.fogLast=now;
   this.drawInterface();this.uiLast=now;
   this.drawMinimap();this.miniLast=now;
  }else{
   const due=nextPeriodicRefresh(now,{
    fog:this.fogLast,ui:this.uiLast,minimap:this.miniLast
   });
   if(due==='fog'){this.updateFog();this.fogLast=now;}
   else if(due==='ui'){this.drawInterface();this.uiLast=now;}
   else if(due==='minimap'){this.drawMinimap();this.miniLast=now;}
  }
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
   this.lightBuildingMeshes(detail);
   if(entry.detail)entry.node.remove(entry.detail);
   entry.detail=detail;entry.node.add(detail);
   // Bastions also have the RadarSpin animation in their authored assets.
   const radarClip=data.animations?.find(c=>c.name==='RadarSpin');
   if(radarClip?.tracks?.length){
    const mixer=new THREE.AnimationMixer(detail),action=mixer.clipAction(radarClip);
    action.setLoop(THREE.LoopRepeat,Infinity);action.play();
    entry.motion={kind:'headquarters',mixer,action,mode:'authored'};
   }else{
    const rotor=this.createMechanicalRotor('headquarters',115,116);
    entry.node.add(rotor);entry.motion={kind:'headquarters',rotor,mode:'fallback'};
   }
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
   fragmentShader:'uniform sampler2D fogTex;uniform float mapSize;uniform float fogStep;varying vec2 fogUv;void main(){vec2 uv=clamp(fogUv,vec2(0.001),vec2(0.999));float a=texture2D(fogTex,uv).a;vec2 d=vec2(fogStep*1.6,0.0);float n=max(max(texture2D(fogTex,clamp(uv+d,vec2(0.001),vec2(0.999))).a,texture2D(fogTex,clamp(uv-d,vec2(0.001),vec2(0.999))).a),max(texture2D(fogTex,clamp(uv+d.yx,vec2(0.001),vec2(0.999))).a,texture2D(fogTex,clamp(uv-d.yx,vec2(0.001),vec2(0.999))).a));a=max(a,n*0.44);vec2 beyond=max(max(-fogUv,fogUv-1.0),vec2(0.0));float edge=max(beyond.x,beyond.y);a=max(a,smoothstep(0.0,420.0/mapSize,edge));gl_FragColor=vec4(0.018,0.023,0.026,a);}',
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
   // cover opaque near-black like the original RTS; explored areas still
   // retain partial visibility, and currently visible cells stay uncovered.
   data[k+3]=visible[0][i]?0:explored[0][i]?215:255;
  }
  this.fogTexture.needsUpdate=true;
  this.fogNodes.forEach(n=>n.visible=this.fogEnabled);
  this.fogAtmosphere?.setFogEnabled(this.fogEnabled);
 }
 updateShots(){
  // Rockets are simulated moving missiles, never hitscan tracer lines.
  // Update the SAME GPU buffer instead of allocating geometry every frame.
  const positions=this.tracerPositions.array,colors=this.tracerColors.array;
  let n=0;
  this.turretTracerOrigins??=new WeakMap();
  const shots=this.game.shots;
  for(let i=Math.max(0,shots.length-this.maxTracerShots);i<shots.length;i++){
   const shot=shots[i];
   const streak=tracerWindow(shot);
   if(!streak)continue;
   if(!this.game.canSee(0,shot.from)&&!this.game.canSee(0,shot.to))continue;
   if(shot.weapon==='turret'&&shot.source&&!this.turretTracerOrigins.has(shot)){
    const barrel=shot.barrel===1?1:0;
    const sprite=this.bases.get(shot.source)?.presentation?.turretFlashes?.[barrel];
    if(sprite)this.turretTracerOrigins.set(shot,sprite.position.clone());
   }
   const a=this.turretTracerOrigins.get(shot)??
    this.pos(shot.from.x,shot.from.y,this.heightAt(shot.from.x,shot.from.y)+27);
   const b=this.pos(shot.to.x,shot.to.y,this.heightAt(shot.to.x,shot.to.y)+27);
   const offset=n*6;
   // Moving golden tracer, not a permanent full-screen team-colored laser.
   // Endpoint calculations reuse the two authoritative shot locations.
   positions[offset]=a.x+(b.x-a.x)*streak.from;
   positions[offset+1]=a.y+(b.y-a.y)*streak.from;
   positions[offset+2]=a.z+(b.z-a.z)*streak.from;
   positions[offset+3]=a.x+(b.x-a.x)*streak.to;
   positions[offset+4]=a.y+(b.y-a.y)*streak.to;
   positions[offset+5]=a.z+(b.z-a.z)*streak.to;
   const c=shot.weapon==='cannon'?[1,.72,.29]:
    shot.weapon==='heavy'?[1,.85,.55]:[1,.89,.67];
   colors[offset]=c[0];colors[offset+1]=c[1];colors[offset+2]=c[2];
   colors[offset+3]=c[0];colors[offset+4]=c[1];colors[offset+5]=c[2];
   n++;
  }
  const geometry=this.tracer.geometry;
  geometry.setDrawRange(0,n*2);
  this.tracerPositions.needsUpdate=true;
  this.tracerColors.needsUpdate=true;
  // frustumCulled=false, so there is no need to recalculate bounds on each
  // frame; this avoids additional O(shots) work and transient allocations.
 }
 updateSelectionRings(){
  for(const [id,ring] of this.selectedRings)if(!this.selected.has(id)||!this.units.has(id)){
   this.scene.remove(ring);
   // THREE.Scene.remove() does not free WebGL buffers/program resources.
   // Selection toggles over a five-minute match must never accumulate
   // orphaned ring geometries or materials on the GPU.
   ring.geometry.dispose();
   ring.material.dispose();
   this.selectedRings.delete(id);
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
 /** One-click recovery for builders accidentally deselected while placing.
  * Never spawns a unit or bypasses the usual cost/placement/navigation rules.
  */
 selectEngineer(){
  const cameraCenter={x:this.controls.target.x+this.world.size*.5,
   y:this.controls.target.z+this.world.size*.5};
  const worker=nearestEngineer(this.game.units,cameraCenter);
  if(!worker){this.message('Kein Pionier verfügbar · im Feldkommando ausbilden');return null;}
  this.selected=new Set([worker.id]);this.selectedBase=null;
  this.rallyMode=false;this.attackMode=false;
  this.drawInterface();
  this.message('Pionier ausgewählt · Gebäude wählen, Bauplatz anklicken · P: Pionier wählen');
  return worker;
 }
 catalogContext(){
  const game=this.game;
  const engineer=game.units.some(u=>this.selected.has(u.id)&&u.owner===0&&u.hp>0&&!u.carrier&&u.kind==='engineer');
  const base=game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
  const producer=base&&unitKinds.some(kind=>UNITS[kind].producers.includes(base.kind))?base:null;
  const research=Boolean(base&&base.kind==='research');
  return {engineer,producer,research,preferred:engineer?'buildings':producer?'units':research?'research':'territories'};
 }
 buildInterface(){
  this.panel=installClassicHud();
  this.mini=this.panel.querySelector('#sf-map');
  this.panel.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(this.sound?.enabled)this.sound.select();
   const kind=button.dataset.build,unit=button.dataset.unit,action=button.dataset.action;
   if(button.dataset.passengerId!==undefined){
    this.unloadPassenger(Number(button.dataset.carrierId),Number(button.dataset.passengerId));
    return;
   }
   if(button.dataset.upgrade){
    const upgrade=button.dataset.upgrade;
    if(this.game.startResearch(0,upgrade))
      this.message('Forschung begonnen: '+UPGRADES[upgrade].name);
    else this.message('Forschung nicht möglich: Credits, Voraussetzung oder laufendes Projekt prüfen');
    this.drawInterface();return;
   }
   if(action==='missile-target'){
    const silo=this.game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&
      b.kind==='silo'&&b.hp>0&&b.buildRemaining<=0);
    if(!silo||silo.siloCharge>0){
      this.message('Raketensilo noch nicht bereit');return;
    }
    this.clearPlacement();this.rallyMode=false;this.attackMode=false;
    this.strategicTargetMode=!this.strategicTargetMode;
    this.message(this.strategicTargetMode?'Langstreckenrakete: Linksklick auf ein erkundetes Kartenziel · Esc: Abbruch':
      'Raketenziel-Modus beendet');
    this.drawInterface();return;
   }
   if(action==='select-engineer'){
    this.selectEngineer();return;
   }
   if(action==='interceptor-rearm'){
    this.message(this.game.rearmInterceptor(this.selectedBase)?
      'Raketenabwehr nachgeladen: '+INTERCEPTOR_MAX_AMMO+' Raketen':
      'Nachladen nicht möglich: maximal bestückt oder '+INTERCEPTOR_REARM_COST+' Credits benötigt');
    this.drawInterface();return;
   }
   if(kind){
    if(kind==='interceptor'&&!INTERCEPTOR_ENABLED){this.message('Raketenabwehr derzeit deaktiviert');return;}
    if(!this.catalogContext().engineer){
     if(!this.selectEngineer())return;
    }
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
    const modes=['all','selected','off','damaged'];
    const old=this.presentation.showHealth;
    this.presentation.setHealthMode(modes[(modes.indexOf(old)+1)%modes.length]);
    this.message('Lebensbalken: '+({all:'Alle',damaged:'Beschädigte',selected:'Ausgewählte',off:'Aus'}[this.presentation.showHealth]));
   }
   if(action==='fog'){this.fogEnabled=!this.fogEnabled;this.updateFog();this.message('Nebel des Krieges '+(this.fogEnabled?'aktiv':'deaktiviert'));}
   if(action==='save')this.saveGame();
   if(action==='load'){this.loadSave();}
   if(action==='attack'){this.attackMode=!this.attackMode;this.clearPlacement();this.drawInterface();this.message(this.attackMode?'Angriffsbewegung: Rechtsklick auf Ziel':'Angriffsbewegung beendet');}
   if(action==='unload')this.unloadSelectedTransport();
   if(action==='stop'){
    const count=this.selected.size;
    this.game.stop([...this.selected],false);
    this.message(count?count+' Einheiten angehalten':'Keine Einheiten gewählt');
   }
   if(action==='cancel'){this.clearPlacement();this.attackMode=false;this.strategicTargetMode=false;this.selected.clear();this.selectedBase=null;this.drawInterface();}
   if(action==='select-all'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.selectedBase=null;this.drawInterface();}
  });
  this.panel.addEventListener('sandforge-tabchange',event=>{
   const available={buildings:this.catalogContext().engineer,units:Boolean(this.catalogContext().producer),territories:true,research:this.catalogContext().research};
   if(!available[event.detail.tab])return;
   this.panel.querySelector('#sf-actions').scrollTop=0;
   const descriptions={units:'Wähle einen Produktionsauftrag. Gebäude schalten neue Einheiten frei.',
    buildings:'Gebäude auswählen und einen freien Bauplatz auf der Karte anklicken.',
    research:'Forschungstechnologie wählen. Neue Boni gelten auch für bereits vorhandene Truppen.',
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
 saveGame(){
  try{
   const payload=JSON.stringify(this.game.save());
   localStorage.setItem('sandforge:webgl:v1',payload);
   this.message('3D-Kampagne gespeichert');
   return true;
  }catch(error){
   this.message('Speichern fehlgeschlagen: '+(error?.message??error));
   return false;
  }
 }
 loadSave(){
  try{
   const raw=localStorage.getItem('sandforge:webgl:v1');
   if(!raw){this.message('Kein gespeicherter 3D-Spielstand');return;}
   const snapshot=JSON.parse(raw);
   if(snapshot.seed!==this.game.seed||snapshot.mapVersion!==this.game.world.mapVersion){
    location.href=(window.Sandforge3DMenu?.gameRoute?.()??'/webgl-preview.html')+'?bastions='+this.game.territories.length+'&seed='+snapshot.seed+'&resume=1';return;
   }
   location.href=(window.Sandforge3DMenu?.gameRoute?.()??'/webgl-preview.html')+'?bastions='+this.game.territories.length+'&seed='+this.game.seed+'&resume=1';
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
  const available={units:Boolean(context.producer),buildings:context.engineer,territories:true,research:context.research};
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
    :'<img data-sf-building-icon="'+kind+'" src="'+buildingIconUrl(kind)+'" alt="" loading="lazy" decoding="async">';
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
  const upgrades=UPGRADE_KINDS.map(kind=>{
   const tech=UPGRADES[kind];
   return '<button type="button" class="sf-research-card" data-upgrade="'+kind+
    '" title="'+plain(tech.description)+'" aria-label="'+plain(tech.name)+
    ' – '+tech.cost+' Credits – '+tech.seconds+' Sekunden">'+
    '<span class="sf-tech-art" aria-hidden="true">'+
    '<span class="sf-tech-art-fallback">'+researchIconMarkup(kind)+'</span>'+
    '<img data-sf-research-artwork="'+kind+'" alt="" loading="lazy" decoding="async">'+
    '</span>'+
    '<span class="sf-tech-info sf-tech-body"><strong>'+plain(tech.name)+'</strong>'+
    '<span class="sf-tech-effect">'+plain(researchEffectLabel[kind]??tech.description)+'</span>'+
    '<small class="sf-tech-meta">'+tech.cost+' ◆ · '+tech.seconds+' s</small>'+
    '<span class="sf-tech-progress" aria-hidden="true"></span></span></button>';
  }).join('');
  const markup='<div class="sf-group" data-sf-group="units">'+roster+'</div>'+
   '<div class="sf-group" data-sf-group="buildings"><div class="catalog-grid">'+
   cards(buildingKinds.filter(kind=>kind!=='interceptor'||INTERCEPTOR_ENABLED),'building')+'</div></div>'+
   '<div class="sf-group" data-sf-group="research"><div class="sf-research-grid">'+upgrades+'</div></div>'+
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
  const techState=g.research[0];
  for(const button of actions.querySelectorAll('[data-upgrade]')){
   const kind=button.dataset.upgrade,tech=UPGRADES[kind];
   const researched=techState.completed.includes(kind);
   const inProgress=techState.active===kind;
   const mayStart=canResearchUpgrade(techState,kind)&&g.credits[0]>=tech.cost;
   button.disabled=researched||inProgress||!mayStart;
   button.classList.toggle('sf-tech-done',researched);
   button.classList.toggle('sf-tech-active',inProgress);
   button.querySelector('.sf-tech-progress').textContent=researched?'✓':inProgress?
    Math.ceil(techState.remaining)+'s':tech.requires&&!techState.completed.includes(tech.requires)?
    'VORAUSSETZUNG':!mayStart?'GESPERRT':'START';
   button.title=tech.description+(researched?' · Erforschung abgeschlossen':
    inProgress?' · Noch '+Math.ceil(techState.remaining)+' Sekunden':
    tech.requires&&!techState.completed.includes(tech.requires)?
    ' · Benötigt '+UPGRADES[tech.requires].name:'');
  }
  const generatorLimitReached=g.bases.filter(b=>b.owner===0&&b.kind==='generator'&&b.hp>0).length>=MAX_GENERATORS_PER_FACTION;
  const constructed=new Map(g.bases.filter(b=>b.owner===0&&b.hp>0).map(b=>[b.kind,b]));
  // The simulation already rejects duplicate HQ, barracks, factory and
  // airfield construction; reflect that rule in the catalogue immediately,
  // including buildings that still have buildRemaining > 0.
  for(const button of actions.querySelectorAll('button[data-unit],button[data-build]')){
   const kind=button.dataset.unit??button.dataset.build;
   const spec=button.dataset.unit?UNITS[kind]:BUILDINGS[kind];
   const correctProducer=context.producer&&UNITS[kind]?.producers.includes(context.producer.kind);
   const ownedUnique=Boolean(button.dataset.build&&['headquarters','barracks','factory','airfield','research','silo'].includes(kind)&&constructed.has(kind));
   const ownedSite=constructed.get(kind);
   const interceptorLimit=kind==='interceptor'&&g.bases.filter(b=>b.owner===0&&b.kind==='interceptor'&&b.hp>0).length>=2;
   const ownedReason=ownedUnique?(ownedSite.buildRemaining>0?'Bereits im Bau':'Bereits gebaut'):'';
   const unavailable=button.dataset.unit
    ?!correctProducer||g.needsHeadquarters(0)||context.producer.queue.length>=8||
      g.credits[0]<spec.cost||g.count(0)+g.queued(0)>=RULES.capacity
    :!context.engineer||g.credits[0]<spec.cost||!g.hasHeadquarters(0)&&kind!=='headquarters'||
      kind==='generator'&&generatorLimitReached||ownedUnique||interceptorLimit;
   const requirement=button.dataset.unit
    ?(!context.producer?'Produktionsgebäude auswählen':
       !correctProducer?'Dieses Gebäude produziert diese Einheit nicht':
       g.needsHeadquarters(0)?'Feldkommando erforderlich':
       context.producer.queue.length>=8?'Warteschlange voll':
       g.credits[0]<spec.cost?'Zu wenig Credits':
       g.count(0)+g.queued(0)>=RULES.capacity?'Einheitenlimit erreicht':'')
    :(ownedReason?ownedReason:kind==='generator'&&generatorLimitReached?'Maximal '+MAX_GENERATORS_PER_FACTION+' Energiekerne pro Fraktion':
       interceptorLimit?'Maximal zwei Raketenabwehr-Anlagen pro Fraktion':
       !context.engineer?'Pionier auswählen':
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
  hydrateBuildingIcons(actions,this.renderer);
  // Nine real 3D upgrade models: rasterize only after the research deck is
  // opened. Offscreen 3D readback never runs during ordinary frame rendering.
  if(view.dataset.tab==='research')hydrateResearchArtworks(actions,this.renderer);
  // The bottom production panel is GLOBAL: every producer and every build
  // site stays visible regardless of which unit or structure is selected.
  const queuedBases=g.bases.filter(b=>b.owner===0&&b.hp>0&&b.queue?.length);
  const queues=queuedBases.reduce((sum,b)=>sum+b.queue.length,0);
  const constructionSites=g.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining>0);
  const primary=queuedBases[0],firstSite=constructionSites[0];
  const activeResearch=techState.active?UPGRADES[techState.active]:null;
  const researchPct=activeResearch?Math.max(0,Math.min(100,
   100*(1-techState.remaining/Math.max(.001,activeResearch.seconds)))):0;
  const sitePct=b=>Math.max(0,Math.min(100,
   100*(1-b.buildRemaining/Math.max(.001,BUILDINGS[b.kind]?.buildTime??1))));
  const unitPct=b=>Math.max(0,Math.min(100,
   100*b.production/Math.max(.001,b.queue[0]??1)));
  const progress=primary?unitPct(primary):activeResearch?researchPct:firstSite?sitePct(firstSite):0;
  view.querySelector('#sf-progress').style.width=progress.toFixed(1)+'%';
  view.querySelector('#sf-production .production-track')
   .setAttribute('aria-valuenow',String(Math.round(progress)));
  // Build the status from actual queue, research and construction state.
  // Joining only present parts avoids duplicate separators ("AKTIV ·  · BAU").
  const activeCount=queues+constructionSites.length+(activeResearch?1:0);
  const summary=[activeCount+' AKTIV'];
  if(activeResearch)summary.push('1 FORSCHUNG');
  if(constructionSites.length)summary.push(constructionSites.length+' BAU');
  view.querySelector('#sf-queue-count').textContent=summary.join(' · ');
  view.querySelector('#sf-queue').textContent=primary
   ?queuedBases.length+' Produktionsgebäude · '+queues+' Aufträge'
   :activeResearch?'FORSCHUNG: '+activeResearch.name
   :constructionSites.length?constructionSites.map(b=>BUILDINGS[b.kind].name+' (im Bau)').join(' · ')
   :'WARTESCHLANGE LEER';
  const remaining=primary?Math.max(0,(primary.queue[0]??0)-primary.production)
   :activeResearch?techState.remaining:firstSite?.buildRemaining??0;
  view.querySelector('#sf-queue-time').textContent=primary||firstSite||activeResearch?Math.ceil(remaining)+' s':'--:--';

  // Rebuild on actual global queue / construction changes, never on selection.
  // All orders fit into a single horizontally scrollable strip. Nothing is
  // hidden behind a per-building tab or a capped preview of five items.
  const slots=view.querySelector('#sf-queue-slots');
  const slotKey=queuedBases.map(b=>b.id+':'+b.kind+':'+b.queueTypes.join(',')).join('|')+
   '|B|'+constructionSites.map(b=>b.id+':'+b.kind).join('|')+
   '|R|'+(techState.active??'');
  if(this.previousProductionSlotsKey!==slotKey){
   const scroll=slots.scrollLeft,items=[];
   for(const b of queuedBases)for(let i=0;i<b.queueTypes.length;i++){
    const kind=b.queueTypes[i]??'infantry',name=UNITS[kind]?.name??kind;
    const source=BUILDINGS[b.kind]?.name??b.kind;
    items.push('<div role="listitem" class="sf-production-slot'+(i===0?' is-active':'')+
     '" data-queue-base="'+b.id+'" data-queue-index="'+i+
     '" title="'+plain(source)+' · '+plain(name)+'">'+
     '<img data-sf-unit-icon="'+kind+'" alt="" decoding="async">'+
     '<div class="sf-production-slot-copy"><strong>'+plain(name)+'</strong>'+
     '<small>'+(i===0?'IN ARBEIT':'WARTET')+'</small>'+
     '<span class="sf-production-source">'+plain(source)+'</span></div>'+
     '<span class="sf-slot-progress"><i></i></span></div>');
   }
   if(activeResearch){
    const kind=techState.active;
    items.push('<div role="listitem" class="sf-production-slot is-research is-active" data-research-kind="'+kind+
     '" title="Forschung: '+plain(activeResearch.name)+' · '+plain(activeResearch.description)+'">'+
     '<span class="sf-queue-research-art" aria-hidden="true">'+
     '<span class="sf-queue-research-fallback">'+researchIconMarkup(kind)+'</span>'+
     '<img data-sf-research-artwork="'+kind+'" alt="" decoding="async"></span>'+
     '<div class="sf-production-slot-copy"><strong>'+plain(activeResearch.name)+'</strong>'+
     '<small>FORSCHUNG</small><span class="sf-production-source">FORSCHUNGSZENTRUM</span></div>'+
     '<span class="sf-slot-progress"><i></i></span></div>');
   }
   for(const b of constructionSites){
    items.push('<div role="listitem" class="sf-production-slot is-build" data-build-id="'+
     b.id+'" title="'+plain(BUILDINGS[b.kind].name)+' im Bau">'+
     '<img data-sf-building-icon="'+b.kind+'" src="'+buildingIconUrl(b.kind)+'" alt="" loading="lazy" decoding="async">'+
     '<div class="sf-production-slot-copy"><strong>'+plain(BUILDINGS[b.kind].name)+'</strong>'+
     '<small>BAU</small></div><span class="sf-slot-progress"><i></i></span></div>');
   }
   slots.innerHTML=items.join('')||
    '<div class="sf-production-empty">Noch keine Produktion aktiv</div>';
   this.previousProductionSlotsKey=slotKey;
   slots.scrollLeft=scroll;
   hydrateUnitIcons(slots);
   hydrateBuildingIcons(slots,this.renderer);
   if(activeResearch)hydrateResearchArtworks(slots,this.renderer);
  }
  for(const tile of slots.querySelectorAll('[data-research-kind]')){
   if(!activeResearch)continue;
   tile.querySelector('.sf-slot-progress i').style.width=researchPct.toFixed(1)+'%';
   tile.querySelector('small').textContent='FORSCHUNG · '+Math.round(researchPct)+'% · '+Math.ceil(techState.remaining)+' s';
  }
  for(const tile of slots.querySelectorAll('[data-queue-base]')){
   const producer=queuedBases.find(b=>b.id===Number(tile.dataset.queueBase));
   if(!producer)continue;
   const active=Number(tile.dataset.queueIndex)===0;
   const pct=active?unitPct(producer):0;
   tile.querySelector('.sf-slot-progress i').style.width=pct.toFixed(1)+'%';
   tile.querySelector('small').textContent=active?'IN ARBEIT · '+Math.round(pct)+'%':'WARTET';
  }
  for(const tile of slots.querySelectorAll('[data-build-id]')){
   const site=constructionSites.find(b=>b.id===Number(tile.dataset.buildId));
   if(!site)continue;
   const pct=sitePct(site);
   tile.querySelector('.sf-slot-progress i').style.width=pct.toFixed(1)+'%';
   tile.querySelector('small').textContent='BAU · '+Math.round(pct)+'%';
  }

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
  const maxHp=item&&'orders' in item?g.maxUnitHp(item):spec?.hp??1;
  const meta=chosen.length?'BLAUE LEGION / TRUPP':'BLAUE LEGION / STÜTZPUNKT';
  const description=base?.rally
   ?'Sammelpunkt aktiv · Neue Einheiten marschieren automatisch zum markierten Ziel.'
   :spec?.description??'Wähle eine Einheit oder ein Gebäude. Rechtsklick: Marsch oder Zielbefehl.';
  const manifest=selectedTransportManifest(g.units,this.selected);
  const roleNames={infantry:'INF',medic:'SAN',engineer:'PIO',heavy:'MG'};
  const passengerMarkup=manifest
   ?'<div class="sf-passenger-manifest"><div class="sf-passenger-heading"><span>PASSAGIERE '+manifest.occupied+' / '+manifest.capacity+'</span><span>Klick: einzeln ausladen</span></div>'+
    '<div class="sf-passenger-slots">'+manifest.slots.map((passenger,i)=>
     passenger?'<button type="button" class="sf-passenger-slot" data-carrier-id="'+manifest.carrier.id+
      '" data-passenger-id="'+passenger.id+'" title="'+plain(UNITS[passenger.kind]?.name??passenger.kind)+
      ' einzeln ausladen" aria-label="Platz '+(i+1)+': '+plain(UNITS[passenger.kind]?.name??passenger.kind)+
      ' ausladen"><span>'+plain(roleNames[passenger.kind]??'INF')+'</span></button>'
      :'<span class="sf-passenger-slot sf-passenger-empty" title="Platz '+(i+1)+' frei" aria-label="Platz '+(i+1)+' frei">–</span>'
     ).join('')+'</div></div>'
   :'';
  view.querySelector('#sf-selection-panel')?.classList.toggle('sf-transport-selected',Boolean(manifest));
  view.querySelector('#sf-selection-panel')?.classList.toggle('sf-engineer-selected',kind==='engineer'&&chosen.length===1);
  const strategicStatus=base?.kind==='silo'
    ?'<div class="sf-strategic-meter">🚀 '+(base.buildRemaining>0?'Silo im Bau':
      (base.siloCharge??SILO_CHARGE_SECONDS)>0?
      'Ladezeit '+Math.floor((base.siloCharge??SILO_CHARGE_SECONDS)/60)+':'+
       String(Math.ceil((base.siloCharge??SILO_CHARGE_SECONDS)%60)).padStart(2,'0'):
      'RAKETE BEREIT')+'</div>'
    :base?.kind==='interceptor'
     ?'<div class="sf-strategic-meter">🛡 Abwehrmunition: '+
      (base.interceptorAmmo??INTERCEPTOR_MAX_AMMO)+' / '+INTERCEPTOR_MAX_AMMO+'</div>'
    :base?.kind==='research'
     ?'<div class="sf-strategic-meter">⚙ '+
      (techState.active?UPGRADES[techState.active].name+' · '+Math.ceil(techState.remaining)+' s':
       techState.completed.length+' / '+UPGRADE_KINDS.length+' Technologien')+'</div>':'';
  const healthPct=item?Math.max(0,Math.min(100,100*hp/Math.max(1,maxHp))):0;
  const selectedMarkup='<small>'+meta+'</small><strong>'+plain(heading)+'</strong>'+
   (item?'<div class="sf-health-row" aria-label="Lebenspunkte '+hp+' von '+maxHp+'">'+
   '<span class="sf-health-label">LP</span><div class="health-track"><i style="width:'+healthPct.toFixed(1)+'%"></i></div>'+
   '<span class="sf-health">'+hp+' / '+maxHp+'</span></div>':'')+
   '<p title="'+plain(description)+'">'+plain(kind==='engineer'&&chosen.length===1
     ?'Baut und repariert Gebäude sowie Fahrzeuge. Gebäude im Baumenü wählen, dann Bauplatz auf der Karte anklicken.'
     :description)+'</p>'+strategicStatus+passengerMarkup;
  if(this.previousSelectionMarkup!==selectedMarkup){
   el.innerHTML=selectedMarkup;this.previousSelectionMarkup=selectedMarkup;
  }
  const portrait=view.querySelector('#sf-portrait');
  const squadPortrait=view.querySelector('#sf-squad-portrait');
  const squadSelected=chosen.length>1;
  portrait.hidden=squadSelected;
  squadPortrait.hidden=!squadSelected;
  if(squadSelected){
   const lineup=[chosen[0],chosen[Math.floor(chosen.length*.5)],chosen[chosen.length-1]];
   const squadKinds=lineup.map(u=>u.kind);
   const portraitKey='squad:'+squadKinds.join(',');
   squadPortrait.setAttribute('aria-label',chosen.length+' ausgewählte Einheiten');
   squadPortrait.querySelector('.sf-squad-count').textContent='×'+chosen.length;
   if(this.previousPortraitKey!==portraitKey){
    this.previousPortraitKey=portraitKey;
    const images=[...squadPortrait.querySelectorAll('.sf-squad-member')];
    for(let i=0;i<images.length;i++){
     const img=images[i],unit=squadKinds[i];
     img.src='/src/assets/reborn/infantry-grounded-v3.png';
     unitIcon(unit).then(url=>{
      if(this.previousPortraitKey===portraitKey&&img.isConnected)img.src=url;
     }).catch(error=>console.warn('Squad portrait fallback:',unit,error));
    }
   }
  }else{
   const portraitKey=item?(item.queue?'building:':'unit:')+kind:'building:headquarters';
   if(this.previousPortraitKey!==portraitKey){
    this.previousPortraitKey=portraitKey;
    if(item&&!item.queue){
     unitIcon(kind).then(url=>{
      if(this.previousPortraitKey===portraitKey)portrait.src=url;
     }).catch(error=>console.warn('Portrait fallback',error));
     portrait.src='/src/assets/reborn/infantry-grounded-v3.png';
    }else{
     const buildingKind=item?.kind??'headquarters';
     portrait.src=buildingIconUrl(buildingKind);
     buildingIcon(buildingKind,this.renderer).then(url=>{
      if(this.previousPortraitKey===portraitKey&&portrait.isConnected)portrait.src=url;
     }).catch(error=>console.warn('Building portrait fallback:',buildingKind,error));
    }
   }
  }
  const launchButton=view.querySelector('#sf-strategic-fire');
  if(launchButton){
   launchButton.hidden=!base||base.owner!==0||base.kind!=='silo'||base.buildRemaining>0;
   launchButton.disabled=!base||base.kind!=='silo'||(base.siloCharge??SILO_CHARGE_SECONDS)>0;
   launchButton.setAttribute('aria-pressed',String(this.strategicTargetMode));
  }
  const rearmButton=view.querySelector('#sf-interceptor-rearm');
  if(rearmButton){
   rearmButton.hidden=!base||base.owner!==0||base.kind!=='interceptor'||base.buildRemaining>0;
   rearmButton.disabled=!base||base.kind!=='interceptor'||
    (base.interceptorAmmo??INTERCEPTOR_MAX_AMMO)>=INTERCEPTOR_MAX_AMMO||
    g.credits[0]<INTERCEPTOR_REARM_COST;
  }
  const unloadButton=view.querySelector('[data-action="unload"]');
  if(unloadButton)unloadButton.hidden=!selectedLoadedTransports(g.units,this.selected).length;
  view.querySelector('[data-action="attack"]').setAttribute('aria-pressed',String(this.attackMode));
  view.querySelector('#sf-catalog-detail').textContent=
   spec?.description??'Einheiten auswählen · Rechtsklick bewegen · Pionier für Gebäude erforderlich.';
  if(g.status!=='playing')this.message(g.status==='victory'?'SIEG – alle Gegner besiegt':'NIEDERLAGE');
 }
 drawMinimap(){
  const ctx=this.mini.getContext('2d');if(!ctx)return;
  const width=this.mini.width,height=this.mini.height,map=this.world;
  const scale=width/map.size,grid=RULES.grid;
  ctx.fillStyle='#c9a576';ctx.fillRect(0,0,width,height);
  if(map.generated?.battlefield){
   // Bake the shared heightfield once; fog and unit markers remain dynamic.
   if(!this.miniTerrainCanvas){
    this.miniTerrainCanvas=document.createElement('canvas');this.miniTerrainCanvas.width=grid;this.miniTerrainCanvas.height=grid;
    const c=this.miniTerrainCanvas.getContext('2d'),image=c.createImageData(grid,grid);
    for(let i=0;i<grid*grid;i++){
     const p=map.center(i),h=map.terrainHeight(p.x,p.y),s=map.terrainSlope(p.x,p.y),shade=Math.min(65,h*.18+s*95),k=i*4;
     image.data[k]=205-shade;image.data[k+1]=174-shade;image.data[k+2]=127-shade*.8;image.data[k+3]=255;
     if(map.blocked[i]){image.data[k]=104;image.data[k+1]=85;image.data[k+2]=66;}
    }
    c.putImageData(image,0,0);
    this.mini.title=TERRAIN_LABELS[map.generated.battlefield.profile]+' · Seed '+this.game.seed+' · v'+map.mapVersion;
   }
   ctx.drawImage(this.miniTerrainCanvas,0,0,width,height);
   for(const o of this.oases?.layout??[]){
    ctx.fillStyle=o.type==='dry'?'#88834e':'#63877a';ctx.beginPath();ctx.ellipse(o.x*scale,o.y*scale,o.radius*scale,o.radius*o.aspect*scale,o.rotation,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.fillStyle='#705741';
  for(let iy=0;iy<grid;iy+=3)for(let ix=0;ix<grid;ix+=3){
   if(!map.generated?.battlefield&&map.blocked[iy*grid+ix])
    ctx.fillRect(ix/grid*width,iy/grid*height,3*width/grid,3*height/grid);
  }
  // The strategic control points are drawn below fog; unexplored ownership
  // must never become visible only because the mini-map was refreshed.
  for(const t of this.game.territories){
   ctx.fillStyle=t.owner===0?colors.blue:t.owner===1?colors.red:'#eed3a0';
   ctx.beginPath();ctx.arc(t.point.x*scale,t.point.y*scale,3,0,Math.PI*2);ctx.fill();
   if(t.progress>0&&t.capturing>=0){
    ctx.lineWidth=2;ctx.strokeStyle=t.capturing===0?'#53f4e2':'#ff7151';
    ctx.beginPath();ctx.arc(t.point.x*scale,t.point.y*scale,6,0,Math.PI*2);ctx.stroke();
   }
  }
  // Old mini-map shaded one 4x4 block from its top-left sample. A soldier
  // standing in a visible cell could therefore still appear in black.
  // Rasterize the SAME 240x240 visibility cells and opacities used by the
  // Three.js fog texture, then scale the one-pixel-per-cell image.
  if(this.fogEnabled){
   if(!this.miniFogCanvas){
    this.miniFogCanvas=document.createElement('canvas');
    this.miniFogCanvas.width=grid;this.miniFogCanvas.height=grid;
    this.miniFogContext=this.miniFogCanvas.getContext('2d');
    this.miniFogPixels=this.miniFogContext.createImageData(grid,grid);
   }
   const pixels=this.miniFogPixels.data;
   const visible=this.game.visible[0],explored=this.game.explored[0];
   for(let i=0;i<grid*grid;i++){
    const k=i*4;
    pixels[k]=24;pixels[k+1]=30;pixels[k+2]=31;
    pixels[k+3]=visible[i]?0:explored[i]?215:255;
   }
   this.miniFogContext.putImageData(this.miniFogPixels,0,0);
   const smoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
   ctx.drawImage(this.miniFogCanvas,0,0,width,height);
   ctx.imageSmoothingEnabled=smoothing;
  }
  // Friendly units always remain readable on top of the mini-map fog.
  for(const u of this.game.units)if(u.hp>0&&(u.owner===0||this.game.canSee(0,u))){
   ctx.fillStyle=u.owner===0?'#53f4e2':'#ff7151';
   ctx.fillRect(u.x*scale-1.3,u.y*scale-1.3,3,3);
  }
  // Player-only impact positions are known from actual damage, not enemy sightings.
  // Keep the classic red beacon above fog and units, even at unexplored edges.
  for(const alert of this.game.attackAlerts.visible(this.game.time)){
   const alpha=attackBlinkAlpha(this.game.time,alert.at,
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
   if(alpha<=0)continue;
   const x=alert.x*scale,y=alert.y*scale;
   ctx.save();ctx.globalAlpha=alpha;
   ctx.fillStyle='#fc2929';ctx.strokeStyle='#ff3d35';ctx.lineWidth=2.6;
   ctx.beginPath();ctx.arc(x,y,7.2,0,Math.PI*2);ctx.fill();
   ctx.beginPath();ctx.arc(x,y,11.5+(1-alpha)*2,0,Math.PI*2);ctx.stroke();
   ctx.restore();
  }
  // A fixed 22x22 square cannot represent the rotated, tilted orthographic
  // camera. Project its four actual ground-plane screen corners instead.
  this.camera.updateMatrixWorld(true);
  const plane=new THREE.Plane(UP,-this.controls.target.y);
  const ray=new THREE.Raycaster(),hit=new THREE.Vector3(),corners=[];
  for(const [x,y] of [[-1,1],[1,1],[1,-1],[-1,-1]]){
   ray.setFromCamera(new THREE.Vector2(x,y),this.camera);
   if(!ray.ray.intersectPlane(plane,hit))break;
   corners.push(worldToMinimap(hit.x,hit.z,map.size,width,height));
  }
  this.miniViewportCorners=corners;
  if(corners.length===4){
   ctx.strokeStyle='#fff7d8';ctx.lineWidth=1.5;ctx.beginPath();
   ctx.moveTo(corners[0].x,corners[0].y);
   for(const p of corners.slice(1))ctx.lineTo(p.x,p.y);
   ctx.closePath();ctx.stroke();
  }
 }
 /** Double-click on one friendly actor chooses all same-class actors on the
  * current camera screen, not every matching unit in the world or fog.
  * Shift+double click adds the visible class to the existing selection.
  * The native dblclick event comes AFTER the normal second pointerup. */
 selectSameKindOnScreen(event){
  if(event.button!==0||this.buildKind||this.rallyMode||this.attackMode)return 0;
  const hit=this.friendlyAtPointer(event);
  if(!hit||hit.type!=='unit'||hit.entity.owner!==0||hit.entity.hp<=0||
   hit.entity.carrier)return 0;
  const canvas=this.renderer.domElement,rect=canvas.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return 0;
  this.camera.updateMatrixWorld(true);
  const projected=new THREE.Vector3();
  const ids=sameKindVisibleUnits(this.game.units,this.units,hit.entity.kind,{
   project:node=>projected.copy(node.position).project(this.camera),
   isVisible:ndc=>{
    const x=rect.left+(ndc.x+1)*rect.width*.5;
    const y=rect.top+(1-ndc.y)*rect.height*.5;
    // Skip units physically under HUD panels even when their 3D points
    // are technically within the renderer's fullscreen viewport.
    const front=document.elementFromPoint?.(x,y);
    return !front||front===canvas||canvas.contains(front);
   }
  });
  if(!ids.length)return 0;
  this.selected=event.shiftKey?new Set([...this.selected,...ids]):new Set(ids);
  this.selectedBase=null;
  this.rallyMode=false;
  this.sound?.select?.();
  this.message(ids.length+'× '+UNITS[hit.entity.kind].name+' auf dem Bildschirm markiert');
  this.drawInterface();
  return ids.length;
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
 terrainPoint(event,{snapEdge=false}={}){
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height||event.clientX<rect.left||event.clientX>rect.right||
     event.clientY<rect.top||event.clientY>rect.bottom)return null;
  const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  this.camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
  const hits=ray.intersectObjects(this.groundMeshes,false);
  if(hits.length){
   const p=hits[0].point;return {x:p.x+this.world.size*.5,y:p.z+this.world.size*.5};
  }
  // With a tilted camera, a slightly off-map right click has no sand
  // triangle to intersect. Use a local terrain plane and snap only within
  // a narrow overscan; normal building/selection remains ground-mesh only.
  if(!snapEdge)return null;
  const half=this.world.size*.5,point=new THREE.Vector3();
  if(!ray.ray.intersectPlane(new THREE.Plane(UP,-this.controls.target.y),point))return null;
  const first=snapToPlayableEdge({x:point.x+half,y:point.z+half},this.world.size);
  if(!first)return null;
  const height=this.heightAt(first.x,first.y);
  if(Number.isFinite(height))ray.ray.intersectPlane(new THREE.Plane(UP,-height),point);
  return snapToPlayableEdge({x:point.x+half,y:point.z+half},this.world.size);
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
 bastionAtPointer(event,groundPoint=null){
  // The Canvas RTS snaps a right-click on a capture site to the actual
  // control-point center. A tilted WebGL camera instead raycasts sand
  // BEHIND the tall tower, frequently outside the 95-unit capture radius.
  // Recognize both the terrain near the site and the visible 3D model.
  const capturable=this.game.territories.filter(t=>t.owner!==0);
  if(groundPoint){
   const near=capturable.filter(t=>dist(t.point,groundPoint)<=RULES.captureRadius+34)
    .sort((a,b)=>dist(a.point,groundPoint)-dist(b.point,groundPoint))[0];
   if(near)return near;
  }
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const targets=capturable.map(t=>({territory:t,node:this.bastions.get(t.id)?.node}))
   .filter(item=>item.node?.visible);
  if(!targets.length)return null;
  const ndc=new THREE.Vector2(
   (event.clientX-rect.left)/rect.width*2-1,
   1-(event.clientY-rect.top)/rect.height*2);
  this.camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(ndc,this.camera);
  const rootOf=new Map(targets.map(item=>[item.node,item.territory]));
  for(const hit of ray.intersectObjects(targets.map(item=>item.node),true)){
   let node=hit.object;
   while(node&&!rootOf.has(node))node=node.parent;
   if(node)return rootOf.get(node);
  }
  return null;
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
 transportAtPointer(event){
  // Pick the friendly Humvee or transport helicopter model before ground terrain.
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const candidates=this.game.units.filter(u=>['rover','scout'].includes(u.kind)&&u.owner===0&&u.hp>0&&
   !u.carrier&&this.units.get(u.id)?.node.visible);
  if(!candidates.length)return null;
  const ndc=new THREE.Vector2(
   (event.clientX-rect.left)/rect.width*2-1,
   1-(event.clientY-rect.top)/rect.height*2);
  this.camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
  const targets=new Map(candidates.map(u=>[this.units.get(u.id).node,u]));
  for(const hit of ray.intersectObjects([...targets.keys()],true)){
   let node=hit.object;
   while(node&&!targets.has(node))node=node.parent;
   if(node)return targets.get(node);
  }
  // Small fallback while an asset loads or at a high tactical zoom.
  const projection=new THREE.Vector3();
  let best=null,bestDistance=Infinity;
  for(const u of candidates){
   const node=this.units.get(u.id).node;
   projection.copy(node.position);projection.y+=Math.min(28,(unitSpec(u).width??76)*.22);
   projection.project(this.camera);
   if(projection.z<-1||projection.z>1)continue;
   const dx=rect.left+(projection.x+1)*rect.width*.5-event.clientX;
   const dy=rect.top+(1-projection.y)*rect.height*.5-event.clientY;
   const distance=Math.hypot(dx,dy);
   const radius=Math.max(15,Math.min(36,19*this.camera.zoom));
   if(distance<radius&&distance<bestDistance){best=u;bestDistance=distance;}
  }
  return best;
 }
 unloadPassenger(carrierId,passengerId){
  const carrier=this.game.units.find(u=>u.id===carrierId&&u.owner===0&&u.hp>0&&
   ['rover','scout'].includes(u.kind)&&this.selected.has(u.id));
  const passenger=this.game.units.find(u=>u.id===passengerId&&u.carrier===carrierId);
  if(!carrier||!passenger||!carrier.transport?.cargo.includes(passengerId))return false;
  const point=this.world.nearest({x:carrier.x+105,y:carrier.y+75},this.game.obstacles());
  const done=Boolean(point&&this.game.transports.unload(carrier.id,point,passenger.id));
  this.message(done?(UNITS[passenger.kind]?.name??'Soldat')+' wird einzeln ausgeladen':
   'Einzeln ausladen derzeit nicht möglich · Freie Fläche suchen');
  this.drawInterface();return done;
 }
 unloadSelectedTransport(){
  const transports=selectedLoadedTransports(this.game.units,this.selected);
  if(!transports.length){this.message('Zum Aussteigen einen besetzten Transporter auswählen');return 0;}
  let done=0;
  for(const carrier of transports){
   // The helicopter lands at a clear site; Humvee occupants step out nearby.
   const point=this.world.nearest({x:carrier.x+105,y:carrier.y+75},this.game.obstacles());
   if(point&&this.game.transports.unload(carrier.id,point))done++;
  }
  this.message(done?done+' Transporter: Soldaten werden ausgeladen':
   'Aussteigen hier nicht möglich · Freie Fläche suchen');
  this.drawInterface();return done;
 }
 pointerUp(event){
  if(!this.clickStart||event.button!==this.clickStart.button)return;
  const start=this.clickStart;
  const moved=Math.hypot(event.clientX-start.x,event.clientY-start.y);
  this.clickStart=null;this.selectionBox.style.display='none';
  const gesture=pointerGestureIntent({distance:moved,button:event.button,
   building:Boolean(this.buildKind),rally:this.rallyMode,strategic:this.strategicTargetMode});
  if(gesture==='selection-box'){
   this.selectBoxUnits(start.x,start.y,event.clientX,event.clientY,event.shiftKey);
   return;
  }
  if(gesture==='ignore-drag'){
   if(this.buildKind)this.message('Bauplatz weiterhin aktiv · kurz klicken statt ziehen');
   return;
  }
  if(event.button===2&&this.strategicTargetMode){
   this.strategicTargetMode=false;
   this.message('Raketenziel-Modus beendet');
   this.drawInterface();return;
  }
  if(event.button===2&&this.buildKind){
   this.clearPlacement();this.message('Bauplatzwahl abgebrochen');this.drawInterface();return;
  }
  // Simulation supports four Humvee seats and ten helicopter seats.
  // An RMB hit on either owned carrier boards selected infantry before terrain movement.
  // Board BEFORE the terrain ray and other click commands.
  if(event.button===2&&this.selected.size&&!this.attackMode&&this.selectedBase===null){
   const carrier=this.transportAtPointer(event);
   const ids=selectedInfantryForTransport(this.game.units,this.selected,carrier);
   if(ids.length){
    const accepted=this.game.command(ids,{
     kind:'board',target:carrier.id,x:carrier.x,y:carrier.y
    });
    this.message(accepted?accepted+' Soldat(en): Zum '+(carrier.kind==='scout'?'Hubschrauber':'Humvee')+' einsteigen':
     'Einsteigen nicht möglich · Plätze, Entfernung und Weg prüfen');
    if(accepted){this.sound?.command?.();this.showCommandPulse({x:carrier.x,y:carrier.y});}
    this.drawInterface();return;
   }
  }
  // Select the actual 3D unit model BEFORE terrain raycasting.
  // A small engineer can be clicked on its upper body even when the sand
  // behind it is outside the terrain collider, or under a building edge.
  if(event.button===0&&!this.buildKind&&!this.rallyMode&&!this.strategicTargetMode){
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
    this.sound?.select?.();this.drawInterface();return;
   }
  }
  // Right-click an enemy to attack; right-click the 3D bastion itself
  // (or its nearby capture ring) to issue a genuine capture approach order.
  const clickedEnemy=event.button===2&&this.selected.size?this.enemyAtPointer(event):null;
  const groundPoint=clickedEnemy?null:this.terrainPoint(event,{snapEdge:event.button===2||this.rallyMode});
  const clickedBastion=event.button===2&&this.selected.size&&!clickedEnemy
   ?this.bastionAtPointer(event,groundPoint):null;
  const p=clickedEnemy?{x:clickedEnemy.x,y:clickedEnemy.y}
   :clickedBastion?{...clickedBastion.point}:groundPoint;
  if(!p){
   if(this.strategicTargetMode)this.message('Raketen-Ziel außerhalb der Karte');
   if(event.button===2&&this.selected.size)this.message('Marschziel außerhalb der Karte');
   return;
  }
  if(this.strategicTargetMode&&event.button===0){
   const launched=this.game.launchStrategicMissile(0,p);
   if(launched){
    this.strategicTargetMode=false;
    this.showCommandPulse(p,true);
    this.message('RAKETE GESTARTET · Einschlag in 25 Sekunden');
   }else this.message('Ziel ungültig: Silo bereit und Ziel erkundet?');
   this.drawInterface();return;
  }
  // Immediate acknowledgment, including an unselected RMB click; no pulse
  // for clicks outside the terrain or for a right-button drag.
  if(event.button===2)this.showCommandPulse(p,Boolean(clickedEnemy)||this.attackMode);
  if(event.button===0){
   if(this.rallyMode){
    const base=this.game.bases.find(b=>b.id===this.selectedBase&&b.owner===0&&b.hp>0&&b.buildRemaining<=0);
    this.rallyMode=false;
    if(base){base.rally={x:p.x,y:p.y};this.message('Sammelpunkt gesetzt: '+BUILDINGS[base.kind].name);}
    else this.message('Produktionsgebäude nicht mehr verfügbar');
    this.drawInterface();return;
   }
   if(this.buildKind){
    const kind=this.buildKind;
    let workers=availableEngineers(this.game.units,this.selected);
    if(!workers.length){
     // A previous mis-click or camera/HUD interaction must not permanently
     // strand placement mode; recover a living pioneer automatically.
     const center={x:p.x,y:p.y},worker=nearestEngineer(this.game.units,center);
     if(worker){
      workers=[worker];this.selected=new Set([worker.id]);this.selectedBase=null;
     }
    }
    if(!workers.length){
     this.message('Kein Pionier verfügbar · im Feldkommando ausbilden');return;
    }
    const blocked=this.game.buildError(0,kind,p);
    if(blocked){this.message(blocked+' · Pionier bleibt ausgewählt');return;}
    const append=shouldAppendBuild(workers,event.shiftKey);
    const result=this.game.build(0,kind,p,workers.map(u=>u.id),this.placementFacing,append);
    if(result){
     this.sound?.command?.();
     this.message(BUILDINGS[kind].name+(append?' zur Pionier-Baufolge hinzugefügt':' beauftragt')+
      ' · Pionier bleibt ausgewählt');
     if(!event.shiftKey)this.clearPlacement();
     this.sync(true);
    }else this.message('Pionier kann Bauplatz nicht erreichen · Standort ändern (Pionier bleibt ausgewählt)');
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
   this.message(accepted?(clickedBastion
    ?accepted+' Einheit(en): Bastion '+clickedBastion.name+' ansteuern'
    :accepted+' Einheit(en): '+(clickedEnemy?'Ziel angreifen':this.attackMode?'Angriff':'Marsch'))
    :'Ziel nicht erreichbar');
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
   if(this.buildKind||this.rallyMode||this.strategicTargetMode)return;
   if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<POINTER_CLICK_SLOP)return;
   Object.assign(this.selectionBox.style,{
    display:'block',left:Math.min(start.x,e.clientX)+'px',
    top:Math.min(start.y,e.clientY)+'px',
    width:Math.abs(e.clientX-start.x)+'px',
    height:Math.abs(e.clientY-start.y)+'px'
   });
  });
  canvas.addEventListener('pointerup',e=>this.pointerUp(e));
  canvas.addEventListener('dblclick',e=>{if(e.button===0&&this.selectSameKindOnScreen(e))e.preventDefault();});
  window.addEventListener('pointerup',e=>{if(this.clickStart)this.pointerUp(e);});
  canvas.addEventListener('pointerleave',()=>{if(this.buildPreview)this.buildPreview.visible=false;this.buildHint.style.display='none';});
  const resetPointerGesture=()=>{
   this.clickStart=null;
   this.selectionBox.style.display='none';
   if(this.buildPreview)this.buildPreview.visible=false;
   this.buildHint.style.display='none';
  };
  canvas.addEventListener('pointercancel',resetPointerGesture);
  // Losing focus during a drag must never leave a selection rectangle
  // or an armed placement/attack/rally mode behind.
  const cancelTransientModes=()=>{
   const hadMode=Boolean(this.buildKind||this.attackMode||this.rallyMode);
   resetPointerGesture();
   if(!hadMode)return;
   this.clearPlacement();
   this.attackMode=false;
   this.rallyMode=false;
   this.drawInterface();
  };
  window.addEventListener('blur',cancelTransientModes);
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden)cancelTransientModes();
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
   if(!this.rallyMode&&!this.buildKind&&!this.attackMode&&!this.strategicTargetMode)return;
   event.preventDefault();
   this.clearPlacement();
   this.attackMode=false;
   this.rallyMode=false;
   this.drawInterface();
  },true);
  document.addEventListener('keydown',event=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(event.code==='KeyR'&&this.buildKind){
    if(event.repeat)return;
    event.preventDefault();
    this.placementFacing=nextBuildingFacing(this.placementFacing);
    const degrees=buildingFacingDegrees(this.placementFacing);
    if(this.buildPreview)this.buildPreview.rotation.y=buildingFacingAngle(this.placementFacing);
    if(this.buildHint?.style.display!=='none'){
     const hint=this.buildHint;
     hint.textContent=hint.textContent.replace(/R drehen \(\d+°\)/,'R drehen ('+degrees+'°)');
    }
    this.sound?.select?.();this.message('Gebäudeausrichtung '+degrees+'° · R für nächste Richtung');
   }
   if(event.code==='KeyF'){this.attackMode=true;this.message('Angriffsbewegung: Rechtsklick auf Ziel');}
   if(event.code==='KeyU'){event.preventDefault();this.unloadSelectedTransport();}
   if(event.code==='KeyH'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.drawInterface();}
   if(event.code==='KeyP'&&!event.repeat){event.preventDefault();this.selectEngineer();}
   const number=Number(event.code.replace('Digit',''));
   if(event.code.startsWith('Digit')&&number>=1&&number<=5){
    if(event.ctrlKey||event.metaKey){event.preventDefault();this.groups.set(number,new Set(this.selected));this.message('Gruppe '+number+' gespeichert');}
    else if(this.groups.has(number)){this.selected=new Set([...this.groups.get(number)].filter(id=>this.units.has(id)));this.drawInterface();}
   }
  });
 }
}
