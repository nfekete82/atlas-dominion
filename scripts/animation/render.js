import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractRotor} from './rotor.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
const cell=96,columns=16;
const weapons=['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];
const clips=[['idle','Idle',4,true],['walk','Run_Gun',8,true],['attack','Idle_Shoot',5,false],['hit','HitReact',4,false],['death','Death',10,false]];
const models={infantry:['soldier.gltf','AK'],engineer:['engineer.gltf','SMG'],heavy:['heavy.gltf','GrenadeLauncher'],rover:['rover.gltf'],tank:['tank.fbx'],artillery:['artillery.fbx'],scout:['helicopter.glb'],gunship:['helicopter.glb'],bomber:['bomber.gltf']};
const nativeWidths={rover:66,tank:88,artillery:92,scout:80,gunship:92,bomber:106};
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(cell,cell);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.8,1.8,1.8,-1.8,.01,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);
scene.add(new T.HemisphereLight('#e4e8ee','#675039',2.1));const sun=new T.DirectionalLight('#ffe2b4',3);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.015;scene.add(sun);scene.add(sun.target);
const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const loader=new GLTFLoader();
function colorize(model,team,character){model.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;const mats=Array.isArray(n.material)?n.material:[n.material];n.material=mats.map(m=>{const copy=m.clone();const name=m.name??'';copy.roughness=.85;copy.metalness=.12;copy.opacity=1;copy.transparent=false;copy.side=T.DoubleSide;
 if(character){if(/Character_Main|Hazmat_Main|Enemy_Red/.test(name))copy.color.set('#c6ae7d');else if(/Pants|Red$|DarkGrey/.test(name))copy.color.set(team?'#a93429':'#245e95');}
 else if(!copy.map){if(copy.color&&copy.color.r+copy.color.g+copy.color.b>.5)copy.color.set('#bca67e');}
 if(!character){
  const teamPanel=/Tank_Turret|Cube_1|body|Body/.test(n.name);
  const tint=teamPanel?(team?'vec3(1.,.35,.23)':'vec3(.3,.62,1.)'):(team?'vec3(1.24,.87,.64)':'vec3(1.08,.98,.85)');
  copy.customProgramCacheKey=()=>tint;
  copy.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat atlasLum=dot(diffuseColor.rgb,vec3(.299,.587,.114)); diffuseColor.rgb=pow(max(atlasLum,.025),.72)*'+tint+';');};
 }
 if(!character&&/Cube_1/.test(n.name))copy.color.set('#b9a480');
 return copy;});if(!Array.isArray(n.geometry?.groups)||n.geometry.groups.length===0)n.material=n.material[0];else if(mats.length===1)n.material=n.material[0];});}
function sample(point){return point.clone().project(camera).multiply(new T.Vector3(cell/2,-cell/2,1)).add(new T.Vector3(cell/2,cell/2,0));}
function boxVisible(model){const box=new T.Box3();model.traverse(n=>{if(n.isMesh&&n.visible&&n.parentsVisible!==false){let visible=true;for(let p=n.parent;p;p=p.parent)if(!p.visible)visible=false;if(visible)box.expandByObject(n,true);}});return box;}
window.compileAtlases=async(requested)=>{
 for(const kind of Object.keys(models).filter(k=>!requested.length||requested.includes(k))){
  const character=kind in {infantry:1,engineer:1,heavy:1},[file,weapon]=models[kind];
  for(const team of [0,1]){
   const data=file.endsWith('.fbx')?await new FBXLoader().loadAsync('/tools/animation-sources/'+file):await loader.loadAsync('/tools/animation-sources/'+file),model=data.scene??data;
   if(character)for(const name of weapons){const n=model.getObjectByName(name);if(n)n.visible=name===weapon;}
   const rotor=file==='helicopter.glb'?extractRotor(model):null;
   colorize(model,team,character);const pivot=new T.Group(),normalization=new T.Group();normalization.add(model);pivot.add(normalization);scene.add(pivot);
   const mixer=new T.AnimationMixer(model),actions=new Map((data.animations??[]).map(c=>[c.name,mixer.clipAction(c)]));
   const initial=character?'Idle':file.endsWith('fbx')?'TankArmature|Tank_Forward':null;
   if(initial){actions.get(initial).play();mixer.setTime(0);}
   pivot.updateMatrixWorld(true);const bounds=boxVisible(model),extent=bounds.getSize(new T.Vector3());
   const scale=character?2.1/extent.y:2.8/Math.max(extent.x,extent.z);normalization.scale.setScalar(scale);
   pivot.updateMatrixWorld(true);const grounded=boxVisible(model);normalization.position.y-=grounded.min.y;
   if(file.endsWith('fbx'))normalization.rotation.y=Math.PI/2;
   if(['scout','gunship','bomber'].includes(kind))normalization.position.y+=.75;
   pivot.updateMatrixWorld(true);
   const directionCount=character?8:16,config=character?clips:[['idle',null,rotor?4:1,true],['walk',file.endsWith('fbx')?'TankArmature|Tank_Forward':null,kind==='bomber'?1:4,true],...(file.endsWith('fbx')?[['turnLeft','TankArmature|Tank_TurningLeft',4,true],['turnRight','TankArmature|Tank_TurningRight',4,true]]:[])];
   const turret=model.getObjectByName('Tank_Turret'),gun=model.getObjectByName('Tank_Gun');
   const total=config.reduce((n,c)=>n+c[2]*directionCount,0)+(turret?32:0),canvas=document.createElement('canvas');canvas.width=columns*cell;canvas.height=Math.ceil(total/columns)*cell;const ctx=canvas.getContext('2d');
   const metadata={version:1,image:kind+'-'+team+'.png',kind,team,cell:[cell,cell],nativeScale:character?1:(nativeWidths[kind]/72),directions:directionCount,stride:character?(kind==='heavy'?58:64):34,source:file,timeBasedLocomotion:!!rotor,rotor:!!rotor,clips:{},frames:[]};
   // Project a world-fixed ground point to y=78 without changing scale per pose.
   const size=character?3.6:4.2;camera.left=-size/2;camera.right=size/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();
   camera.position.set(0,8,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();const origin=sample(new T.Vector3());const shift=(78-origin.y)*size/cell;
   camera.position.y+=shift/Math.cos(Math.atan2(8,12));camera.lookAt(0,shift/Math.cos(Math.atan2(8,12)),0);camera.updateMatrixWorld();
   const baseRotations=new Map();model.traverse(n=>{if(/Wheel_/.test(n.name))baseRotations.set(n,n.quaternion.clone());});
   for(const [tag,clipName,count,loop] of config){
    const action=clipName?actions.get(clipName):null;if(clipName&&!action)throw Error(kind+' missing '+clipName);
    metadata.clips[tag]={frames:[],duration:action?.getClip().duration??(rotor?.32:1),loop,sourceClip:clipName??(rotor?'authored rigid rotor geometry':kind==='rover'&&tag==='walk'?'authored rigid wheel geometry':'static model'),uniquePhases:[]};
    for(let direction=0;direction<directionCount;direction++){
     const row=[],hashes=new Set();
     for(let phase=0;phase<count;phase++){
      mixer.stopAllAction();if(action){action.reset().setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.play();mixer.setTime(action.getClip().duration*(loop?phase/count:phase/Math.max(1,count-1)));}
      if(rotor)rotor.rotation.y=phase*Math.PI/count;
      for(const [wheel,q] of baseRotations){wheel.quaternion.copy(q);if(tag==='walk')wheel.rotateX(phase*Math.PI*2/count);}
      pivot.rotation.y=Math.PI/2-direction*Math.PI*2/directionCount;pivot.updateMatrixWorld(true);
      if(turret)turret.visible=false;if(gun)gun.visible=false;renderer.render(scene,camera);
      const index=metadata.frames.length,x=(index%columns)*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);
      const frame={x,y,w:cell,h:cell,pivot:[48,78],duration:(action?.getClip().duration??(rotor?.32:1))/count};
      if(character){const gunNode=model.getObjectByName(weapon);if(gunNode){
       const forward=new T.Vector3(Math.sin(pivot.rotation.y),0,Math.cos(pivot.rotation.y)),vertices=[];let front=-Infinity;
       gunNode.traverse(n=>{if(!n.isMesh)return;const pos=n.geometry.attributes.position;for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(n.matrixWorld);vertices.push(v);front=Math.max(front,v.dot(forward));}});
       const tip=new T.Vector3();let count=0;for(const v of vertices)if(v.dot(forward)>front-.025){tip.add(v);count++;}tip.divideScalar(Math.max(1,count));const p=sample(tip);frame.muzzle=[p.x,p.y];
      }}
      metadata.frames.push(frame);row.push(index);
      const pixels=ctx.getImageData(x,y,cell,cell).data;let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619)>>>0;hashes.add(hash);
     }metadata.clips[tag].frames.push(row);metadata.clips[tag].uniquePhases.push(hashes.size);
    }
   }
   if(turret){
    const all=[];model.traverse(n=>{if(n.isMesh)all.push(n);});
    floor.visible=false;
    for(const [tag,part] of [['turret',turret],['barrel',gun]]){
     if(!part)continue;for(const n of all)n.visible=n===part;
     metadata.clips[tag]={frames:[],duration:1,loop:true,sourceClip:'separate rigid '+tag+' geometry'};
     for(let direction=0;direction<16;direction++){pivot.rotation.y=Math.PI/2-direction*Math.PI/8;pivot.updateMatrixWorld(true);renderer.render(scene,camera);const index=metadata.frames.length,x=index%columns*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);metadata.frames.push({x,y,w:cell,h:cell,pivot:[48,78],duration:1});metadata.clips[tag].frames.push([index]);}
    }
   }
   floor.visible=true;scene.remove(pivot);await window.saveAtlas(kind+'-'+team,canvas.toDataURL('image/png'),metadata);
  }
 }
};
