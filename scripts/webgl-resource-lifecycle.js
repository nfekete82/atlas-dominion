/** Own-only GPU cleanup for runtime-generated decoration and placeholders.
 * Imported GLB geometry/textures are cached globally and MUST NOT be freed
 * on a single actor's death or a new camera/building selection.
 */
export function disposeOwnedMeshes(root,{geometries=true,materials=true}={}){
 if(!root?.traverse)return {geometries:0,materials:0};
 const g=new Set(),m=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(geometries&&o.geometry?.dispose)g.add(o.geometry);
  if(materials){
   const list=Array.isArray(o.material)?o.material:[o.material];
   for(const mat of list)if(mat?.dispose)m.add(mat);
  }
 });
 for(const item of g)item.dispose();
 for(const item of m)item.dispose();
 return {geometries:g.size,materials:m.size};
}
/** Only per-instance brightening or preview clones; never GLTF cache assets. */
export function disposeTaggedMaterials(root,tag){
 if(!root?.traverse)return 0;
 const materials=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  const list=Array.isArray(o.material)?o.material:[o.material];
  for(const mat of list)if(mat?.userData?.[tag]&&mat?.dispose)materials.add(mat);
 });
 for(const material of materials)material.dispose();
 return materials.size;
}
