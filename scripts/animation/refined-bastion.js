import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Keep the edited geometry, materials and authored animation hierarchy intact. */
export async function loadRefinedBastion(team){
 const source=await new GLTFLoader().loadAsync('/tools/building-sources/bastion-refined.glb'),model=new T.Group();model.name='Atlas_refined_bastion';model.add(source.scene);
 const dish=model.getObjectByName('RadarDish'),beacon=model.getObjectByName('Beacon'),sweep=model.getObjectByName('CaptureSweep_Rotator');
 if(!dish||!beacon||!sweep)throw Error('Refined bastion is missing its radar, beacon or sweep group');
 const materials=new Set();let parts=0,triangles=0;
 model.traverse(n=>{
  delete n.userData.atlasDesign;
  if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;parts++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;
  for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);
 });
 if(team!==0)for(const m of materials)if(m.name==='Atlas faction emission'){
  const light=team===-1?'#ffffff':'#ff5142';m.color.set(light);m.emissive.set(light);
 }
 model.userData.atlasDesign={name:'Bastion',kind:'bastion',team,parts,triangles:Math.round(triangles),geometry:'User-refined bastion with preserved surfaces and authored animation groups',source:'tools/building-sources/bastion-refined.glb'};
 return {model,clips:source.animations,dish,beacon,sweep};
}
