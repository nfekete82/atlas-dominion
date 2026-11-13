/**
 * Render-only simplification of the original Kaserne GLBs.
 *
 * The exported barracks combines hundreds of separate props (including a
 * watch tower, three rooftop fans and redundant vents) into ONE mesh per PBR
 * material called static__*. Hiding a material would destroy the building.
 * Instead remove only fully disconnected, small geometry islands in known
 * accessory regions. Keep the main roof, walls, doors, rig and PBR textures.
 *
 * This runs once per cloned model, never edits the downloaded GLB asset and
 * never changes simulation footprint, combat, collision or navmesh.
 */
export const BARRACKS_SILHOUETTE_REVISION='barracks-clean-silhouette-v2';

export function barracksAccessoryRegion(bounds){
 const x0=bounds.min.x,x1=bounds.max.x;
 const y0=bounds.min.y,y1=bounds.max.y;
 const z0=bounds.min.z,z1=bounds.max.z;
 const within=(a,b,lo,hi)=>a>=lo&&b<=hi;
 // A thin cap sits BELOW the removed tower region (actual Y 5.65–5.75).
 // Leaving it behind created a visibly floating square beside the roof.
 if(within(x0,x1,-8.60,-6.70)&&within(z0,z1,5.05,6.80)&&
    y0>=5.60&&y1<=5.85)return 'tower-support-cap';
 // The opposite flat roof carries three duplicated box ventilators. Keep
 // the middle housing; remove the two outer housings, lids and louvres.
 if(within(x0,x1,-7.50,-5.70)&&y0>=4.45&&y1<=5.20&&
    (within(z0,z1,-1.70,.10)||within(z0,z1,2.20,3.95)))
  return 'outer-box-vent';
 // The tall, disconnected guard tower at the rear-left corner. The roof
 // behind it is a much larger connected surface and therefore survives.
 if(within(x0,x1,-9.25,-6.15)&&within(z0,z1,4.00,7.60)&&y1>5.90)
  return 'tower';
 // Three identical roof fans crowd the opposite roof edge. Retain the
 // central unit, remove the first and third complete mechanical assemblies.
 if(within(x0,x1,5.70,7.50)&&y0>=4.45&&y1<=5.48&&
    (within(z0,z1,-1.70,.08)||within(z0,z1,2.77,4.48)))
  return 'outer-fan';
 // Two duplicate high ridge vents. One is enough to read as HVAC.
 if(within(x0,x1,-.65,.65)&&within(z0,z1,3.76,4.70)&&
    y0>6.0&&y1<6.90)
  return 'rear-ridge-vent';
 return null;
}

/** Keep all source vertex attributes and shared PBR maps; rewrite only
 * index buffers on a newly cloned geometry for each affected static mesh.
 * Components are computed by shared vertex indices, not by triangle centres:
 * a connected roof triangle can NEVER be cut merely for crossing a box.
 */
export function simplifyBarracksSilhouette(root){
 if(!root||root.userData.sandforgeBarracksSilhouette===BARRACKS_SILHOUETTE_REVISION)
  return 0;
 let removed=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||!/^static__/.test(mesh.name)||
     Array.isArray(mesh.material))return;
  const original=mesh.geometry,indices=original?.getIndex?.();
  const positions=original?.getAttribute?.('position');
  if(!indices||!positions||indices.count<3)return;
  const parent=new Int32Array(positions.count);
  for(let i=0;i<parent.length;i++)parent[i]=i;
  const find=start=>{
   let i=start;
   while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}
   return i;
  };
  const connect=(a,b)=>{
   const x=find(a),y=find(b);
   if(x!==y)parent[y]=x;
  };
  const faces=indices.count/3;
  for(let f=0;f<faces;f++){
   const offset=f*3,a=indices.getX(offset),b=indices.getX(offset+1),
    c=indices.getX(offset+2);
   connect(a,b);connect(a,c);
  }
  const islands=new Map();
  for(let f=0;f<faces;f++){
   const offset=f*3,a=indices.getX(offset),b=indices.getX(offset+1),
    c=indices.getX(offset+2),key=find(a);
   let box=islands.get(key);
   if(!box){
    box={min:{x:Infinity,y:Infinity,z:Infinity},
     max:{x:-Infinity,y:-Infinity,z:-Infinity}};
    islands.set(key,box);
   }
   for(const index of [a,b,c]){
    const x=positions.getX(index),y=positions.getY(index),
     z=positions.getZ(index);
    box.min.x=Math.min(box.min.x,x);box.min.y=Math.min(box.min.y,y);
    box.min.z=Math.min(box.min.z,z);
    box.max.x=Math.max(box.max.x,x);box.max.y=Math.max(box.max.y,y);
    box.max.z=Math.max(box.max.z,z);
   }
  }
  const ignored=new Set();
  for(const [id,bounds] of islands)
   if(barracksAccessoryRegion(bounds))ignored.add(id);
  if(!ignored.size)return;
  const kept=[];
  for(let f=0;f<faces;f++){
   const offset=f*3,a=indices.getX(offset);
   if(ignored.has(find(a))){removed++;continue;}
   kept.push(a,indices.getX(offset+1),indices.getX(offset+2));
  }
  if(!kept.length){
   // A few tiny, isolated GLB meshes (e.g. the watchtower roof beacon) may
   // consist entirely of removed accessories. Don't leave them hovering in
   // mid-air just because there is no remaining index buffer to build.
   mesh.visible=false;
   mesh.userData.sandforgeSimplifiedAccessory=true;
   return;
  }
  const geometry=original.clone();
  geometry.clearGroups();
  geometry.setIndex(kept);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  mesh.geometry=geometry;
 });
 root.userData.sandforgeBarracksSilhouette=BARRACKS_SILHOUETTE_REVISION;
 root.userData.sandforgeBarracksTrianglesRemoved=removed;
 return removed;
}
