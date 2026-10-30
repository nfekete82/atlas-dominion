import * as T from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {buildAtlasBuilding,buildingNames} from './atlas-buildings.js';
import {loadRefinedHeadquarters} from './refined-headquarters.js';
import {loadRefinedBastion} from './refined-bastion.js';
import {applyBuildingPBR,buildingSurfaces} from './building-pbr.js';
import {upgradeBuildingDetails} from './building-details.js';
import {isometricStage} from './isometric-stage.js';
import {bakeHeadquartersAssembly} from './hq-construction-stages.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export function createBuildingExporter({renderer,saveBuilding,saveTurretRig,loadHeadquarters=loadRefinedHeadquarters,loadBastion=loadRefinedBastion,constructionOnly=false}){
const size=512,pivot=[256,382];renderer.setSize(size,size);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const {scene,camera,floor,offset}=isometricStage(size,pivot);
if(renderer.isWebGLRenderer){const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();}
const snapshot=()=>{renderer.render(scene,camera);const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(renderer.domElement,0,0);return c;};
function bounds(canvas,threshold=200){const data=canvas.getContext('2d').getImageData(0,0,size,size).data;let x=size,y=size,r=0,b=0;for(let j=0;j<size;j++)for(let i=0;i<size;i++)if(data[(j*size+i)*4+3]>threshold){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}return {x,y,w:r-x+1,h:b-y+1};}
async function layer(prefix,label,canvases,period){const boxes=canvases.map(c=>bounds(c,16)),left=Math.max(0,Math.min(...boxes.map(b=>b.x))-2),top=Math.max(0,Math.min(...boxes.map(b=>b.y))-2),right=Math.min(size,Math.max(...boxes.map(b=>b.x+b.w))+2),bottom=Math.min(size,Math.max(...boxes.map(b=>b.y+b.h))+2),w=right-left,h=bottom-top,columns=Math.min(8,canvases.length),out=document.createElement('canvas');out.width=w*columns;out.height=h*Math.ceil(canvases.length/columns);const c=out.getContext('2d'),frames=[];canvases.forEach((frame,i)=>{const x=i%columns*w,y=Math.floor(i/columns)*h;c.drawImage(frame,left,top,w,h,x,y,w,h);frames.push({x,y,w,h});});await saveBuilding(prefix+'-'+label+'.png',out.toDataURL('image/png'));return {image:prefix.split('/').at(-1)+'-'+label+'.png',pivot:[pivot[0]-left,pivot[1]-top],frames,period,originalBounds:{x:left,y:top,w,h}};}
return async(requested=[])=>{
 if(!constructionOnly)for(const [label,texture] of Object.entries(buildingSurfaces()))await saveBuilding('textures/desert-'+({map:'basecolor',normalMap:'normal',orm:'orm'}[label])+'.png',texture.image.toDataURL('image/png'));
 for(const kind of Object.keys(buildingNames).filter(k=>!requested.length||requested.includes(k)))for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  // Keep the ground anchor at [256,382] while fitting the wider, longer
  // airbase onto a 512px sprite. Other building cameras stay unchanged.
  const airfieldZoom=kind==='airfield'?.82:1;
  camera.zoom=airfieldZoom;
  camera.position.set(0,8+offset/airfieldZoom,12);
  camera.lookAt(0,offset/airfieldZoom,0);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const {model,clips,dish,beacon,sweep,turret}=kind==='headquarters'?await loadHeadquarters(team):kind==='bastion'?await loadBastion(team):buildAtlasBuilding(kind,team),prefix=kind+'-'+team;
  upgradeBuildingDetails(model,kind,team);
  applyBuildingPBR(model,kind,team);
  // Export the exact surfaces used to bake the sprites, at their authored size.
  // Downsampling to 256px here previously discarded most of the surface detail.
  if(!constructionOnly){const glb=await new GLTFExporter().parseAsync(model,{binary:true,animations:clips,onlyVisible:true,maxTextureSize:2048});await saveBuilding(prefix+'.glb',Array.from(new Uint8Array(glb)));}
  const turn=new T.Group();turn.rotation.y=Math.PI/4;turn.add(model);scene.add(turn);if(dish)dish.visible=false;if(beacon)beacon.visible=false;if(sweep)sweep.visible=false;if(turret)turret.visible=false;floor.visible=true;
  // Progressive assembly is baked from subsets of the actual textured 3D model.
  // Every frame uses exactly the same camera, scale and registered ground pivot
  // as the final building; the Canvas game only selects the stage by buildRemaining.
  if(kind!=='bastion'){
   const excluded=new Set();
   for(const part of [dish,beacon,sweep,turret])part?.traverse(n=>{if(n.isMesh)excluded.add(n);});
   if(kind==='headquarters'){
    const {frames,parts}=bakeHeadquartersAssembly(model,excluded,snapshot);
    const construction=await layer(prefix,'construction',frames,1);
    await saveBuilding(prefix+'-construction.json',JSON.stringify({
     version:1,kind,team,model:prefix+'.glb',parts,stages:construction.frames.length,layer:construction
    },null,2)+'\\n');
   }else{
   const structural=[];
   model.traverse(n=>{if(n.isMesh&&!excluded.has(n)&&n.visible){
    const box=new T.Box3().setFromObject(n,true);
    const name=n.name.toLowerCase();
    const priority=/foundation|footing|slab|floor|plinth|platform|undercarriage/.test(name)?-2:
      /roof|upper|canopy|antenna|mast|vent|solar|sign|fan|light|radio|grille|trim/.test(name)?2:
      /door|gate|wall|column|pillar|frame|beam|armor|support/.test(name)?-.4:0;
    structural.push({mesh:n,score:box.min.y+box.max.y*.12+priority});
   }});
   structural.sort((a,b)=>a.score-b.score||a.mesh.name.localeCompare(b.mesh.name));
   if(structural.length<6)throw Error('Not enough structural parts for staged building: '+kind);
   const original=structural.map(part=>part.mesh.visible),stages=[];
   for(let stage=0;stage<6;stage++){
    const count=Math.max(1,Math.ceil((stage+1)/6*structural.length));
    for(let i=0;i<structural.length;i++)structural[i].mesh.visible=i<count;
    stages.push(snapshot());
   }
   structural.forEach((part,i)=>{part.mesh.visible=original[i];});
   const construction=await layer(prefix,'construction',stages,1);
   await saveBuilding(prefix+'-construction.json',JSON.stringify({
    version:1,kind,team,model:prefix+'.glb',parts:structural.length,stages:construction.frames.length,layer:construction
   },null,2)+'\n');
   }
  }
  if(constructionOnly){scene.remove(turn);continue;}
  const body=snapshot();let solidBounds=bounds(body);await saveBuilding(prefix+'.png',body.toDataURL('image/png'));
  const dynamic=new Set();for(const node of [dish,beacon,sweep,turret])node?.traverse(n=>{if(n.isMesh)dynamic.add(n);});const staticMeshes=[];model.traverse(n=>{if(n.isMesh&&!dynamic.has(n))staticMeshes.push(n);});for(const n of staticMeshes)n.visible=false;floor.visible=false;
  let activity=null,light=null,captureSweep=null,traverse=null;
  if(dish){dish.visible=true;const frames=[],rest=dish.quaternion.clone();for(let i=0;i<64;i++){dish.quaternion.copy(rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i/64*Math.PI*2));frames.push(snapshot());}activity=await layer(prefix,'radar',frames,48);dish.visible=false;}
  if(beacon){beacon.visible=true;light=await layer(prefix,'beacon',[snapshot()],3.8);beacon.visible=false;}
  if(sweep){
   sweep.visible=true;const frames=[],mixer=new T.AnimationMixer(model),clip=clips.find(c=>c.name==='CaptureSweep');if(!clip)throw Error('Missing CaptureSweep clip');mixer.clipAction(clip).play();
   for(let i=0;i<64;i++){mixer.setTime(i/64*clip.duration);frames.push(snapshot());}captureSweep=await layer(prefix,'sweep',frames,clip.duration);mixer.stopAllAction();mixer.uncacheRoot(model);
  }
  if(turret){
   turret.visible=true;const frames=[],muzzles=[],project=p=>{const v=p.clone().project(camera);return [(v.x+1)*size/2,(1-v.y)*size/2];};
   for(let i=0;i<64;i++){
    const angle=i*Math.PI/32;
    // Compensate the isometric foreshortening: each barrel projects along the simulation's actual XY heading.
    turret.rotation.y=Math.atan2(Math.cos(angle),Math.sin(angle)/Math.cos(Math.atan2(12,8)))-turn.rotation.y;
    turn.updateMatrixWorld(true);frames.push(snapshot());muzzles.push(['TurretMuzzleL','TurretMuzzleR'].map(name=>project(model.getObjectByName(name).getWorldPosition(new T.Vector3()))));
   }
   traverse={...await layer(prefix,'turret',frames,2),directions:64,muzzles};
   const boxes=[solidBounds,...frames.map(c=>bounds(c,200))],left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));solidBounds={x:left,y:top,w:right-left,h:bottom-top};
   if(team===0){const origin=project(turret.getWorldPosition(new T.Vector3()));origin[1]=(muzzles[0][0][1]+muzzles[0][1][1])/2;await saveTurretRig({pivot:origin.map((v,j)=>(v-pivot[j])/solidBounds.w),muzzles:muzzles.map(pair=>pair.map(p=>p.map((v,j)=>(v-pivot[j])/solidBounds.w)))});}
   turret.visible=false;
  }
  const top=Math.min(solidBounds.y,activity?.originalBounds.y??size,light?.originalBounds.y??size,captureSweep?.originalBounds.y??size,traverse?.originalBounds.y??size);
  const metadata={version:1,kind,team,design:model.userData.atlasDesign,model:prefix+'.glb',body:{image:prefix+'.png',width:size,height:size,pivot,solidBounds,top},activity,beacon:light,...(traverse?{turret:traverse}:{}),...(captureSweep?{sweep:captureSweep}:{}),clips:clips.map(c=>({name:c.name,duration:c.duration})),bakedShadow:true};
  metadata.baker=renderer.isWebGLRenderer?'three-webgl':'cpu-pbr';
  await saveBuilding(prefix+'.json',JSON.stringify(metadata,null,2)+'\n');scene.remove(turn);const materials=new Set();model.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});for(const m of materials)m.dispose();
 }
};
}
if(typeof window!=='undefined')window.exportBuildings=createBuildingExporter({renderer:new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true}),saveBuilding:(...args)=>window.saveBuilding(...args),saveTurretRig:data=>window.saveTurretRig(data),constructionOnly:new URLSearchParams(location.search).has('constructionOnly')});
