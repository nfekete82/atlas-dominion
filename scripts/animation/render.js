import * as T from 'three';
import {buildAtlasVehicle} from './atlas-vehicles.js';
import {buildHumvee} from './humvee.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const params=new URLSearchParams(location.search);
const cell=Number(params.get('cell'))===192?192:96,columns=16;
const atlasOnly=params.has('atlasOnly')&&params.get('atlasOnly')!=='0';
const pixelFactor=cell/96;
const weapons=['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];
const clips=[['idle','Idle',4,true],['walk','Run_Gun',8,true],['attack','Idle_Shoot',5,false],['hit','HitReact',4,false],['death','Death',10,false]];
const models={infantry:['soldier.gltf','AK'],engineer:['engineer.gltf','SMG'],heavy:['heavy.gltf','GrenadeLauncher'],rover:['rover.gltf'],tank:['tank.fbx'],artillery:['artillery.fbx'],scout:['helicopter.glb'],gunship:['helicopter.glb'],bomber:['bomber.gltf']};
const nativeWidths={rover:76,tank:90,artillery:94,scout:106,gunship:92,bomber:107}; // Keep rendered footprint equal to catalog specs.
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(cell,cell);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.8,1.8,1.8,-1.8,.01,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);
scene.add(new T.HemisphereLight('#c8dfff','#65482b',1.55));const sun=new T.DirectionalLight('#ffe4be',3.2);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(cell>=192?2048:1024,cell>=192?2048:1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.015;scene.add(sun);scene.add(sun.target);const fill=new T.DirectionalLight('#8ab9df',.65);fill.position.set(5,4,-5);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);

/* Subtle deterministic sandblasted metal texture applied only to offline HD
   vehicle rendering. Keep team enamel, optics and emissive markers untouched. */
function makeMicroRelief(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const c=canvas.getContext('2d'),image=c.createImageData(128,128);
 let seed=0x5ad31f29;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,grain=(random()-.5)*78,band=Math.sin((x+y)*.19)*8;
  const v=Math.max(15,Math.min(240,154+grain+band));
  image.data[i]=image.data[i+1]=image.data[i+2]=v;
  image.data[i+3]=255;
 }
 c.putImageData(image,0,0);
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(2,2);
 texture.colorSpace=T.NoColorSpace;
 texture.anisotropy=4;
 return texture;
}
const microRelief=cell>=192?makeMicroRelief():null;
function makeRoughnessGrain(){
 const tile=document.createElement('canvas');tile.width=tile.height=128;
 const c=tile.getContext('2d'),pixels=c.createImageData(128,128);
 let state=0x251a9c17;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;
  const scratch=Math.sin(x*.87+y*.045)*7;
  const v=Math.max(182,Math.min(250,225+(random()-.5)*33+scratch));
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;
  pixels.data[i+3]=255;
 }
 c.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(tile);
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(2,2);texture.colorSpace=T.NoColorSpace;
 return texture;
}
const weatherRoughness=cell>=192?makeRoughnessGrain():null;
function weatherVehicleMaterials(model){
 if(!microRelief)return;
 const seen=new Set();
 model.traverse(node=>{
  if(!node.isMesh||!node.geometry?.attributes?.uv)return;
  for(const m of Array.isArray(node.material)?node.material:[node.material]){
   if(!m?.isMeshStandardMaterial||seen.has(m))continue;
   seen.add(m);
   const name=(m.name??'').toLowerCase();
   // Glass, exhaust glow, rotors' rubber and team LEDs should stay clean.
   if(/glass|emission|light|black seals|rubber|lens|optic/.test(name))continue;
   // Preserve physically based textures baked into the authored Leopard GLB.
   // Generic procedural noise is only a fallback for older vehicle materials.
   if(m.normalMap && m.roughnessMap && (m.metalnessMap || m.map))continue;
   if(!m.bumpMap && !m.normalMap){m.bumpMap=microRelief;m.bumpScale=/ceramic|sand|armour/.test(name)?.021:.012;}
   if(!m.roughnessMap&&weatherRoughness)m.roughnessMap=weatherRoughness;
   m.roughness=Math.max(/enamel|faction/.test(name)?.58:.72,Math.min(.9,m.roughness??.75));
   m.metalness=Math.min(.65,m.metalness??.3);
   m.needsUpdate=true;
  }
 });
}
const loader=new GLTFLoader();
function colorize(model,team){model.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;const mats=Array.isArray(n.material)?n.material:[n.material];n.material=mats.map(m=>{const copy=m.clone();copy.roughness=.85;copy.metalness=.12;if(/Character_Main|Hazmat_Main|Enemy_Red/.test(m.name??''))copy.color.set('#c6ae7d');else if(/Pants|Red$|DarkGrey/.test(m.name??''))copy.color.set(team?'#a93429':'#245e95');return copy;});if(mats.length===1)n.material=n.material[0];});}
function sample(point){return point.clone().project(camera).multiply(new T.Vector3(cell/2,-cell/2,1)).add(new T.Vector3(cell/2,cell/2,0));}
function boxVisible(model){const box=new T.Box3();model.traverse(n=>{if(n.isMesh&&n.visible&&n.parentsVisible!==false){let visible=true;for(let p=n.parent;p;p=p.parent)if(!p.visible)visible=false;if(visible)box.expandByObject(n,true);}});return box;}
/** High-detail faction tank loaded from the authored GLBs.
 * The gameplay still consumes the generated PNG/JSON atlases, not GLB at runtime.
 * Explicit track motion keeps the four directional walk/turn phases non-identical.
 */
async function loadFactionLeopard(team){
 const {scene:model}=await loader.loadAsync('/src/assets/reborn/animation/tank-'+team+'.glb');
 const tracks=[];
 model.traverse(node=>{
  if(!node.isMesh||!node.name.startsWith('TrackTread'))return;
  node.geometry.computeBoundingBox();
  const center=node.geometry.boundingBox.getCenter(new T.Vector3());
  tracks.push({node,center,initial:node.position.clone()});
 });
 const gun=model.getObjectByName('Tank_Gun');
 if(!gun||!model.getObjectByName('Tank_Turret'))throw Error('Leopard model must expose Tank_Turret and Tank_Gun');
 const muzzle=new T.Object3D();muzzle.name='AtlasMuzzleTip';
 muzzle.position.set(0,1.76,4.48);gun.add(muzzle);
 model.userData.atlasDesign={kind:'tank',team,parts:tracks.length,
   geometry:'Original Leopard-inspired woodland camo geometry with faction roof flag',
   source:'Atlas Dominion / procedural authored GLB'};
 function animate(tag,phase){
  const moving=tag!=='idle';
  for(const {node,center,initial} of tracks){
   node.position.copy(initial);
   if(!moving)continue;
   // Upper and lower treads travel in opposite directions, curving around drive wheels.
   const distance=phase*.23;
   if(center.y>.65)node.position.z-=distance;
   else if(center.y<.34)node.position.z+=distance;
   else node.position.y+=Math.sin(phase*Math.PI*2+(center.z>0?0:Math.PI))*.045;
  }
 }
 return {model,rotor:null,muzzle,animate};
}
/** Load the original high-detail bomber, preserving its embedded PBR textures.
 * The atlas builder must never re-export or replace these authored GLBs. */
async function loadFactionBomber(team){
 const {scene:model,animations}=await loader.loadAsync('/src/assets/reborn/animation/bomber-'+team+'.glb');
 const propellerNames=['Propeller_Port_Spin','Propeller_Starboard_Spin'];
 for(const name of propellerNames)if(!model.getObjectByName(name))throw Error('Bomber GLB missing '+name);
 const clip=animations.find(a=>a.name==='Propellers_Continuous');
 if(!clip||clip.tracks.length<2)throw Error('Bomber GLB missing two animated propellers');
 let parts=0,triangles=0;
 model.traverse(node=>{if(node.isMesh){parts++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
 model.userData.atlasDesign={kind:'bomber',team,parts,triangles:Math.round(triangles),
   geometry:'PBR desert twin-engine bomber with twin fins and animated propellers',
   source:'Sandforge authored original bomber GLB'};
 return {model,animations,rotor:model.getObjectByName(propellerNames[0]),animate(){}};
}
window.compileAtlases=async(requested)=>{
 for(const kind of Object.keys(models).filter(k=>!requested.length||requested.includes(k))){
  const character=kind in {infantry:1,engineer:1,heavy:1},[file,weapon]=models[kind];
  for(const team of [0,1]){
   const rig=character?null:kind==='tank'?await loadFactionLeopard(team):kind==='bomber'?await loadFactionBomber(team):kind==='rover'?buildHumvee(team):buildAtlasVehicle(kind,team);
   const data=rig?{scene:rig.model,animations:rig.animations??[]}:await loader.loadAsync('/tools/animation-sources/'+file),model=data.scene??data;
   if(character)for(const name of weapons){const n=model.getObjectByName(name);if(n)n.visible=name===weapon;}
   const rotor=rig?.rotor??null;
   if(rig&&cell>=192&&kind!=='bomber')weatherVehicleMaterials(model); // Preserve the bomber's authored PBR maps.
   if(!rig)colorize(model,team,character);const pivot=new T.Group(),normalization=new T.Group();normalization.add(model);pivot.add(normalization);scene.add(pivot);
   const mixer=new T.AnimationMixer(model),actions=new Map((data.animations??[]).map(c=>[c.name,mixer.clipAction(c)]));
   const initial=character?'Idle':null;
   if(initial){actions.get(initial).play();mixer.setTime(0);}
   pivot.updateMatrixWorld(true);const bounds=boxVisible(model),extent=bounds.getSize(new T.Vector3());
   const scale=character?2.1/extent.y:kind==='tank'?.67:2.8/Math.max(extent.x,extent.z);normalization.scale.setScalar(scale);
   pivot.updateMatrixWorld(true);const grounded=boxVisible(model);normalization.position.y-=grounded.min.y;
   if(file.endsWith('fbx')&&!rig)normalization.rotation.y=Math.PI/2;
   if(kind==='bomber')normalization.rotation.y=Math.PI; // Authored nose -Z -> gameplay nose +Z.
   if(['scout','gunship','bomber'].includes(kind))normalization.position.y+=.75;
   pivot.updateMatrixWorld(true);
   const directionCount=character?8:16,config=character?clips:kind==='bomber'?[['idle','Propellers_Continuous',8,true],['walk','Propellers_Continuous',8,true]]:[['idle',null,rotor?4:1,true],['walk',null,kind==='rover'?11:4,true],...(['tank','artillery'].includes(kind)?[['turnLeft',null,4,true],['turnRight',null,4,true]]:[])];
   const turret=model.getObjectByName('Tank_Turret'),gun=model.getObjectByName('Tank_Gun');
   const total=config.reduce((n,c)=>n+c[2]*directionCount,0)+(turret?32:0),canvas=document.createElement('canvas');canvas.width=columns*cell;canvas.height=Math.ceil(total/columns)*cell;const ctx=canvas.getContext('2d');
   const metadata={version:1,image:kind+'-'+team+'.png',kind,team,cell:[cell,cell],nativeScale:(character?1:(nativeWidths[kind]/72))/pixelFactor,directions:directionCount,stride:character?(kind==='heavy'?58:64):kind==='rover'?52:34,source:rig?'Atlas original vehicle geometry':file,design:rig?model.userData.atlasDesign:undefined,palette:'Legion ceramic / bronze / dark steel / faction enamel',lighting:'ACES 1.13 / warm sun / cool fill',renderResolution:cell,renderQuality:cell>=192?'HD native 3D raster / 2x':'standard',timeBasedLocomotion:!!rotor,rotor:!!rotor,clips:{},frames:[]};
   if(rig)metadata.model=kind+'-'+team+'.glb';
   // Project a world-fixed ground point to y=78 without changing scale per pose.
   const size=character?3.6:kind==='tank'?4.7:4.2;camera.left=-size/2;camera.right=size/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();
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
     for(let direction=0;direction<16;direction++){pivot.rotation.y=Math.PI/2-direction*Math.PI/8;pivot.updateMatrixWorld(true);renderer.render(scene,camera);const index=metadata.frames.length,x=index%columns*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);const muzzleNode=tag==='barrel'?rig?.muzzle??part.children.find(n=>n.name.startsWith('MuzzleOpening')):null,muzzle=muzzleNode?sample(muzzleNode.getWorldPosition(new T.Vector3())):null;metadata.frames.push({x,y,w:cell,h:cell,pivot:[48*pixelFactor,78*pixelFactor],duration:1,...(muzzle?{muzzle:[muzzle.x,muzzle.y]}:{})});metadata.clips[tag].frames.push([index]);}
    }
   }
   if(rig&&!atlasOnly&&kind!=='bomber'){model.traverse(n=>{if(n.isMesh)n.visible=true;});if(turret)turret.visible=true;if(gun)gun.visible=true;rig.animate('idle',0);
    // Embed actual quaternion animation for four wheel pivots in the 3D GLB.
    const wheelTracks=kind==='rover'?(rig.wheels??[]).map(wheel=>{
     const times=Array.from({length:25},(_,i)=>i/24),values=[];
     for(const time of times){
      const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),time*Math.PI*2);
      values.push(q.x,q.y,q.z,q.w);
     }
     return new T.QuaternionKeyframeTrack(wheel.name+'.quaternion',times,values);
    }):[];
    const animations=wheelTracks.length?[new T.AnimationClip('Humvee_Wheels',1,wheelTracks)]:[];
    const glb=await new GLTFExporter().parseAsync(model,{binary:true,animations});metadata.model=kind+'-'+team+'.glb';const bytes=new Uint8Array(glb);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));await window.saveVehicleModel(metadata.model,btoa(binary));}
   floor.visible=true;scene.remove(pivot);await window.saveAtlas(kind+'-'+team,canvas.toDataURL('image/png'),metadata);
  }
 }
};
