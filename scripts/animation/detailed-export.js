import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildDetailedInfantry} from './detailed-infantry.js';
import {bakeDetailedClips} from './detailed-clips.js';
const cell=192,columns=16,clips=[['idle','Idle',6,true],['walk','Run_Gun',8,true],['attack','Idle_Shoot',6,false],['hit','HitReact',5,false],['death','Death',12,false]];
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(cell,cell);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.8,1.8,1.8,-1.8,.01,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);
scene.add(new T.HemisphereLight('#c8dfff','#65482b',1.55));const sun=new T.DirectionalLight('#ffe4be',3.2);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.normalBias=.007;scene.add(sun);scene.add(sun.target);
const fill=new T.DirectionalLight('#8ab9df',.65);fill.position.set(5,4,-5);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
const sample=point=>point.clone().project(camera).multiply(new T.Vector3(cell/2,-cell/2,1)).add(new T.Vector3(cell/2,cell/2,0));
const visibleBox=model=>{const box=new T.Box3();model.traverse(n=>{if(!n.isMesh)return;for(let p=n;p;p=p.parent)if(!p.visible)return;box.expandByObject(n,true);});return box;};
window.exportDetailed=async()=>{
 for(const team of [0,1]){
  const data=await new GLTFLoader().loadAsync('/tools/animation-sources/soldier.gltf'),model=data.scene,mixer=new T.AnimationMixer(model);
  mixer.clipAction(data.animations.find(a=>a.name==='Idle')).play();mixer.setTime(0);model.updateMatrixWorld(true);
  const design=buildDetailedInfantry(model,team);
  mixer.stopAllAction();model.updateMatrixWorld(true);
  const authored=bakeDetailedClips(model,mixer,clips.map(([,name])=>data.animations.find(a=>a.name===name))),selected=authored.clips;design.maxGripError=authored.maxGripError;design.parts=model.userData.atlasDesign.parts;console.log('Supporting hand error',authored.maxGripError);
  const glb=await new GLTFExporter().parseAsync(model,{binary:true,animations:selected,onlyVisible:true,maxTextureSize:512});
  await window.saveDetailed('infantry-'+team+'.glb',Array.from(new Uint8Array(glb)),null);
  const pivot=new T.Group();pivot.add(model);scene.add(pivot);pivot.updateMatrixWorld(true);const b=visibleBox(model),height=b.getSize(new T.Vector3()).y,scale=2.1/height;model.scale.setScalar(scale);pivot.updateMatrixWorld(true);model.position.y-=visibleBox(model).min.y;pivot.updateMatrixWorld(true);
  camera.position.set(0,8,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();const shift=(156-sample(new T.Vector3()).y)*3.6/cell;camera.position.y+=shift/Math.cos(Math.atan2(8,12));camera.lookAt(0,shift/Math.cos(Math.atan2(8,12)),0);camera.updateMatrixWorld();
  const count=clips.reduce((n,c)=>n+c[2]*8,0),canvas=document.createElement('canvas');canvas.width=columns*cell;canvas.height=Math.ceil(count/columns)*cell;const ctx=canvas.getContext('2d');
  const meta={version:1,image:'infantry-'+team+'.png',kind:'infantry',team,cell:[cell,cell],nativeScale:.5,directions:8,stride:64,source:'Atlas original hard-surface armour on Quaternius CC0 rig',design,clips:{},frames:[]};
  for(const [tag,name,phases,loop] of clips){const clip=selected.find(a=>a.name===name),action=mixer.clipAction(clip);meta.clips[tag]={frames:[],duration:clip.duration,loop,sourceClip:name+' / Atlas supporting-arm IK',uniquePhases:[]};
   for(let direction=0;direction<8;direction++){const row=[],hashes=new Set();for(let phase=0;phase<phases;phase++){
    mixer.stopAllAction();action.reset().setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*(loop?phase/phases:phase/(phases-1)));
    pivot.rotation.y=Math.PI/2-direction*Math.PI/4;pivot.updateMatrixWorld(true);renderer.render(scene,camera);
    const index=meta.frames.length,x=index%columns*cell,y=Math.floor(index/columns)*cell;ctx.drawImage(renderer.domElement,x,y);row.push(index);meta.frames.push({x,y,w:cell,h:cell,pivot:[96,156],duration:clip.duration/phases});
    const pixels=ctx.getImageData(x,y,cell,cell).data;let hash=2166136261;for(const v of pixels)hash=Math.imul(hash^v,16777619)>>>0;hashes.add(hash);
   }meta.clips[tag].frames.push(row);meta.clips[tag].uniquePhases.push(hashes.size);}
  }
  await window.saveDetailed('infantry-'+team+'.png',canvas.toDataURL('image/png'),meta);
  scene.remove(pivot);
 }
};
