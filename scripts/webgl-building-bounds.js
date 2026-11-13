import * as THREE from 'three';
/** Actual visible triangles, excluding hidden legacy models/accessories and
 * unused vertices retained by silhouette simplification. Box3.setFromObject
 * includes all those vertices and therefore overstates the rendered height. */
export function renderedBuildingBounds(root){
 const box=new THREE.Box3(),point=new THREE.Vector3();
 root?.updateWorldMatrix(true,true);
 const visit=object=>{
  if(!object.visible)return;
  if(object.isMesh&&object.geometry){
   const g=object.geometry,p=g.getAttribute('position'),index=g.index;
   if(p){
    const count=index?.count??p.count,start=g.drawRange.start??0;
    const end=Math.min(count,start+g.drawRange.count);
    if(object.isInstancedMesh){
     const local=new THREE.Box3().setFromBufferAttribute(p),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
     for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);world.multiplyMatrices(object.matrixWorld,matrix);box.union(local.clone().applyMatrix4(world));}
    }else for(let i=start;i<end;i++){
     point.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(object.matrixWorld);box.expandByPoint(point);
    }
   }
  }
  for(const child of object.children)visit(child);
 };
 if(root)visit(root);
 return box;
}
