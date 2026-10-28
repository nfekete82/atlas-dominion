import * as T from 'three';

// Offline-authored, deterministic surfaces. One atlas and one packed ORM map
// are shared by every hard surface; nothing here executes in the RTS loop.
export const SURFACE_REVISION=4;
const SIZE=2048;
const tiles={sand:[0,0,1024,1024],camo:[1024,0,1024,1024],steel:[0,1024,512,512],concrete:[512,1024,512,512],blue:[1024,1024,512,512],red:[1536,1024,512,512],rubber:[0,1536,512,512],glass:[512,1536,512,512],neutral:[1024,1536,512,512],hazard:[1536,1536,512,512]};
let cached;
const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=SIZE;return c;};
function noise(x,y,seed){let h=Math.imul(x,374761393)+Math.imul(y,668265263)+seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function smoothNoise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,u=a*a*(3-2*a),v=b*b*(3-2*b);return T.MathUtils.lerp(T.MathUtils.lerp(noise(ix,iy,seed),noise(ix+1,iy,seed),u),T.MathUtils.lerp(noise(ix,iy+1,seed),noise(ix+1,iy+1,seed),u),v);}

export function buildingSurfaces(){
 if(cached)return cached;
 const albedo=canvas(),normal=canvas(),orm=canvas(),ac=albedo.getContext('2d'),nc=normal.getContext('2d'),oc=orm.getContext('2d');
 const colors={sand:[171,150,111],camo:[172,154,114],steel:[76,88,83],concrete:[119,112,94],blue:[36,91,159],red:[158,49,37],rubber:[30,34,32],glass:[43,65,66],neutral:[184,179,152],hazard:[189,155,65]};
 let seed=0x41a71a5;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const [role,[tx,ty,w,h]] of Object.entries(tiles)){
  const color=colors[role],base=ac.createImageData(w,h),packed=oc.createImageData(w,h),norm=nc.createImageData(w,h),height=new Float32Array(w*h);
  const metal=role==='steel',soft=role==='rubber',glass=role==='glass',concrete=role==='concrete';
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,u=x/w,v=y/h,fine=noise(x,y,401),cloud=smoothNoise(x/62,y/62,501),dirt=smoothNoise(x/19,y/19,907);
   const edge=Math.min(u,1-u,v,1-v),seam=Math.min(Math.abs(u-.035),Math.abs(u-.965));
   const groove=Math.exp(-seam*w*.48),rim=Math.max(0,1-edge*45),dust=(Math.pow(v,4)*.16+Math.max(0,cloud-.5)*.20)*(soft?.4:1);
   let rgb=color;
   if(role==='camo'){
    const patch=smoothNoise(x/145,y/100,619)+.24*smoothNoise(x/40,y/41,88);
    rgb=patch<.45?[57,80,60]:patch<.60?[118,116,77]:patch<.78?[180,151,101]:[209,179,126];
   }
   if(role==='hazard')rgb=((x+y)>>6)%2?[41,43,38]:color;
   const chipped=!soft&&!glass&&!concrete&&(rim>0&&fine>.83-rim*.18||dirt>.73&&fine>.96);
   for(let k=0;k<3;k++){
    let value=rgb[k]+(fine-.5)*(glass?3:12)+(cloud-.5)*17-groove*24;
    value=T.MathUtils.lerp(value,[182,160,121][k],dust);
    if(chipped)value=[83,86,78][k]+fine*24;
    base.data[i+k]=Math.max(0,Math.min(255,value));
   }
   base.data[i+3]=255;
   height[y*w+x]=(fine-.5)*(concrete?.24:.045)-groove*.13-(chipped?.08:0)+(metal?Math.sin(y*1.7)*.012:0);
   packed.data[i]=Math.round(255-groove*65-rim*12); // glTF: occlusion R
   packed.data[i+1]=Math.round(glass?55+cloud*30:soft?237+fine*15:metal?116+cloud*55+dust*70:191+cloud*35+dust*20);
   packed.data[i+2]=Math.round(glass||soft||concrete?0:chipped?210:metal?215-dust*90:28-dust*20);
   packed.data[i+3]=255;
  }
  ac.putImageData(base,tx,ty);oc.putImageData(packed,tx,ty);
  // Small paint scratches and weld beads, painted into matching height/ORM.
  for(let n=0;n<(glass?24:metal?650:450);n++){
   const x=Math.floor(10+random()*(w-35)),y=Math.floor(10+random()*(h-20)),length=2+Math.floor(random()*(metal?36:16));
   for(let j=0;j<length&&x+j<w;j++){
    height[y*w+x+j]-=.08;
    const i=(y*w+x+j)*4;
    for(let k=0;k<3;k++)base.data[i+k]=T.MathUtils.lerp(base.data[i+k],soft?55:glass?110:105,.35);
    if(!soft&&!glass&&!concrete)packed.data[i+2]=155;
   }
  }
  // Welded panel joints with irregular raised beads, rather than painted lines.
  if(['sand','camo','steel'].includes(role))for(let y=12;y<h-12;y++){
   const x=Math.round(w*.036+Math.sin(y*1.4)*.7);
   height[y*w+x]+=.16;const i=(y*w+x)*4;
   for(let k=0;k<3;k++)base.data[i+k]=color[k]*.72;
   packed.data[i+1]=150;packed.data[i+2]=175;
  }
  ac.putImageData(base,tx,ty);oc.putImageData(packed,tx,ty);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const sample=(a,b)=>height[Math.max(0,Math.min(h-1,b))*w+Math.max(0,Math.min(w-1,a))];
   const dx=(sample(x-1,y)-sample(x+1,y))*2,dy=(sample(x,y-1)-sample(x,y+1))*2,len=Math.hypot(dx,dy,1),i=(y*w+x)*4;
   norm.data[i]=Math.round((dx/len*.5+.5)*255);norm.data[i+1]=Math.round((-dy/len*.5+.5)*255);norm.data[i+2]=Math.round((1/len*.5+.5)*255);norm.data[i+3]=255;
  }
  nc.putImageData(norm,tx,ty);
  if(['blue','red','neutral'].includes(role)){
   // The top half is a dedicated identification decal; bottom half is enamel.
   ac.fillStyle='#d9d0ac';ac.font='bold 63px monospace';ac.textAlign='center';ac.fillText(role==='neutral'?'NEUTRAL':'ATLAS',tx+w/2,ty+86);
   ac.font='bold 92px monospace';ac.fillText(role==='neutral'?'N / 00':role==='blue'?'A / 01':'A / 02',tx+w/2,ty+188);
   ac.fillRect(tx+35,ty+212,w-70,5);
  }
 }
 const make=(source,name,srgb=false)=>{const t=new T.CanvasTexture(source);t.name=name;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=8;return t;};
 cached={map:make(albedo,'Atlas desert | embedded base color',true),normalMap:make(normal,'Atlas desert | tangent normal'),orm:make(orm,'Atlas desert | occlusion roughness metallic')};
 return cached;
}

export function surfaceRect(role,identification=false){
 const [x,y,w,h]=tiles[role];
 if(['blue','red','neutral'].includes(role))return identification?[x+8,y+8,w-16,h*.45]:[x+8,y+h*.52,w-16,h*.46-8];
 return [x+8,y+8,w-16,h-16];
}

export function mapSurfaceUV(geometry,role,identification=false){
 if(!geometry.attributes.uv){
  // Several hand-refined metal inserts were supplied without UVs. Give every
  // triangle a stable box projection while retaining its authored vertices.
  if(geometry.index)geometry=geometry.toNonIndexed();
  geometry.computeBoundingBox();const p=geometry.attributes.position,b=geometry.boundingBox,size=b.getSize(new T.Vector3()),data=new Float32Array(p.count*2),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),normal=new T.Vector3();
  for(let i=0;i<p.count;i+=3){
   a.fromBufferAttribute(p,i);c.fromBufferAttribute(p,i+1);d.fromBufferAttribute(p,i+2);normal.crossVectors(c.sub(a),d.sub(a));
   const axes=Math.abs(normal.y)>Math.abs(normal.x)&&Math.abs(normal.y)>Math.abs(normal.z)?[0,2]:Math.abs(normal.x)>Math.abs(normal.z)?[2,1]:[0,1];
   for(let j=0;j<3;j++)for(let k=0;k<2;k++){const axis=axes[k];data[(i+j)*2+k]=(p.getComponent(i+j,axis)-b.min.getComponent(axis))/(size.getComponent(axis)||1);}
  }
  geometry.setAttribute('uv',new T.BufferAttribute(data,2));
 }
 const uv=geometry.attributes.uv;
 const [x,y,w,h]=surfaceRect(role,identification);
 for(let i=0;i<uv.count;i++){
  // UVs in the imported source may extend a few ulps past their tile.
  const u=T.MathUtils.clamp(uv.getX(i),0,1),v=T.MathUtils.clamp(uv.getY(i),0,1);
  uv.setXY(i,(x+u*w)/SIZE,1-(y+(1-v)*h)/SIZE);
 }
 uv.needsUpdate=true;
 // AO uses the same explicitly authored UVs, including imported source meshes.
 // glTF permits occlusion and metallic/roughness to share TEXCOORD_0. Avoid
 // duplicating a second UV buffer on every imported and procedural mesh.
 geometry.deleteAttribute('uv1');
 return geometry;
}

export function applyBuildingPBR(model,kind,team){
 const textures=buildingSurfaces(),pool=new Map(),identity=team===-1?'neutral':team===1?'red':'blue';let count=0;
 function finish(original,role,identification=false){
  const key=[original.name,role,original.side,identification].join(':');if(pool.has(key))return pool.get(key);
  const m=original.clone();
  for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])m[key]=null;
  if(role==='light'){
   m.color.set(team===-1?'#ffffff':team===1?'#ff5142':'#37c8ff');m.emissive.copy(m.color);m.emissiveIntensity=.48;
  }else{
   m.color.set('#ffffff');m.map=textures.map;m.normalMap=textures.normalMap;m.normalScale.setScalar(role==='glass'?.12:.55);
   m.roughnessMap=m.metalnessMap=m.aoMap=textures.orm;m.roughness=m.metalness=1;m.aoMapIntensity=.65;m.bumpScale=0;
   m.emissive.set('#000000');m.transparent=false;m.opacity=1;
   if(role==='steel'&&/bronze|brass|champagne|trim|edge/i.test(m.name))m.color.set('#b1aa95');
  }
  m.userData={...m.userData,atlasSurface:role,surfaceRevision:SURFACE_REVISION};m.needsUpdate=true;pool.set(key,m);return m;
 }
 model.traverse(n=>{
  if(!n.isMesh)return;
  if(!n.geometry.attributes.normal){n.geometry=n.geometry.clone();n.geometry.computeVertexNormals();}
  const old=Array.isArray(n.material)?n.material:[n.material];
  // Imported assemblies use one material per mesh. Preserve all named meshes,
  // authored rest poses, normals and original triangles while repacking UVs.
  const roles=old.map(m=>{
   if(n.userData.surface)return n.userData.surface==='identity'?identity:n.userData.surface;
   const name=m.name.toLowerCase();
   if(/runway concrete/.test(name))return 'concrete';
   if(/runway asphalt|hangar opening/.test(name))return 'rubber';
   if(/runway markings/.test(name))return 'neutral';
   if(/runway safety yellow/.test(name))return 'hazard';
   if(/emission|light|glow/.test(name))return 'light';
   if(/glass|optic/.test(name))return 'glass';
   if(/seal|rubber/.test(name))return 'rubber';
   if(/faction enamel/.test(name))return /RoofCeramic|AirlockArmour|RoofFactionPanel/.test(n.name)?'camo':identity;
   if(/sand|ceramic|armour|armor/.test(name))return /Hull|Roof|Armour|CeramicFoundation|CornerCeramic|Refined|BaseShell|MainBody|Wall|Foundation/.test(n.name)?'camo':'sand';
   if(/caution|insignia/.test(name))return 'hazard';
   return 'steel';
  });
  if(new Set(roles).size>1)throw Error('Split multi-surface building primitives before atlas mapping: '+n.name);
  n.material=Array.isArray(n.material)?old.map((m,i)=>finish(m,roles[i],n.userData.identification)):finish(old[0],roles[0],n.userData.identification);
  if(roles[0]!=='light'){
   n.geometry=mapSurfaceUV(n.geometry.clone(),roles[0],n.userData.identification);count++;
  }
 });
 const d=model.userData.atlasDesign;d.surfaceRevision=SURFACE_REVISION;d.finish='Desert CARC camouflage / sand paint / worn steel / packed ORM / tangent normals';
 model.userData.fieldFinish={revision:SURFACE_REVISION,kind,texturedMeshes:count,atlasSize:SIZE,embeddedMaps:['baseColor','normal','occlusionRoughnessMetallic']};
 return textures;
}
