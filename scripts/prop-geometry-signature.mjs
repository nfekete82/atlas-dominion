/** Material-independent invariant for the exported masters, including existing UVs. */
import {createHash} from 'node:crypto';
export function propGeometrySignature(bytes){
 const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 const digest=accessor=>{
  const a=g.accessors[accessor],v=g.bufferViews[a.bufferView];
  if(a.sparse)throw Error('Unexpected sparse prop geometry');
  return {type:a.type,componentType:a.componentType,count:a.count,normalized:a.normalized??false,
   min:a.min,max:a.max,stride:v.byteStride??0,offset:a.byteOffset??0,
   hash:createHash('sha256').update(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)).digest('hex')};
 };
 const data={scenes:g.scenes,nodes:g.nodes.map(({name,children,mesh,matrix,translation,rotation,scale})=>({name,children,mesh,matrix,translation,rotation,scale})),
  meshes:g.meshes.map(m=>({name:m.name,primitives:m.primitives.map(p=>({mode:p.mode??4,indices:p.indices===undefined?null:digest(p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,digest(v)]))}))}))};
 return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
