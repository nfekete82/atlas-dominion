import * as T from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {buildAtlasBuilding,buildingNames} from './atlas-buildings.js';
import {loadRefinedHeadquarters} from './refined-headquarters.js';
import {loadRefinedBastion} from './refined-bastion.js';
import {applyFieldFinish} from './field-weathering.js';
const size=512,pivot=[256,382],renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(size,size);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const scene=new T.Scene(),camera=new T.OrthographicCamera(-3.4,3.4,3.4,-3.4,.01,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const shift=(pivot[1]-256)*6.8/size,offset=shift/Math.cos(Math.atan2(8,12));camera.position.y+=offset;camera.lookAt(0,offset,0);camera.updateMatrixWorld();
scene.add(new T.HemisphereLight('#c8dfff','#65482b',1.55));const sun=new T.DirectionalLight('#ffe4be',3.2);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-5;sun.shadow.camera.right=sun.shadow.camera.top=5;sun.shadow.normalBias=.007;scene.add(sun);scene.add(sun.target);
const fill=new T.DirectionalLight('#8ab9df',.65);fill.position.set(5,4,-5);scene.add(fill);const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const snapshot=()=>{renderer.render(scene,camera);const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(renderer.domElement,0,0);return c;};
function bounds(canvas,threshold=200){const data=canvas.getContext('2d').getImageData(0,0,size,size).data;let x=size,y=size,r=0,b=0;for(let j=0;j<size;j++)for(let i=0;i<size;i++)if(data[(j*size+i)*4+3]>threshold){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}return {x,y,w:r-x+1,h:b-y+1};}
async function layer(prefix,label,canvases,period){const boxes=canvases.map(c=>bounds(c,16)),left=Math.max(0,Math.min(...boxes.map(b=>b.x))-2),top=Math.max(0,Math.min(...boxes.map(b=>b.y))-2),right=Math.min(size,Math.max(...boxes.map(b=>b.x+b.w))+2),bottom=Math.min(size,Math.max(...boxes.map(b=>b.y+b.h))+2),w=right-left,h=bottom-top,columns=Math.min(8,canvases.length),out=document.createElement('canvas');out.width=w*columns;out.height=h*Math.ceil(canvases.length/columns);const c=out.getContext('2d'),frames=[];canvases.forEach((frame,i)=>{const x=i%columns*w,y=Math.floor(i/columns)*h;c.drawImage(frame,left,top,w,h,x,y,w,h);frames.push({x,y,w,h});});await window.saveBuilding(prefix+'-'+label+'.png',out.toDataURL('image/png'));return {image:prefix.split('/').at(-1)+'-'+label+'.png',pivot:[pivot[0]-left,pivot[1]-top],frames,period,originalBounds:{x:left,y:top,w,h}};}
window.exportBuildings=async(requested)=>{
 for(const kind of Object.keys(buildingNames).filter(k=>!requested.length||requested.includes(k)))for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const {model,clips,dish,beacon,sweep,turret}=kind==='headquarters'?await loadRefinedHeadquarters(team):kind==='bastion'?await loadRefinedBastion(team):buildAtlasBuilding(kind,team),prefix=kind+'-'+team;
  applyFieldFinish(model,kind);
  const glb=await new GLTFExporter().parseAsync(model,{binary:true,animations:clips,onlyVisible:true,maxTextureSize:kind==='turret'?512:256});await window.saveBuilding(prefix+'.glb',Array.from(new Uint8Array(glb)));
  const turn=new T.Group();turn.rotation.y=Math.PI/4;turn.add(model);scene.add(turn);if(dish)dish.visible=false;if(beacon)beacon.visible=false;if(sweep)sweep.visible=false;if(turret)turret.visible=false;floor.visible=true;
  const body=snapshot();let solidBounds=bounds(body);await window.saveBuilding(prefix+'.png',body.toDataURL('image/png'));
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
   if(team===0){const origin=project(turret.getWorldPosition(new T.Vector3()));origin[1]=(muzzles[0][0][1]+muzzles[0][1][1])/2;await window.saveTurretRig({pivot:origin.map((v,j)=>(v-pivot[j])/solidBounds.w),muzzles:muzzles.map(pair=>pair.map(p=>p.map((v,j)=>(v-pivot[j])/solidBounds.w)))});}
   turret.visible=false;
  }
  const top=Math.min(solidBounds.y,activity?.originalBounds.y??size,light?.originalBounds.y??size,captureSweep?.originalBounds.y??size,traverse?.originalBounds.y??size);
  const metadata={version:1,kind,team,design:model.userData.atlasDesign,model:prefix+'.glb',body:{image:prefix+'.png',width:size,height:size,pivot,solidBounds,top},activity,beacon:light,...(traverse?{turret:traverse}:{}),...(captureSweep?{sweep:captureSweep}:{}),clips:clips.map(c=>({name:c.name,duration:c.duration})),bakedShadow:true};
  await window.saveBuilding(prefix+'.json',JSON.stringify(metadata,null,2)+'\n');scene.remove(turn);const materials=new Set(),textures=new Set();model.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);if(m.map)textures.add(m.map);}});for(const t of textures)t.dispose();for(const m of materials)m.dispose();
 }
};
