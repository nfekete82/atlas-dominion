import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Split disconnected added details without changing any positions or surfaces. */
function components(geometry){
 const p=geometry.attributes.position,parent=Array.from({length:p.count},(_,i)=>i),keys=new Map();
 const find=i=>parent[i]===i?i:parent[i]=find(parent[i]),join=(a,b)=>{parent[find(a)]=find(b);};
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(keys.has(key))join(i,keys.get(key));else keys.set(key,i);}
 const indices=geometry.index?Array.from(geometry.index.array):Array.from({length:p.count},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const groups=new Map();for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...indices.slice(i,i+3));}return [...groups.values()];
}
function subGeometry(source,indices){
 const used=[...new Set(indices)],lookup=new Map(used.map((v,i)=>[v,i])),geometry=new T.BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes)){
  const data=new Float32Array(used.length*attribute.itemSize);
  used.forEach((id,i)=>{for(let j=0;j<attribute.itemSize;j++)data[i*attribute.itemSize+j]=attribute.getComponent(id,j);});
  geometry.setAttribute(name,new T.BufferAttribute(data,attribute.itemSize));
 }
 geometry.setIndex(indices.map(i=>lookup.get(i)));return geometry;
}

/** Trimesh retained the original named rig, but merged new details by material
 * outside it. Reattach only the added components belonging to the moving dish
 * or glowing lens, keeping their original world-space rest pose exactly. */
function attachDetails(model,dish,beacon){
 model.updateMatrixWorld(true);const originals=[],extras=[];
 model.traverse(n=>{if(n.isMesh)(n.name.startsWith('AtlasRefined_')?extras:originals).push(n);});
 const belongs=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
 const surfaces={static:[],radar:[],beacon:[]};
 for(const mesh of originals){
  const g=mesh.geometry,p=g.attributes.position,index=g.index,key=belongs(mesh,dish)?'radar':belongs(mesh,beacon)?'beacon':'static';
  for(let i=0;i<(index?.count??p.count);i+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),triangle=new T.Triangle(...points);if(triangle.getArea()>1e-12)surfaces[key].push(triangle);}
 }
 const near=new T.Box3().setFromObject(dish).expandByScalar(.12),nearLight=new T.Box3().setFromObject(beacon).expandByScalar(.05),closest=new T.Vector3();
 const attached={radar:0,beacon:0};
 for(const mesh of extras){
  const bins={static:[],radar:[],beacon:[]},p=mesh.geometry.attributes.position;
  for(const group of components(mesh.geometry)){
   const ids=[...new Set(group)],points=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)),box=new T.Box3().setFromPoints(points);let key='static';
   if(box.intersectsBox(near)||box.intersectsBox(nearLight)){
    const samples=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/12))===0).slice(0,16),scores={static:0,radar:0,beacon:0};
    for(const kind of Object.keys(scores))for(const point of samples){let best=Infinity;for(const triangle of surfaces[kind]){triangle.closestPointToPoint(point,closest);best=Math.min(best,closest.distanceToSquared(point));}scores[kind]+=Math.sqrt(best);}
    const best=Object.keys(scores).sort((a,b)=>scores[a]-scores[b])[0];
    if(best==='radar'||best==='beacon'&&mesh.material.name==='Atlas faction emission')key=best;
   }
   bins[key].push(...group);if(key!=='static')attached[key]++;
  }
  for(const key of ['radar','beacon'])if(bins[key].length){
   const parent=key==='radar'?dish:beacon,geometry=subGeometry(mesh.geometry,bins[key]);
   geometry.applyMatrix4(new T.Matrix4().copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld));
   const detail=new T.Mesh(geometry,mesh.material);detail.name=mesh.name+'_'+key;parent.add(detail);
  }
  if(bins.static.length)mesh.geometry=subGeometry(mesh.geometry,bins.static);else mesh.removeFromParent();
 }
 return attached;
}

export async function loadRefinedHeadquarters(team){
 const source=await new GLTFLoader().loadAsync('/tools/building-sources/headquarters-refined.glb'),model=new T.Group();model.name='Atlas_refined_headquarters';model.add(source.scene);
 const dish=model.getObjectByName('RadarDish'),beacon=model.getObjectByName('Beacon');
 if(!dish||!beacon)throw Error('Refined headquarters is missing the retained radar/beacon groups');
 const attached=attachDetails(model,dish,beacon),materials=new Set();let parts=0,triangles=0;
 model.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;parts++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 // Preserve the user's ceramic, bronze, trim and weathering. Only faction
 // enamel, emission and the existing blue glass receive a red-team variant.
 if(team===1)for(const m of materials){
  if(m.name==='Atlas faction enamel')m.color.set('#a93429');
  if(m.name==='Atlas faction emission'){m.color.set('#ff5142');m.emissive.set('#ff5142');}
  if(m.name==='Atlas armoured glass')m.color.set('#542e28');
 }
 const times=[],rotations=[],rest=dish.quaternion.clone(),axis=new T.Vector3(0,1,0);
 for(let i=0;i<=64;i++){times.push(i/64*48);rotations.push(...rest.clone().multiply(new T.Quaternion().setFromAxisAngle(axis,i/64*Math.PI*2)).toArray());}
 const scale=beacon.scale.toArray(),pulse=[1,1.12,.45,.45,1].flatMap(s=>scale.map(v=>v*s));
 const clips=[new T.AnimationClip('RadarSpin',48,[new T.QuaternionKeyframeTrack('RadarDish.quaternion',times,rotations)]),new T.AnimationClip('BeaconPulse',3.8,[new T.VectorKeyframeTrack('Beacon.scale',[0,.16,.35,.70,3.8],pulse)])];
 model.userData.atlasDesign={name:'Feldkommando',kind:'headquarters',team,parts,triangles:Math.round(triangles),geometry:'User-refined headquarters with preserved surfaces and reattached rigid details',source:'tools/building-sources/headquarters-refined.glb',attachedDetails:attached};
 return {model,clips,dish,beacon};
}
