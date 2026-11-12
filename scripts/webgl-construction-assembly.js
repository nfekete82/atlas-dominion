import * as THREE from 'three';

/** Progressive build of an AUTHORED glTF with large merged meshes. Source
 * glTF geometry is shared by active/closed models and many players, so never
 * sort/change source indices in place. Construction borrows temporary geometry
 * for a single actor and restores it immediately on completion.
 *
 * Each triangle is revealed when its highest vertex reaches the construction
 * work height. Sorting by actual vertex height allows a single "static__olive"
 * mesh spanning the entire barracks facade to build from bottom to top, rather
 * than suddenly pop into existence at 75% like the ordinary mesh-name stages.
 */
export const AUTHORED_ASSEMBLY_KINDS=Object.freeze(['headquarters','barracks']);

export function prepareAuthoredAssembly(root){
 if(!root)return null;
 root.updateWorldMatrix(true,true);
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
 const meshes=[];let globalMin=Infinity,globalMax=-Infinity;
 const tmp=new THREE.Vector3(),relative=new THREE.Matrix4();
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const source=mesh.geometry,position=source.getAttribute('position');
  const count=source.index?.count??position.count;
  if(count<3||count%3)return;
  // The uploaded GLBs export one PBR material per mesh. Unexpected grouped
  // multi-material meshes keep the existing name-based construction fallback.
  if(Array.isArray(mesh.material)||source.groups.length>1)return;
  relative.multiplyMatrices(inverse,mesh.matrixWorld);
  const heights=new Float32Array(position.count);
  for(let i=0;i<position.count;i++){
   tmp.fromBufferAttribute(position,i).applyMatrix4(relative);
   heights[i]=tmp.y;
   globalMin=Math.min(globalMin,tmp.y);globalMax=Math.max(globalMax,tmp.y);
  }
  const indices=source.index?.array;
  const triangles=[];
  for(let i=0;i<count;i+=3){
   const a=indices?indices[i]:i,b=indices?indices[i+1]:i+1,
    c=indices?indices[i+2]:i+2;
   triangles.push({a,b,c,height:Math.max(heights[a],heights[b],heights[c])});
  }
  triangles.sort((a,b)=>a.height-b.height);
  const geometry=source.clone();
  const ordered=[];
  const bounds=new Float32Array(triangles.length);
  for(let i=0;i<triangles.length;i++){
   const t=triangles[i];ordered.push(t.a,t.b,t.c);bounds[i]=t.height;
  }
  geometry.setIndex(ordered);
  geometry.clearGroups();geometry.setDrawRange(0,0);
  mesh.geometry=geometry;
  meshes.push({mesh,source,geometry,bounds});
  relative.identity();
 });
 if(!meshes.length)return null;
 return {root,meshes,minY:globalMin,maxY:globalMax};
}
export function updateAuthoredAssembly(assembly,progress){
 if(!assembly)return;
 const p=THREE.MathUtils.clamp(progress,0,1);
 // 0–15%: digging and foundation, 15–76%: the building rises,
 // 76–95%: rooftop, control room, doors and radar are assembled.
 const fraction=p<=.15?0:THREE.MathUtils.clamp((p-.15)/.80,0,1);
 const height=assembly.minY+(assembly.maxY-assembly.minY)*fraction;
 for(const {geometry,bounds} of assembly.meshes){
  // At 0–15% the construction crew is still excavating/founding the site:
  // even triangles exactly on the source's minimum Y must remain invisible.
  if(fraction<=0){geometry.setDrawRange(0,0);continue;}
  let left=0,right=bounds.length;
  while(left<right){
   const mid=(left+right)>>1;
   if(bounds[mid]<=height+1e-5)left=mid+1;
   else right=mid;
  }
  geometry.setDrawRange(0,left*3);
 }
}
export function releaseAuthoredAssembly(assembly){
 if(!assembly)return;
 for(const {mesh,source,geometry} of assembly.meshes){
  // Another renderer may have replaced this model while the engineer worked.
  if(mesh.geometry===geometry)mesh.geometry=source;
  geometry.dispose();
 }
 assembly.meshes.length=0;
}
