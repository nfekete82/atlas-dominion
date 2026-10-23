import * as T from 'three';
/** Split existing disconnected rigid mesh islands; never synthesize a rotor. */
export function extractRotor(model){
 const mesh=model.getObjectByName('Cube_4');if(!mesh?.geometry)return null;model.updateMatrixWorld(true);
 const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),g=geometry.index?geometry.toNonIndexed():geometry;
 const a=g.attributes.position,n=g.attributes.normal,parent=new Int32Array(a.count),points=new Map();for(let i=0;i<a.count;i++)parent[i]=i;
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},union=(a,b)=>{parent[root(a)]=root(b);};
 for(let i=0;i<a.count;i++){const key=[a.getX(i),a.getY(i),a.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(points.has(key))union(i,points.get(key));else points.set(key,i);}
 for(let i=0;i<a.count;i+=3){union(i,i+1);union(i,i+2);}
 const parts=new Map();for(let i=0;i<a.count;i+=3){const id=root(i);if(!parts.has(id))parts.set(id,[]);parts.get(id).push(i,i+1,i+2);}
 const moving=[],fixed=[],box=new T.Box3();
 for(const indices of parts.values()){
  const b=new T.Box3();for(const i of indices)b.expandByPoint(new T.Vector3().fromBufferAttribute(a,i));const size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
  const rotor=size.y<.17&&(size.x>1||size.z>1)&&center.y>1.2;
  if(rotor){moving.push(...indices);box.union(b);}else fixed.push(...indices);
 }
 if(!moving.length)return null;
 const make=indices=>{const p=[],norm=[];for(const i of indices){p.push(a.getX(i),a.getY(i),a.getZ(i));norm.push(n.getX(i),n.getY(i),n.getZ(i));}const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(p,3));result.setAttribute('normal',new T.Float32BufferAttribute(norm,3));return result;};
 mesh.visible=false;const staticPart=new T.Mesh(make(fixed),mesh.material.clone());staticPart.name='Rotor_Support';model.add(staticPart);
 const pivot=box.getCenter(new T.Vector3()),rotor=new T.Group();rotor.name='Main_Rotor';rotor.position.copy(pivot);const blades=new T.Mesh(make(moving).translate(-pivot.x,-pivot.y,-pivot.z),mesh.material.clone());blades.name='Rotor_Blades';rotor.add(blades);model.add(rotor);return rotor;
}
