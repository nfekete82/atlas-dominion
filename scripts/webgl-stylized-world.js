import * as T from 'three';

// Original low-poly scenery for the Desert Patrol visual language.
// Cosmetic-only: world collision, terrain heights, paths, saves, territory
// visibility, the black map boundary and building placement are unchanged.
const rnd=seed=>{let n=(seed^0x769baf21)>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
const colorSet=['#c29b6d','#b68863','#dfb789','#866e58'];
const rockGeometry=new T.IcosahedronGeometry(1,0);
const debrisGeometry=new T.DodecahedronGeometry(1,0);
const trunkGeometry=new T.CylinderGeometry(.39,.68,1,5,1);
const canopyGeometry=new T.TetrahedronGeometry(1,0);
const material=()=>new T.MeshStandardMaterial({color:'#ffffff',flatShading:true,roughness:.96,metalness:0});
const treeMaterial=()=>new T.MeshStandardMaterial({color:'#ffffff',flatShading:true,roughness:.97,metalness:0,side:T.DoubleSide});

export function addStylizedDesertWorld({scene,world,terrain,game,heightAt,seed,lowQuality=false}){
 const size=world.size,half=size/2,random=rnd(seed),sites=[...(terrain.sites??[]),...(terrain.ruins??[])];
 const maxRocks=lowQuality?160:370,maxTrees=lowQuality?25:64,maxBushes=lowQuality?70:160;
 const rock=new T.InstancedMesh(rockGeometry,material(),maxRocks);
 const pebbles=new T.InstancedMesh(debrisGeometry,material(),maxRocks);
 const trunks=new T.InstancedMesh(trunkGeometry,material(),maxTrees);
 const leaves=new T.InstancedMesh(canopyGeometry,treeMaterial(),maxTrees*5);
 const shrubs=new T.InstancedMesh(canopyGeometry,treeMaterial(),maxBushes);
 const dummy=new T.Object3D();
 const playable=(x,z)=>{
  if(x<125||z<125||x>size-125||z>size-125)return false;
  const p={x,y:z},index=world.index(p);
  if(index<0||world.blocked[index]||!world.walkable(p))return false;
  if(sites.some(s=>Math.hypot(s.x-x,s.y-z)<190))return false;
  if((game?.units??[]).some(u=>Math.hypot(u.x-x,u.y-z)<130))return false;
  return true;
 };
 const scatter=(count,fn)=>{
  let placed=0;
  for(let i=0;i<count*30&&placed<count;i++){
   const x=135+random()*(size-270),z=135+random()*(size-270);
   if(!playable(x,z))continue;
   fn(x,z,placed++); 
  }
  return placed;
 };
 const place=(mesh,index,x,y,z,sx,sy,sz,yaw=0,roll=0)=>{
  dummy.position.set(x-half,y,z-half);dummy.rotation.set(0,yaw,roll);
  dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
 };
 const nr=scatter(maxRocks,(x,z,i)=>{
  const y=heightAt(x,z),r=3+random()*9,angle=random()*Math.PI*2;
  place(rock,i,x,y+r*.27,z,r,r*(.55+random()*.35),r*(.75+random()*.5),angle,(random()-.5)*.19);
  rock.setColorAt(i,new T.Color(colorSet[Math.floor(random()*colorSet.length)]));
  place(pebbles,i,x+r*.78,y+.75,z-r*.53,r*.38,r*.28,r*.42,angle+.6);
  pebbles.setColorAt(i,new T.Color(colorSet[(Math.floor(random()*4)+1)%4]));
 });
 const nt=scatter(maxTrees,(x,z,i)=>{
  const y=heightAt(x,z),height=17+random()*16,spread=12+random()*9,angle=random()*Math.PI*2;
  place(trunks,i,x,y+height*.43,z,1.65,height*.86,1.65,angle,.07);
  trunks.setColorAt(i,new T.Color('#826c50'));
  // Five unmistakable broad angular palm fronds; one instanced draw call.
  for(let j=0;j<5;j++){
   const a=angle+j*Math.PI*2/5,stretch=.80+random()*.38;
   place(leaves,i*5+j,x+Math.sin(a)*spread*.47,y+height*.92,z+Math.cos(a)*spread*.47,
    3.5,2.15,spread*stretch,a,Math.PI*.22);
   leaves.setColorAt(i*5+j,new T.Color(j%2?'#536b3b':'#6d824b'));
  }
 });
 const nb=scatter(maxBushes,(x,z,i)=>{
  const y=heightAt(x,z),s=2+random()*4;
  place(shrubs,i,x,y+s*.35,z,s*1.25,s*.60,s*1.1,random()*6.283);
  shrubs.setColorAt(i,new T.Color(i%3===0?'#7a8545':'#677445'));
 });
 const result=[['rocks',rock,nr],['rock-chips',pebbles,nr],['palm-trunks',trunks,nt],['palm-leaves',leaves,nt*5],['desert-bushes',shrubs,nb]];
 for(const [name,mesh,count] of result){
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.name='visual-stylized-'+name;
  mesh.userData={visualOnly:true,nonPlayable:true,scenery:true,sandforgeStylizedWorld:true};
  mesh.raycast=()=>{};mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
  if(count>0)scene.add(mesh);
 }
 return {rocks:nr,palms:nt,bushes:nb,meshes:result.filter(([,m,n])=>n).map(([,m])=>m)};
}
