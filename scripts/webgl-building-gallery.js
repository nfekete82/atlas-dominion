import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {BUILDINGS,UNITS} from '/src/reborn/catalog.js';
import {calibratedScale,strategicBuildingHeightScale,visualUnitScale,buildingFacingAngle,nextBuildingFacing,authoredBuildingGroundY} from './webgl-scale.js';
import {strategicGlbUrl,applyStrategicGlbFinish,centerAuthoredRadarPivot,ensureHeadquartersSatelliteMount} from './webgl-strategic-glb.js';
import {setWorldCamouflageBiome,tintFactionMaterials} from './webgl-faction-accents.js';
import {BUILDING_DESIGN_REVISION} from './webgl-building-design.js';
import {BUILDING_MEASUREMENTS} from './webgl-hq3-reference.js';
import {renderedBuildingBounds} from './webgl-building-bounds.js';
import {simplifyBarracksSilhouette} from './webgl-barracks-silhouette.js';
import {createBuildingYard,disposeBuildingYard} from './webgl-building-yard.js';
import {createAirfieldServiceYard,hideOldAirfieldHangar,updateAirfieldServiceYard,disposeAirfieldServiceYard} from './webgl-airfield-service.js';
import {createFactoryServiceYard,disposeFactoryServiceYard} from './webgl-factory-service.js';
import {createStrategicBuilding} from './webgl-strategic-buildings.js';
import {prepareAuthoredAssembly,updateAuthoredAssembly,releaseAuthoredAssembly} from './webgl-construction-assembly.js';
import {SandforgeProductionGates,applyProductionGatePose,productionGatePose} from './webgl-production-gates.js';
import {barracksExitLane,barracksDeparturePoint,updateBarracksPortalPlanes} from './webgl-barracks-portal.js';
import {prepareSiloHatch,poseSiloHatch} from './webgl-building-motion.js';
import {BIOME_STYLES} from './webgl-biomes.js';

const gallery=document.querySelector('#gallery'),perf=document.querySelector('#performance');
const loader=new GLTFLoader(),models=new Map(),entries=[];
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.domElement.className='renderer';document.body.append(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.96;renderer.autoClear=false;renderer.info.autoReset=false;
renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
let biome='desert',zoom=1.25,progress=1,scheduled=false,animationFrame=0,last=0,loading=false;
const getModel=url=>{
 if(!models.has(url))models.set(url,loader.loadAsync(url).catch(e=>{models.delete(url);throw e;}));
 return models.get(url);
};
// One shared, repeatable desert floor for all comparison cells.
const floorMap=new THREE.DataTexture(new Uint8Array(128*128*4),128,128);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const n=((Math.imul(x+17,73856093)^Math.imul(y+31,19349663))>>>0)%5-2;
 floorMap.image.data.set([181+n,158+n,119+n,255],(y*128+x)*4);
}
floorMap.colorSpace=THREE.SRGBColorSpace;floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;
floorMap.repeat.set(20,20);floorMap.needsUpdate=true;
const floorGeometry=new THREE.PlaneGeometry(1800,1800);
const simulation={productionReleases:[],time:0};
const gates=new SandforgeProductionGates({game:simulation,renderer});
const api=window.__sandforgeBuildingGallery={entries,renderer,ready:false,errors:[],render:()=>render(),setProgress:value=>setProgress(value),setBiome:value=>reload(value)};
function resetCamera(entry){
 const r=entry.viewport.getBoundingClientRect(),aspect=r.width/Math.max(1,r.height),span=470;
 entry.camera.left=-span*aspect/2;entry.camera.right=span*aspect/2;
 entry.camera.top=span/2;entry.camera.bottom=-span/2;
 entry.camera.zoom=zoom;entry.camera.position.set(330,290,410);
 entry.camera.lookAt(0,45,0);entry.camera.updateProjectionMatrix();
 entry.controls.target.set(0,45,0);entry.controls.update();
}
function newCell(kind){
 const spec=BUILDINGS[kind]??{name:'Bastion MK2'};
 const card=document.createElement('article');card.className='card';card.dataset.kind=kind;
 card.innerHTML=`<h2>${spec.name}${kind==='headquarters'?'<span>GOLDREFERENZ</span>':''}</h2><div class="viewport" aria-label="3D-Ansicht ${spec.name}"><span class="loading">GLB wird geladen …</span></div><footer><p class="dimensions">Maße werden gemessen …</p><p class="profile"></p><p class="source"></p><div class="actions"><button data-action="rotate">Ausrichtung · 0°</button><button data-action="animate">Animation</button><button data-action="inspect">Untersuchen</button></div></footer>`;
 gallery.append(card);
 const viewport=card.querySelector('.viewport'),scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-300,300,235,-235,1,4000);
 const controls=new OrbitControls(camera,viewport);controls.enableDamping=false;
 controls.enablePan=true;controls.minZoom=.4;controls.maxZoom=8;controls.maxPolarAngle=Math.PI*.49;
 controls.addEventListener('change',requestRender);
 const ground=new THREE.Mesh(floorGeometry,new THREE.MeshStandardMaterial({map:floorMap,roughness:.96}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.35;ground.receiveShadow=true;scene.add(ground);
 const node=new THREE.Group();scene.add(node);
 const entry={kind,owner:0,card,viewport,scene,camera,controls,node,ground,facing:0,assemblies:[],animating:false};
 entry.facing=['barracks','research'].includes(kind)?1:0;node.rotation.y=buildingFacingAngle(entry.facing);
 card.querySelector('[data-action="rotate"]').textContent='Ausrichtung · '+Math.round(THREE.MathUtils.radToDeg(node.rotation.y))+'°';
 entries.push(entry);resetCamera(entry);
 const filter=document.querySelector('#filter'),option=document.createElement('option');option.value=kind;option.textContent=spec.name;filter.append(option);
 card.querySelector('[data-action="rotate"]').onclick=event=>{
  entry.facing=nextBuildingFacing(entry.facing);node.rotation.y=buildingFacingAngle(entry.facing);
  event.currentTarget.textContent='Ausrichtung · '+Math.round(THREE.MathUtils.radToDeg(node.rotation.y))+'°';requestRender();
 };
 card.querySelector('[data-action="animate"]').onclick=()=>{
  if(!entry.detail)return;entry.animating=!entry.animating;entry.age=0;entry.animateTime=0;
  entry.card.querySelector('[data-action="animate"]').textContent=entry.animating?'Animation stoppen':'Animation';
  if(!entry.animating)pose(entry,0,0);requestRender();
 };
 card.querySelector('[data-action="inspect"]').onclick=()=>{
  card.classList.toggle('inspect');viewport.style.height=card.classList.contains('inspect')?'600px':'';
  card.style.gridColumn=card.classList.contains('inspect')?'1 / -1':'';
  resetCamera(entry);card.scrollIntoView({block:'center',behavior:'smooth'});requestRender();
 };
 return entry;
}
function lightCell(entry){
 for(const light of entry.lights??[]){entry.scene.remove(light);light.shadow?.map?.dispose();}
 const style=BIOME_STYLES[biome],sun=new THREE.DirectionalLight(style.sunlight,2.85);
 sun.position.set(-700,1100,420);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-480,right:480,top:480,bottom:-480,near:1,far:2200});
 sun.shadow.bias=-.00006;sun.shadow.normalBias=.038;
 const fill=new THREE.DirectionalLight(style.fill,.40);fill.position.set(650,500,-450);
 entry.lights=[new THREE.HemisphereLight(style.sky,style.bounce,1.20),sun,fill];
 entry.scene.add(...entry.lights);entry.scene.background=new THREE.Color('#ad9879');
 // Keep the comparison floor constant, including during biome inspection.
}
function normalizeModel(model,kind){
 if(kind==='barracks')simplifyBarracksSilhouette(model);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const scale=kind==='bastion'?116/Math.max(size.x,size.z):calibratedScale(kind,'building',size,BUILDINGS[kind].width);
 const ys=strategicBuildingHeightScale(kind);
 model.scale.multiplyScalar(scale);model.scale.y*=ys;
 model.position.set(-center.x*scale,-authoredBuildingGroundY(kind,box)*scale*ys,-center.z*scale);
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 if(['headquarters','barracks','research','silo','bastion'].includes(kind))applyStrategicGlbFinish(model);
 tintFactionMaterials(model,0,kind,'building');
 return model;
}
async function populate(entry){
 const {kind}=entry;lightCell(entry);
 const file=kind==='bastion'?'/src/assets/reborn/buildings-3d/sandforge_bastion_mk2_offline.glb':
  strategicGlbUrl(kind,kind==='barracks'?'active':'inactive')??'/src/assets/reborn/buildings-3d/'+kind+'-0.glb';
 if(['interceptor','wall'].includes(kind)){
  entry.detail=createStrategicBuilding(kind,0);tintFactionMaterials(entry.detail,0,kind,'building');
 }else{
  const data=await getModel(file);entry.detail=normalizeModel(cloneSkeleton(data.scene),kind);
  if(['barracks','silo','research'].includes(kind)){
   const variantUrl=strategicGlbUrl(kind,kind==='barracks'?'inactive':'active');
   const variant=await getModel(variantUrl);entry.variantDetail=normalizeModel(cloneSkeleton(variant.scene),kind);entry.variantDetail.visible=false;
   entry.node.add(entry.variantDetail);
  }
 }
 entry.node.add(entry.detail);
 if(['factory','barracks','headquarters'].includes(kind))gates.prepare(entry);
 if(kind==='headquarters'){
  entry.rotor=centerAuthoredRadarPivot(entry.detail.getObjectByName('RADAR_DISH_PIVOT'));
  ensureHeadquartersSatelliteMount(entry.rotor);
 }else if(kind==='research')entry.rotor=entry.variantDetail?.getObjectByName('radar_assembly_PIVOT');
 else if(kind==='bastion')entry.rotor=centerAuthoredRadarPivot(entry.detail.getObjectByName('Radar_Dish_Pivot'));
 else if(kind==='turret')entry.rotor=entry.detail.getObjectByName('TurretHead');
 if(entry.rotor)entry.rotorRest=entry.rotor.rotation.y;
 if(kind==='silo')prepareSiloHatch(entry);
 entry.yard=createBuildingYard(kind,BUILDINGS[kind]?.width);
 if(entry.yard)entry.node.add(entry.yard);
 if(kind==='airfield'){
  hideOldAirfieldHangar(entry);entry.airfieldServiceYard=createAirfieldServiceYard();entry.node.add(entry.airfieldServiceYard);
 }
 if(kind==='factory'){entry.factoryServiceYard=createFactoryServiceYard();entry.node.add(entry.factoryServiceYard);}
 const primary=entry.airfieldServiceYard??entry.detail;
 const size=renderedBuildingBounds(primary).getSize(new THREE.Vector3());
 const area=renderedBuildingBounds(entry.node).getSize(new THREE.Vector3());
 entry.renderSize=size.toArray();entry.areaSize=area.toArray();
 const dimensions=a=>a.map(n=>n.toFixed(1)).join(' × ');
 entry.card.querySelector('.dimensions').textContent='Render B × H × T: '+dimensions(entry.renderSize)+' · Areal: '+dimensions(entry.areaSize);
 entry.card.querySelector('.profile').textContent=kind==='headquarters'?'HQ3 · originale UV-Texturen und PBR':biome==='desert'?'HQ3 · Albedo / Normal / PBR · '+BUILDING_DESIGN_REVISION:BIOME_STYLES[biome].label+' · bestehendes Biomprofil';
 entry.card.querySelector('.source').textContent=['interceptor','wall'].includes(kind)?'Prozedurales Original aus dem Spiel':file.split('/').pop();
 const soldier=await getModel('/src/assets/reborn/prototype/infantry-0.glb');
 const person=cloneSkeleton(soldier.scene),bounds=new THREE.Box3().setFromObject(person),s=bounds.getSize(new THREE.Vector3());
 const scale=calibratedScale('infantry','unit',s,UNITS.infantry.width)*visualUnitScale('infantry');
 person.scale.multiplyScalar(scale);person.position.set(-size.x*.5-26,-bounds.min.y*scale,85);
 tintFactionMaterials(person,0,'infantry','unit');person.traverse(o=>{if(o.isMesh)o.castShadow=true;});entry.node.add(person);entry.person=person;
 if(['barracks','headquarters'].includes(kind)){
  entry.departing=cloneSkeleton(person);entry.departing.visible=false;entry.node.add(entry.departing);
  const walk=soldier.animations.find(a=>/walk/i.test(a.name));
  if(walk){entry.walkMixer=new THREE.AnimationMixer(entry.departing);entry.walkMixer.clipAction(walk).play();}
 }
 for(const root of [entry.detail,entry.variantDetail,entry.yard,entry.airfieldServiceYard,entry.factoryServiceYard]){
  if(!root)continue;
  entry.assemblies.push(prepareAuthoredAssembly(root));
 }
 setEntryProgress(entry);entry.card.querySelector('.loading')?.remove();requestRender();
}
function setEntryProgress(entry){
 for(const assembly of entry.assemblies)updateAuthoredAssembly(assembly,progress);
 for(const root of [entry.yard])root?.traverse(o=>{if(o.isInstancedMesh)o.visible=progress>=.86;});
 // Construction uses the genuine closed Kaserne, matching the live renderer.
 if(entry.kind==='barracks'&&entry.variantDetail){entry.detail.visible=progress>=1;entry.variantDetail.visible=progress<1;}
 if(entry.departing&&progress<1)entry.departing.visible=false;
}
function setProgress(value){
 progress=THREE.MathUtils.clamp(Number(value),0,1);
 document.querySelector('#construction').value=progress*100;document.querySelector('#progress').textContent=Math.round(progress*100)+' %';
 for(const entry of entries)setEntryProgress(entry);requestRender();
}
function pose(entry,age,dt){
 const pose=productionGatePose(age%6.5),open=pose.open;
 if(entry.gate)applyProductionGatePose(entry.gate,pose);
 if(entry.rotor)entry.rotor.rotation.y=entry.rotorRest+age*(entry.kind==='research'?.20:.52);
 if(entry.kind==='research'&&entry.variantDetail){entry.detail.visible=!entry.animating;entry.variantDetail.visible=entry.animating;}
 if(entry.strategicHatch){
  poseSiloHatch(entry.strategicHatch,open);entry.detail.visible=false;entry.variantDetail.visible=true;
 }
 if(entry.airfieldServiceYard)updateAirfieldServiceYard(entry,{id:1},entry.animating?[{hp:1,airfieldService:{baseId:1,phase:age%9<6?'taxiIn':'ready'}}]:[],age,dt);
 if(entry.departing){
  const active=pose.moving&&open>.99;entry.departing.visible=active;
  if(active){
   const lane=entry.kind==='barracks'?barracksExitLane(entry.gate.portal):
    {inside:new THREE.Vector3(0,.6,-.48),outside:new THREE.Vector3(0,-.4,2.85)};
   const position=entry.kind==='barracks'?barracksDeparturePoint(entry.gate.portal,pose.drive):lane.inside.lerp(lane.outside,pose.drive);
   entry.gate.root.localToWorld(position);entry.node.worldToLocal(position);entry.departing.position.copy(position);
   entry.departing.rotation.y=entry.kind==='barracks'?Math.PI:0;entry.walkMixer?.update(dt);
  }
 }
}
function requestRender(){if(!scheduled){scheduled=true;animationFrame=requestAnimationFrame(render);}}
function render(time=performance.now()){
 scheduled=false;const dt=last?Math.min(.1,(time-last)/1000):0;last=time;
 renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.info.reset();renderer.setScissorTest(true);
 let views=0,active=false;
 for(const entry of entries){
  if(entry.animating&&progress>=1){entry.age=(entry.age??0)+dt;pose(entry,entry.age,dt);active=true;}
  const r=entry.viewport.getBoundingClientRect();
  if(entry.card.hidden||r.bottom<=0||r.top>=innerHeight)continue;
  const bottom=Math.max(0,innerHeight-r.bottom),top=Math.min(innerHeight,innerHeight-r.top);
  if(top<=bottom)continue;
  renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);
  renderer.setScissor(Math.max(0,r.left),bottom,Math.min(innerWidth,r.right)-Math.max(0,r.left),top-bottom);
  if(entry.barracksPortal)updateBarracksPortalPlanes(entry.barracksPortal);
  renderer.render(entry.scene,entry.camera);views++;
 }
 perf.textContent=`${views} Ansichten · ${renderer.info.render.calls} Draws · ${Math.round(renderer.info.render.triangles/1000)}k Tris · ${renderer.info.memory.textures} Texturen · ${active&&dt?(1/dt).toFixed(0)+' FPS':'Rendern bei Bedarf'}`;
 api.lastFrame={views,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,programs:renderer.info.programs.length};
 if(active)requestRender();
}
function cleanup(entry){
 for(const assembly of entry.assemblies)releaseAuthoredAssembly(assembly);entry.assemblies=[];
 gates.detach(entry);entry.walkMixer?.stopAllAction();
 if(entry.yard)disposeBuildingYard(entry.yard);
 disposeAirfieldServiceYard(entry);disposeFactoryServiceYard(entry);
 for(const root of [entry.detail,entry.variantDetail,entry.person,entry.departing]){
  const materials=new Set();root?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  for(const mat of materials)mat.dispose();root?.removeFromParent();
 }
 entry.detail=entry.variantDetail=entry.person=entry.departing=entry.gate=null;entry.strategicHatch=null;entry.rotor=null;entry.animating=false;
}
async function reload(value='desert'){
 if(loading)return;loading=true;api.ready=false;
 biome=setWorldCamouflageBiome(value);document.querySelector('#biome').disabled=true;
 renderer.toneMappingExposure=BIOME_STYLES[biome].exposure;
 for(const entry of entries)if(entry.detail)cleanup(entry);
 // Two concurrent GLBs, same limit as the game model queue.
 const queue=[...entries];
 await Promise.all([0,1].map(async()=>{while(queue.length){const entry=queue.shift();try{await populate(entry);}catch(error){api.errors.push(error.message);const label=entry.card.querySelector('.loading')??entry.card.querySelector('.profile');label.classList.add('error');label.textContent='Ladefehler: '+error.message;}}}));
 loading=false;document.querySelector('#biome').disabled=false;api.ready=true;requestRender();
}
for(const kind of ['headquarters','barracks','factory','airfield','research','silo','bastion','generator','turret','interceptor','wall'])newCell(kind);
document.querySelector('#biome').onchange=e=>reload(e.target.value);
document.querySelector('#construction').oninput=e=>setProgress(Number(e.target.value)/100);
document.querySelector('#zoom').oninput=e=>{zoom=Number(e.target.value);for(const entry of entries)resetCamera(entry);requestRender();};
document.querySelector('#reset').onclick=()=>{for(const entry of entries)resetCamera(entry);requestRender();};
document.querySelector('#filter').onchange=e=>{const filter=e.target.value;for(const entry of entries)entry.card.hidden=filter!=='all'&&(filter==='pair'?!['headquarters','barracks'].includes(entry.kind):entry.kind!==filter);for(const entry of entries)resetCamera(entry);requestRender();};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);for(const entry of entries)resetCamera(entry);requestRender();});
addEventListener('scroll',requestRender,{passive:true});
THREE.DefaultLoadingManager.onLoad=requestRender;
await reload();
