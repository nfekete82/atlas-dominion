import * as THREE from 'three';
/**
 * Continuous outer canyon walls form a readable end-of-map silhouette.
 * They begin OUTSIDE the authoritative World, so no cells are opened,
 * no unit/pathfinding bounds change and projectiles do not hit them.
 */
export function addBoundaryCliffs({scene,size,heightAt,seed=0,lowQuality=false}){
 const half=size*.5,rows=[0,24,62,112,174,238];
 const lift=[0,5,38,105,139,145];
 const tiles=lowQuality?48:112;
 const materials=new THREE.MeshStandardMaterial({
  color:'#e7d5bb',roughness:1,metalness:0,vertexColors:true,
  side:THREE.DoubleSide
 });
 const colors=[
  new THREE.Color('#d1bd99'),new THREE.Color('#c4a984'),
  new THREE.Color('#97795d'),new THREE.Color('#8c7359'),
  new THREE.Color('#b09a78'),new THREE.Color('#c5b18c')
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
   const t=k/tiles,p=boundaryPoint(edge,t,rows[band]);
   const irregular=Math.sin(t*46+edge*11.3+seed*.001)*6+
      Math.sin(t*93-edge*5.1+seed*.0004)*2.8;
   const amount=band===0?0:irregular*(band/rows.length)*Math.sin(Math.PI*t);
   const y=heightAt(p.x,p.z)+lift[band]+amount;
   positions.push(p.x-half,y,p.z-half);
   // Fine striations and changing sun exposure break the uniform wall.
   const strata=Math.sin(y*.18+t*61+edge*3)*.045+
     Math.cos(y*.49-t*39)*.025;
   const c=colors[band].clone().multiplyScalar(.94+strata);
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
 const monolithGeometry=new THREE.DodecahedronGeometry(1,1);
 const monolithMaterial=new THREE.MeshStandardMaterial({
  color:'#a99070',roughness:1,metalness:0,flatShading:true
 });
 const perEdge=lowQuality?12:28;
 const monoliths=new THREE.InstancedMesh(monolithGeometry,monolithMaterial,perEdge*4);
 let monolithCount=0;
 for(let edge=0;edge<4;edge++)for(let i=0;i<perEdge;i++){
  const t=(i+.16+rand()*.68)/perEdge;
  // Keep every rock beyond the playable 0..size square.
  const offset=43+rand()*155;
  const p=boundaryPoint(edge,t,offset);
  const width=46+rand()*93,height=100+rand()*170;
  dummy.position.set(p.x-half,heightAt(p.x,p.z)+height*.43,p.z-half);
  dummy.rotation.set((rand()-.5)*.16,rand()*Math.PI*2,(rand()-.5)*.22);
  dummy.scale.set(width,height,width*(.65+rand()*.65));
  dummy.updateMatrix();monoliths.setMatrixAt(monolithCount++,dummy.matrix);
 }
 monoliths.count=monolithCount;
 monoliths.instanceMatrix.needsUpdate=true;
 monoliths.castShadow=false;monoliths.receiveShadow=true;
 monoliths.userData={visualBoundary:true,nonPlayable:true,monoliths:true};
 monoliths.name='visual-boundary-monoliths';
 scene.add(monoliths);
 return {cliffs,scree,monoliths,height:315,margin:238,collisionChanged:false};
}
