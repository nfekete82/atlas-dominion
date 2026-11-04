import * as THREE from 'three';

/** Visible-only terrain ring around the authoritative Sandforge map.
 * Never passes meshes to input raycasting, fog, collision, AI or the saved
 * World. Camera can see continuous desert beyond the playable boundary.
 * Exact world-space UVs and height samples match the real terrain edges.
 */
export function addVisualPerimeter({scene,size,heightAt,material,ringTiles=2,segments=24}){
 const playableChunks=4,patch=size/playableChunks,half=size*.5;
 const out=[],normal=new THREE.Vector3();
 const c0=new THREE.Color('#faf1e0'),c1=new THREE.Color('#b58b63');
 const warmRim=new THREE.Color('#b28250');
 const darkBeyond=new THREE.Color('#070909');
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
 // Only the four central tiles per side are playable. The surrounding mesh
 // is visual-only: a warm erosion apron dissolves into near-black map void.
 // Keep exactly the same edge heights and normals at x/z = 0 or size.
 const margin=ringTiles*patch;
 const outsideDistance=(x,z)=>Math.max(0,-x,x-size,-z,z-size);
 const heightFade=(x,z)=>smooth((outsideDistance(x,z)-margin*.36)/(margin*.64));
 const outerHeight=(x,z)=>heightAt(x,z)*(1-heightFade(x,z));
 // A seeded-looking irregular coastline prevents a rectangular shadow edge.
 // Its darkest part begins well BEYOND the decorative cliff foot.
 const edgeShadow=(x,z)=> {
  const uneven=31*Math.sin(x*.011+z*.007)+17*Math.sin(z*.021-x*.009);
  return smooth((outsideDistance(x,z)-300-uneven)/310);
 };
 for(let cy=-ringTiles;cy<playableChunks+ringTiles;cy++)
  for(let cx=-ringTiles;cx<playableChunks+ringTiles;cx++){
   if(cx>=0&&cx<playableChunks&&cy>=0&&cy<playableChunks)continue;
   const count=(segments+1)*(segments+1);
   const positions=new Float32Array(count*3);
   const colors=new Float32Array(count*3);
   const uv=new Float32Array(count*2);
   const normals=new Float32Array(count*3);
   const indices=[];
   for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
    const x=(cx+i/segments)*patch,z=(cy+j/segments)*patch,h=outerHeight(x,z);
    const shadow=edgeShadow(x,z);
    const k=j*(segments+1)+i,n=k*3;
    positions[n]=x-half;positions[n+1]=h;positions[n+2]=z-half;
    const slope=Math.abs(outerHeight(x,z-24)-outerHeight(x,z+24))/48;
    const rocky=smooth((slope-.20)/.9);
    const nval=.96+.055*Math.sin(x*.013+z*.009)+.025*Math.cos(x*.071-z*.032);
    const bands=(Math.sin(h*.19+x*.003+z*.002)*.5+.5)*rocky;
    const outside=outsideDistance(x,z);
    const rim=smooth((outside-24)/145)*(1-smooth((outside-160)/190));
    const color=c0.clone().lerp(c1,rocky*.65+bands*.12).multiplyScalar(nval);
    color.lerp(warmRim,rim*.44).lerp(darkBeyond,shadow*.997);
    colors[n]=color.r;colors[n+1]=color.g;colors[n+2]=color.b;
    uv[k*2]=x/1500;uv[k*2+1]=z/1500;
    // The same finite-difference sampling across chunk boundaries prevents
    // normal seams even with fewer triangles on the decorative outer ring.
    const eps=1.6;
    const dx=(outerHeight(x+eps,z)-outerHeight(x-eps,z))/(2*eps);
    const dz=(outerHeight(x,z+eps)-outerHeight(x,z-eps))/(2*eps);
    normal.set(-dx,1,-dz).normalize();
    normals[n]=normal.x;normals[n+1]=normal.y;normals[n+2]=normal.z;
   }
   for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){
    const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
    indices.push(a,c,b,b,c,d);
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
   geometry.setIndex(indices);
   const mesh=new THREE.Mesh(geometry,material);
   mesh.receiveShadow=true;
   mesh.userData={visualPerimeter:true,nonPlayable:true,tileX:cx,tileY:cy};
   mesh.frustumCulled=true;
   scene.add(mesh);out.push(mesh);
  }
 return {
  meshes:out,
  margin:ringTiles*patch,
  minX:-ringTiles*patch,
  maxX:size+ringTiles*patch,
  minZ:-ringTiles*patch,
  maxZ:size+ringTiles*patch
 };
}
