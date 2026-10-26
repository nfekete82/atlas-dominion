import * as T from 'three';
import {buildAtlasVehicle} from './atlas-vehicles.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const params=new URLSearchParams(location.search);
const cell=Number(params.get('cell'))===192?192:96,columns=16;
const atlasOnly=params.has('atlasOnly');
const pixelFactor=cell/96;
const weapons=['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];
const clips=[['idle','Idle',4,true],['walk','Run_Gun',8,true],['attack','Idle_Shoot',5,false],['hit','HitReact',4,false],['death','Death',10,false]];
const models={infantry:['soldier.gltf','AK'],engineer:['engineer.gltf','SMG'],heavy:['heavy.gltf','GrenadeLauncher'],rover:['rover.gltf'],tank:['tank.fbx'],artillery:['artillery.fbx'],scout:['helicopter.glb'],gunship:['helicopter.glb'],bomber:['bomber.gltf']};
const nativeWidths={rover:66,tank:88,artillery:92,scout:106,gunship:92,bomber:106};
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(cell,cell);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.8,1.8,1.8,-1.8,.01,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);
scene.add(new T.HemisphereLight('#c8dfff','#65482b',1.55));const sun=new T.DirectionalLight('#ffe4be',3.2);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(cell>=192?2048:1024,cell>=192?2048:1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.015;scene.add(sun);scene.add(sun.target);const fill=new T.DirectionalLight('#8ab9df',.65);fill.position.set(5,4,-5);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const loader=new GLTFLoader();
function colorize(model,team){model.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;const mats=Array.isArray(n.material)?n.material:[n.material];n.material=mats.map(m=>{const copy=m.clone();copy.roughness=.85;copy.metalness=.12;if(/Character_Main|Hazmat_Main|Enemy_Red/.test(m.name??''))copy.color.set('#c6ae7d');else if(/Pants|Red$|DarkGrey/.test(m.name??''))copy.color.set(team?'#a93429':'#245e95');return copy;});if(mats.length===1)n.material=n.material[0];});}
function sample(point){return point.clone().project(camera).multiply(new T.Vector3(cell/2,-cell/2,1)).add(new T.Vector3(cell/2,cell/2,0));}
function boxVisible(model){const box=new T.Box3();model.traverse(n=>{if(n.isMesh&&n.visible&&n.parentsVisible!==false){let visible=true;for(let p=n.parent;p;p=p.parent)if(!p.visible)visible=false;if(visible)box.expandByObject(n,true);}});return box;}
window.compileAtlases=async(requested)=>{
 for(const kind of Object.keys(models).filter(k=>!requested.length||requested.includes(k))){
  const character=kind in {infantry:1,engineer:1,heavy:1},[file,weapon]=models[kind];
  for(const team of [0,1]){
   const rig=character?null:buildAtlasVehicle(kind,team);
   const data=rig?{scene:rig.model,animations:[]}:await loader.loadAsync('/tools/animation-sources/'+file),model=data.scene??data;
   if(character)for(const name of weapons){const n=model.getObjectByName(name);if(n)n.visible=name===weapon;}
   const rotor=rig?.rotor??null;
   if(!rig)colorize(model,team,character);const pivot=new T.Group(),normalization=new T.Group();normalization.add(model);pivot.add(normalization);scene.add(pivot);
   const mixer=new T.AnimationMixer(model),actions=new Map((data.animations??[]).map(c=>[c.name,mixer.clipAction(c)]));
   const initial=character?'Idle':null;
   if(initial){actions.get(initial).play();mixer.setTime(0);}
   pivot.updateMatrixWorld(true);const bounds=boxVisible(model),extent=bounds.getSize(new T.Vector3());
   const scale=character?2.1/extent.y:2.8/Math.max(extent.x,extent.z);normalization.scale.setScalar(scale);
   pivot.updateMatrixWorld(true);const grounded=boxVisible(model);normalization.position.y-=grounded.min.y;
   if(file.endsWith('fbx')&&!rig)normalization.rotation.y=Math.PI/2;
   if(['scout','gunship','bomber'].includes(kind))normalization.position.y+=.75;
   pivot.updateMatrixWorld(true);
   const directionCount=character?8:16,config=character?clips:[['idle',null,rotor?4:1,true],['walk',null,kind==='bomber'?1:4,true],...(['tank','artillery'].includes(kind)?[['turnLeft',null,4,true],['turnRight',null,4,true]]:[])];
   const turret=model.getObjectByName('Tank_Turret'),gun=model.getObjectByName('Tank_Gun');
   const total=config.reduce((n,c)=>n+c[2]*directionCount,0)+(turret?32:0),canvas=document.createElement('canvas');canvas.width=columns*cell;canvas.height=Math.ceil(total/columns)*cell;const ctx=canvas.getContext('2d');
   const metadata={version:1,image:kind+'-'+team+'.png',kind,team,cell:[cell,cell],nativeScale:(character?1:(nativeWidths[kind]/72))/pixelFactor,directions:directionCount,stride:character?(kind==='heavy'?58:64):34,source:rig?'Atlas original vehicle geometry':file,design:rig?model.userData.atlasDesign:undefined,palette:'Legion ceramic / bronze / dark steel / faction enamel',lighting:'ACES 1.13 / warm sun / cool fill',renderResolution:cell,renderQuality:cell>=192?'HD native 3D raster / 2x':'standard',timeBasedLocomotion:!!rotor,rotor:!!rotor,clips:{},frames:[]};
   // Project a world-fixed ground point to y=78 without changing scale per pose.
   const size=character?3.6:4.2;camera.left=-size/2;camera.right=size/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();
   camera.position.set(0,8,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();const origin=sample(new T.Vector3());const shift=(78*pixelFactor-origin.y)*size/cell;
   camera.position.y+=shift/Math.cos(Math.atan2(8,12));camera.lookAt(0,shift/Math.cos(Math.atan2(8,12)),0);camera.updateMatrixWorld();
   const baseRotations=new Map();model.traverse(n=>{if(/Wheel_/.test(n.name))baseRotations.set(n,n.quaternion.clone());});
   for(const [tag,clipName,count,loop] of config){
    const action=clipName?actions.get(clipName):null;if(clipName&&!action)throw Error(kind+' missing '+clipName);
    metadata.clips[tag]={frames:[],duration:action?.getClip().duration??(rotor?.32:1),loop,sourceClip:clipName??(rotor?'authored rigid rotor geometry':rig&&kind!=='bomber'&&tag!=='idle'?(kind==='rover'?'authored rigid wheel geometry':'authored rigid track geometry'):'static model'),uniquePhases:[]};
    for(let direction=0;direction<directionCount;direction++){
     const row=[],hashes=new Set();
     for(let phase=0;phase<count;phase++){
      mixer.stopAllAction();if(action){action.reset().setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.play();mixer.setTime(action.getClip().duration*(loop?phase/count:phase/Math.max(1,count-1)));}
      if(rig)rig.animate(tag,phase/count);else if(rotor)rotor.rotation.y=phase*Math.PI/count;
      for(const [wheel,q] of baseRotations){wheel.quaternion.copy(q);if(tag==='walk')wheel.rotateX(phase*Math.PI*2/count);}
      pivot.rotation.y=Math.PI/2-direction*Math.PI*2/directionCount;pivot.updateMatrixWorld(true);
      if(turret)turret.visible=false;if(gun)gun.visible=false;renderer.render(scene,camera);
      const index=metadata.frames.length,x=(index%columns)*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);
      const frame={x,y,w:cell,h:cell,pivot:[48*pixelFactor,78*pixelFactor],duration:(action?.getClip().duration??(rotor?.32:1))/count};
      if(character){const gunNode=model.getObjectByName(weapon);if(gunNode){
       const forward=new T.Vector3(Math.sin(pivot.rotation.y),0,Math.cos(pivot.rotation.y)),vertices=[];let front=-Infinity;
       gunNode.traverse(n=>{if(!n.isMesh)return;const pos=n.geometry.attributes.position;for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(n.matrixWorld);vertices.push(v);front=Math.max(front,v.dot(forward));}});
       const tip=new T.Vector3();let count=0;for(const v of vertices)if(v.dot(forward)>front-.025){tip.add(v);count++;}tip.divideScalar(Math.max(1,count));const p=sample(tip);frame.muzzle=[p.x,p.y];
      }}
      if(!character&&rig?.muzzle){const tip=sample(rig.muzzle.getWorldPosition(new T.Vector3()));frame.muzzle=[tip.x,tip.y];}
      metadata.frames.push(frame);row.push(index);
      const pixels=ctx.getImageData(x,y,cell,cell).data;let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619)>>>0;hashes.add(hash);
     }metadata.clips[tag].frames.push(row);metadata.clips[tag].uniquePhases.push(hashes.size);
    }
   }
   if(turret){
    const all=[];model.traverse(n=>{if(n.isMesh)all.push(n);});
    floor.visible=false;turret.visible=true;if(gun)gun.visible=true;
    const belongs=(n,part)=>{for(let p=n;p;p=p.parent)if(p===part)return true;return false;};
    for(const [tag,part] of [['turret',turret],['barrel',gun]]){
     if(!part)continue;for(const n of all)n.visible=belongs(n,part);
     metadata.clips[tag]={frames:[],duration:1,loop:true,sourceClip:'separate rigid '+tag+' geometry'};
     for(let direction=0;direction<16;direction++){pivot.rotation.y=Math.PI/2-direction*Math.PI/8;pivot.updateMatrixWorld(true);renderer.render(scene,camera);const index=metadata.frames.length,x=index%columns*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);const muzzleNode=tag==='barrel'?part.children.find(n=>n.name.startsWith('MuzzleOpening')):null,muzzle=muzzleNode?sample(muzzleNode.getWorldPosition(new T.Vector3())):null;metadata.frames.push({x,y,w:cell,h:cell,pivot:[48*pixelFactor,78*pixelFactor],duration:1,...(muzzle?{muzzle:[muzzle.x,muzzle.y]}:{})});metadata.clips[tag].frames.push([index]);}
    }
   }
   if(rig&&!atlasOnly){model.traverse(n=>{if(n.isMesh)n.visible=true;});if(turret)turret.visible=true;if(gun)gun.visible=true;rig.animate('idle',0);const glb=await new GLTFExporter().parseAsync(model,{binary:true});metadata.model=kind+'-'+team+'.glb';await window.saveVehicleModel(metadata.model,Array.from(new Uint8Array(glb)));}
   floor.visible=true;scene.remove(pivot);await window.saveAtlas(kind+'-'+team,canvas.toDataURL('image/png'),metadata);
  }
 }
};
