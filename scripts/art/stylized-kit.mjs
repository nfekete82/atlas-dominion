import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Original Sandforge shapes. Metres, Y up, +Z forward, ground-centred pivot.
// Colour is authored per vertex, including broad camouflage panels and occlusion.
export const PALETTE=Object.freeze({sand:'#bd985b',sandLight:'#dfbd80',sandShade:'#907342',
 olive:'#666c40',oliveLight:'#828650',roof:'#303e35',recess:'#192a2b',metal:'#45534a',
 rubber:'#222e2e',tread:'#34413a',glass:'#28545b',glassLight:'#5c9292',
 skin:'#c58d5e',skinLight:'#e2ad7a',leather:'#4e4631',blue:'#278ac7',red:'#c94c38',
 lamp:'#f6d28a',amber:'#e69c35'});
export const ART_VERSION='sandforge-stylized-v1';
export const METRES_TO_WORLD=18;
export function kit(owner=0){
 const colors={...PALETTE,team:owner===0?PALETTE.blue:PALETTE.red};
 const surface=new T.MeshStandardMaterial({name:'SFV1_Painted',vertexColors:true,roughness:.83,metalness:.08});
 const steel=new T.MeshStandardMaterial({name:'SFV1_Metal',vertexColors:true,roughness:.56,metalness:.48});
 const glass=new T.MeshStandardMaterial({name:'SFV1_Glass',vertexColors:true,roughness:.26,metalness:.24});
 for(const m of [surface,steel,glass])m.userData.sandforgeStylized=ART_VERSION;
 const parts=[];
 function part(parent,name,geometry,color='sand',at=[0,0,0],rotation=[0,0,0],material=surface){
  const source=geometry.index?geometry.toNonIndexed():geometry,positions=source.attributes.position;
  const vertices=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<positions.count;i+=3){
   a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);
   if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)continue;
   for(let j=0;j<3;j++)vertices.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.computeVertexNormals();g.normalizeNormals();
  // Flat normals and large bevel faces are intentional, never random noise.
  const paint=new T.Color(colors[color]??color),data=[];
  for(let i=0;i<g.attributes.position.count;i++)data.push(paint.r,paint.g,paint.b);
  g.setAttribute('color',new T.Float32BufferAttribute(data,3));
  const mesh=new T.Mesh(g,material);mesh.name=name;mesh.position.set(...at);mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);parts.push(mesh);return mesh;
 }
 function box(parent,name,size,at,color='sand',bevel=.025,rotation=[0,0,0],material=surface){
  const [w,h,d]=size,b=Math.min(bevel,w*.22,h*.22,d*.22);
  // Octagonal footprint with a bevelled upper/lower rim.
  const outline=[[-w/2+b,-d/2],[w/2-b,-d/2],[w/2,-d/2+b],[w/2,d/2-b],
   [w/2-b,d/2],[-w/2+b,d/2],[-w/2,d/2-b],[-w/2,-d/2+b]];
  const vertices=[],rings=[[-h/2,b],[-h/2+b,0],[h/2-b,0],[h/2,b]];
  const ring=(r,i)=>{const [y,inset]=rings[r],[x,z]=outline[(i+8)%8];return [x-Math.sign(x)*inset,y,z-Math.sign(z)*inset];};
  const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let r=0;r<3;r++)for(let i=0;i<8;i++){
   const a=ring(r,i),b=ring(r,i+1),c=ring(r+1,i+1),d=ring(r+1,i);
   tri(a,c,b);tri(a,d,c);
  }
  for(let i=1;i<7;i++){tri(ring(0,0),ring(0,i),ring(0,i+1));tri(ring(3,0),ring(3,i+1),ring(3,i));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  return part(parent,name,g,color,at,rotation,material);
 }
 function cylinder(parent,name,radius,length,at,color='metal',rotation=[0,0,0],segments=10,material=surface){
  return part(parent,name,new T.CylinderGeometry(radius,radius,length,segments,1,false),color,at,rotation,material);
 }
 function polygon(parent,name,points,color,material=surface){
  const a=new T.Vector3(...points[0]),b=new T.Vector3(...points[1]),c=new T.Vector3(...points[2]);
  const normal=b.sub(a).cross(c.sub(a)),center=new T.Vector3();
  for(const p of points)center.add(new T.Vector3(...p));
  if(normal.dot(center)<0)points=[...points].reverse();
  const v=[];for(let i=1;i<points.length-1;i++)v.push(...points[0],...points[i],...points[i+1]);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));
  return part(parent,name,g,color,[0,0,0],[0,0,0],material);
 }
 function profile(parent,name,points,width,color='sand',at=[0,0,0]){
  // Cross section [Z,Y], extruded across X. True wheel notches / pitched roofs.
  const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1,curveSegments:1});
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i),x=p.getZ(i)-width/2;p.setXYZ(i,x,y,z);}
  // Swapping X/Z reverses winding.
  for(let i=0;i<p.count;i+=3)for(let k=0;k<3;k++){const v=p.array[(i+1)*3+k];p.array[(i+1)*3+k]=p.array[(i+2)*3+k];p.array[(i+2)*3+k]=v;}
  return part(parent,name,g,color,at);
 }
 function batch(root){
  // Each rigid parent exports one primitive per coating, retaining real pivots.
  for(const child of [...root.children])if(!child.isMesh&&!child.isBone)batch(child);
  const buckets=new Map();
  for(const child of [...root.children])if(child.isMesh&&!child.isSkinnedMesh){
   child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix);
   if(!buckets.has(child.material))buckets.set(child.material,[]);
   buckets.get(child.material).push(g);root.remove(child);
  }
  for(const [mat,geometries] of buckets){
   const mesh=new T.Mesh(mergeVertices(mergeGeometries(geometries),1e-5),mat);mesh.name=root.name+'_'+mat.name;
   mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  }
 }
 return {colors,surface,steel,glass,part,box,cylinder,polygon,profile,batch,parts};
}
export function rootModel(kind,owner=0){
 const root=new T.Group();root.name='SFV1_'+kind;
 root.userData={sandforgeStylized:ART_VERSION,kind,owner,metresToWorld:METRES_TO_WORLD,
  axes:'Y up; +Z forward; barracks exit -Z',groundY:0,originalArtwork:true};
 return root;
}
export function quaternionTrack(name,times,poses){
 const values=poses.flatMap(p=>new T.Quaternion().setFromEuler(new T.Euler(...p)).toArray());
 return new T.QuaternionKeyframeTrack(name+'.quaternion',times,values);
}
