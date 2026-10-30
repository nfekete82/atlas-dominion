import * as T from 'three';

/** Bake six cumulative, real-geometry HQ assembly views. The refined HQ has
 * material-batched meshes spanning several floors; sorting whole meshes would
 * reveal the finished building prematurely. Temporarily split their triangles
 * into height-ordered build groups, without touching the exported GLB. */
export function bakeHeadquartersAssembly(model,excluded,snapshot,stageCount=6){
 model.updateMatrixWorld(true);
 const originals=[];
 model.traverse(node=>{if(node.isMesh&&!excluded.has(node)&&node.visible)originals.push(node);});
 if(originals.length<6)throw Error('HQ construction has too few structural meshes');
 const v=new T.Vector3();let low=Infinity,high=-Infinity;
 for(const mesh of originals){
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const y=v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y;
   low=Math.min(low,y);high=Math.max(high,y);
  }
 }
 const span=high-low;
 if(!Number.isFinite(span)||span<.5)throw Error('HQ construction needs full-height 3D geometry');
 const slices=[];
 try{
  for(const mesh of originals){
   const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index,counts=index?.count??p.count;
   const bands=Array.from({length:stageCount},()=>[]);
   for(let i=0;i<counts;i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const y=ids.reduce((sum,id)=>sum+v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld).y,0)/3;
    const group=Math.max(0,Math.min(stageCount-1,Math.floor((y-low)/span*stageCount)));
    bands[group].push(...ids);
   }
   mesh.visible=false;
   for(let band=0;band<bands.length;band++)if(bands[band].length){
    const sliced=geometry.clone();sliced.setIndex(bands[band]);
    const proxy=new T.Mesh(sliced,mesh.material);
    proxy.name=mesh.name+'_build_stage_'+band;
    proxy.position.copy(mesh.position);proxy.quaternion.copy(mesh.quaternion);proxy.scale.copy(mesh.scale);
    proxy.castShadow=mesh.castShadow;proxy.receiveShadow=mesh.receiveShadow;
    proxy.visible=false;mesh.parent.add(proxy);slices.push({mesh:proxy,band});
   }
  }
  const frames=[];
  for(let stage=0;stage<stageCount;stage++){
   for(const entry of slices)entry.mesh.visible=entry.band<=stage;
   frames.push(snapshot());
  }
  return {frames,parts:slices.length};
 }finally{
  for(const entry of slices){entry.mesh.removeFromParent();entry.mesh.geometry.dispose();}
  for(const mesh of originals)mesh.visible=true;
 }
}
