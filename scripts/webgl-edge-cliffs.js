import * as THREE from 'three';
/**
 * Continuous outer canyon walls form a readable end-of-map silhouette.
 * They begin OUTSIDE the authoritative World, so no cells are opened,
 * no unit/pathfinding bounds change and projectiles do not hit them.
 */
export function addBoundaryCliffs({scene,size,heightAt,seed=0,lowQuality=false}){
 const half=size*.5,rows=[0,20,58,102,164,254];
 const lift=[0,12,64,157,222,268];
 const tiles=lowQuality?48:112;
 const materials=new THREE.MeshStandardMaterial({
  color:'#f0e0c5',roughness:1,metalness:0,vertexColors:true,
  side:THREE.DoubleSide
 });
 const colors=[
  new THREE.Color('#e2c99e'),new THREE.Color('#cbb08a'),
  new THREE.Color('#a88461'),new THREE.Color('#80644c'),
  new THREE.Color('#b69872'),new THREE.Color('#d0b08a')
 ];
 const cliffs=[],scree=[];
 function boundaryPoint(edge,t,offset){
  // Extend each outer band to the offset of its adjacent edge, closing all
  // four rocky corners without visible cracks or disconnected wall segments.
  const along=-offset+t*(size+2*offset);
  if(edge===0)return {x:along,z:-offset};         // north
  if(edge===1)return {x:size+offset,z:along};    // east
  if(edge===2)return {x:size-along,z:size+offset}; // south
  return {x:-offset,z:size-along};                 // west
 }
 // Each wall is ONE continuous indexed mesh with terraced heightfield,
 // rather than hundreds of identical red boulders on the ground.
 for(let edge=0;edge<4;edge++){
  const positions=[],uv=[],vertexColors=[],indices=[];
  for(let band=0;band<rows.length;band++)for(let k=0;k<=tiles;k++){
   const t=k/tiles;
   // Both ends retain the original corner positions/heights, so adjacent
   // walls share identical vertices. Interior sections form broken escarpments
   // and a visibly mountainous skyline instead of four straight rails.
   const cornerSafe=Math.sin(Math.PI*t)**2;
   const ledgeWobble=cornerSafe*(Math.sin(t*31+seed*.0007+edge*4.1)*10+
     Math.sin(t*77-seed*.0004+edge*1.8)*4);
   const offset=rows[band]+(band===0?0:ledgeWobble*band/(rows.length-1));
   const p=boundaryPoint(edge,t,offset);
   const ridge=1+cornerSafe*(.25*Math.sin(t*15+seed*.0017+edge*.9)+
     .19*Math.sin(t*38-seed*.0011+edge*2.7)+
     .30*Math.max(0,Math.sin(t*24+edge*1.5+seed*.0003)));
   const weather=cornerSafe*(Math.sin(t*97+edge*9.3)*5+
     Math.sin(t*173+band*2.4)*2)*(band/(rows.length-1));
   const y=heightAt(p.x,p.z)+lift[band]*ridge+weather;
   positions.push(p.x-half,y,p.z-half);
   // Fine striations and changing sun exposure break the uniform wall.
   const strata=Math.sin(y*.11+t*47+edge*3)*.065+
     Math.cos(y*.27-t*31)*.035;
   const c=colors[band].clone().multiplyScalar(.97+strata);
   vertexColors.push(c.r,c.g,c.b);
   uv.push(t*size/250,band*.65);
  }
  for(let band=0;band<rows.length-1;band++)for(let k=0;k<tiles;k++){
   const a=band*(tiles+1)+k,b=a+1,c=a+tiles+1,d=c+1;
   indices.push(a,b,c,b,d,c);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(vertexColors,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices);geom.computeVertexNormals();
  const wall=new THREE.Mesh(geom,materials);
  // Short vertex contours give the cliffs broad side-to-side stratification
  // instead of a row of repeated orange boulders. Slight environmental
  // roughness and consistent sand colors keep them in the same light family.
  wall.receiveShadow=true;wall.castShadow=false;wall.frustumCulled=true;
  wall.name='visual-boundary-cliff-'+edge;
  wall.userData={visualBoundary:true,nonPlayable:true,edge};
  scene.add(wall);cliffs.push(wall);
 }
 // A thin strip of small scree at the inner foot of each wall physically
 // joins the cliff to the desert, with one GPU call for all debris.
 const geometry=new THREE.DodecahedronGeometry(1,0);
 const rubble=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({
  color:'#b8a084',roughness:1,metalness:0
 }),lowQuality?256:640);
 let count=0,randomState=(seed^0xe182cd73)>>>0;
 const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const dummy=new THREE.Object3D();
 for(let edge=0;edge<4;edge++)for(let i=0;i<(lowQuality?64:160);i++){
  const p=boundaryPoint(edge,rand(),5+rand()*48),w=2.5+rand()*8;
  dummy.position.set(p.x-half,heightAt(p.x,p.z)+w*.15,p.z-half);
  dummy.scale.set(w*(1+rand()),w*.3,w*(.7+rand()));
  dummy.rotation.set((rand()-.5)*.3,rand()*Math.PI*2,(rand()-.5)*.2);
  dummy.updateMatrix();rubble.setMatrixAt(count++,dummy.matrix);
 }
 rubble.count=count;rubble.instanceMatrix.needsUpdate=true;
 rubble.castShadow=false;rubble.receiveShadow=true;
 rubble.userData={visualBoundary:true,nonPlayable:true,scree:true};
 scene.add(rubble);scree.push(rubble);
 // Monumental weathered sandstone outcrops. Purely visual and instanced:
 // never registered with the World, raycasts, navigation, or capture systems.
 // Low-poly facets retain a rock silhouette, but a deterministic deformation
 // breaks the repeated egg-like shape of the old dodecahedron instances.
 const monolithGeometry=new THREE.IcosahedronGeometry(1,1);
 const rockVertices=monolithGeometry.getAttribute('position');
 for(let v=0;v<rockVertices.count;v++){
  const x=rockVertices.getX(v),y=rockVertices.getY(v),z=rockVertices.getZ(v);
  const chip=1+.14*Math.sin(x*17+y*9+z*21)+.075*Math.cos(y*29-x*13);
  rockVertices.setXYZ(v,x*chip,y*(.94+.09*Math.sin(x*23+z*7)),z*chip);
 }
 rockVertices.needsUpdate=true;
 monolithGeometry.computeVertexNormals();
 const monolithMaterial=new THREE.MeshStandardMaterial({
  color:'#b69a78',roughness:1,metalness:0,flatShading:true
 });
 const perEdge=lowQuality?12:28;
 const monoliths=new THREE.InstancedMesh(monolithGeometry,monolithMaterial,perEdge*4);
 let monolithCount=0;
 for(let edge=0;edge<4;edge++)for(let i=0;i<perEdge;i++){
  const t=(i+.16+rand()*.68)/perEdge;
  // Keep every rock beyond the playable 0..size square.
  const offset=43+rand()*155;
  const p=boundaryPoint(edge,t,offset);
  const width=53+rand()*102,height=106+rand()*210;
  // Sink the outcrop into its terrain, rather than exposing a flat model base.
  dummy.position.set(p.x-half,heightAt(p.x,p.z)+height*.27,p.z-half);
  dummy.rotation.set((rand()-.5)*.16,rand()*Math.PI*2,(rand()-.5)*.22);
  dummy.scale.set(width,height,width*(.65+rand()*.85));
  dummy.updateMatrix();monoliths.setMatrixAt(monolithCount++,dummy.matrix);
 }
 monoliths.count=monolithCount;
 monoliths.instanceMatrix.needsUpdate=true;
 monoliths.castShadow=!lowQuality;monoliths.receiveShadow=true;
 monoliths.userData={visualBoundary:true,nonPlayable:true,monoliths:true};
 monoliths.name='visual-boundary-monoliths';
 scene.add(monoliths);
 return {cliffs,scree,monoliths,height:440,margin:254,collisionChanged:false};
}
