/** Offline material authoring only. Keeps every mesh, UV and transform intact. */
import * as T from 'three';
import {surfaceRect} from './building-pbr.js';
export const PROP_SURFACE_REVISION=2;
const cache=new Map();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const noise=(x,y,seed=31)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1597334677);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
function smooth(x,y,seed=31){const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,u=a*a*(3-2*a),v=b*b*(3-2*b);return lerp(lerp(noise(ix,iy,seed),noise(ix+1,iy,seed),u),lerp(noise(ix,iy+1,seed),noise(ix+1,iy+1,seed),u),v);}
const fbm=(x,y,seed)=>smooth(x,y,seed)*.62+smooth(x*2.13,y*2.13,seed+19)*.27+smooth(x*4.37,y*4.37,seed+37)*.11;
const blend=(color,target,t)=>color.map((v,k)=>lerp(v,target[k],clamp(t)));
const organicRoles=['bone','bark','leaf','dry','cloth'];

/** Correlated albedo, surface height and packed physical response. Broad wear
 * survives the 20–40px game size; pores, scratches and weave remain in masters. */
export function propSurfaceMaps(role,variant='standard'){
 if(role!=='sand'&&variant!=='ground')variant='standard';
 const key=role+':'+variant;if(cache.has(key))return cache.get(key);
 const size=role==='leaf'||role==='dry'?512:1024;
 const canvases=Array.from({length:3},()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;});
 const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size)),height=new Float32Array(size*size);
 const hard=!organicRoles.includes(role),metal=role==='steel',paint=role==='sand'||role==='camo';
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),i=(y*size+x)*4;
  const fine=noise(x,y),cloud=fbm(u*5,v*5,113),mottle=fbm(u*19,v*19,227),micro=noise(x,y,919);
  let color=[145,130,97],h=0,ao=1,rough=.85,metallic=0;
  if(hard){
   const colors={sand:[146,132,99],camo:[147,137,101],steel:[81,89,84],concrete:[131,120,98],rubber:[31,36,32],glass:[30,49,48],neutral:[174,168,142]};
   color=colors[role]??colors.sand;
   if(variant==='service'&&role==='sand')color=[129,135,111];
   if(role==='camo'||variant==='crate'&&role==='sand'){
    const warp=smooth(u*5,v*5,97),patch=fbm(u*6+warp*1.8,v*4.5-warp,631);
    color=blend([161,145,105],[103,99,70],clamp((patch-.38)*20));
    color=blend(color,[66,81,58],clamp((patch-.54)*25));
   }
   const edge=Math.min(u,1-u,v,1-v),rim=clamp((.029-edge)*55),edgeChips=clamp((fbm(u*85,v*85,17)+rim*.66-.88)*6);
   const joint=Math.exp(-(((edge-.041)/.003)**2)),weld=paint?Math.exp(-(((u-.043)/.002)**2))*(.6+.4*Math.sin(v*350)):0;
   const dust=clamp(v*v*v*(.19+.25*cloud)+(cloud-.50)*.65+(variant==='ground'?.32:0));
   color=color.map(c=>c+(cloud-.5)*26+(mottle-.5)*12+(fine-.5)*8);
   if(metal){
    color=color.map(c=>c+(noise(x,Math.floor(y/5),719)-.5)*10);
    h=(fine-.5)*.035+(noise(x,Math.floor(y/3),371)-.5)*.025;rough=.46+(cloud-.5)*.20;metallic=.83;
    const oxide=clamp((fbm(u*11,v*17,711)-.54)*3)*(.30+v*.5);
    color=blend(color,[112,79,45],oxide*.5);rough+=oxide*.35;metallic*=1-oxide*.65;
   }else if(paint){h=(fine-.5)*.06-joint*.15+weld*.08;rough=.69+(mottle-.5)*.18;metallic=.07;}
   else if(role==='concrete'){h=(fine-.5)*.18-(micro>.985?.35:0);rough=.84+mottle*.14;ao-=micro>.985?.2:0;}
   else if(role==='rubber'){h=(fine-.5)*.04;rough=.84+mottle*.14;}
   else if(role==='glass'){h=0;rough=.23+cloud*.12;metallic=.12;}
   else{h=(fine-.5)*.04;rough=.79;}
   if(paint||metal){
    color=blend(color,[108,109,96],edgeChips);h-=edgeChips*.17;rough=lerp(rough,.43,edgeChips);metallic=lerp(metallic,.78,edgeChips);
    color=blend(color,[61,59,46],joint*.26);ao-=joint*.20;
   }
   // Collected dust has its own dielectric, rough response over exposed metal.
   color=blend(color,[174,150,111],dust*.78);rough=lerp(rough,.94,dust);metallic*=1-dust*.85;h+=dust*.04;
   ao-=joint*.08;
   if(role==='sand'&&variant==='service'){
    const drip=clamp((smooth(u*26,0,173)-.54)*4)*v*v*.27;
    color=blend(color,[66,72,53],drip);rough-=drip*.16;
   }
  }else if(role==='bone'){
   const stains=clamp((cloud-.43)*2.0),pore=clamp((micro-.94)*17)*(noise(Math.floor(x/3),Math.floor(y/3),778)>.35?1:.25);
   const cx=u*9+smooth(u*9,v*7,94)*.35,cy=v*9;
   const crack=Math.exp(-Math.abs(Math.sin(cx*3.14159+Math.sin(cy*1.7)*.35))*155)*clamp((smooth(u*12,v*10,711)-.42)*4);
   color=blend([198,191,168],[124,106,76],stains*.78);
   color=color.map(c=>c+(fine-.5)*12+(mottle-.5)*12);
   color=blend(color,[91,78,56],crack*.72+pore*.25);
   h=(fine-.5)*.045-pore*.22-crack*.23+(mottle-.5)*.08;
   ao=1-pore*.27-crack*.35;rough=.84+stains*.10+(fine-.5)*.10;
   // Brown mineral deposits around shallow pits stay softer than the fracture.
   color=blend(color,[168,143,101],pore*stains*.30);
  }else if(role==='bark'){
   const column=Math.floor(u*16),fiber=Math.sin(u*520+smooth(u*8,v*9,51)*8);
   const scar=Math.abs(Math.sin(v*26*3.14159+Math.sin(u*16*3.14159)*.70));
   const fissure=Math.exp(-Math.abs(Math.sin(u*16*3.14159+smooth(u*7,v*19,41)*.32))*24);
   const groove=clamp((.20-scar)*7),age=noise(column,Math.floor(v*28),91);
   color=blend([84,69,45],[142,119,78],cloud*.75+age*.17);
   color=color.map(c=>c+fiber*3+(fine-.5)*9);
   color=blend(color,[48,41,28],fissure*.68+groove*.31);
   color=blend(color,[171,143,96],clamp((scar-.87)*4)*.34);
   h=fiber*.018-fissure*.27-groove*.18+(mottle-.5)*.10;
   ao=1-fissure*.27-groove*.16;rough=.88+age*.10;
  }else if(role==='leaf'||role==='dry'){
   const dry=role==='dry',midrib=Math.exp(-(((v-.5)/.032)**2)),veins=Math.cos(v*95+u*12);
   const tip=clamp((u-.72)*3.5),streak=smooth(u*2,v*24,77),age=smooth(u*4,v*8,35);
   color=dry?blend([118,97,53],[165,140,84],age):blend([43,67,31],[91,105,48],age);
   color=blend(color,dry?[93,74,40]:[145,125,65],tip*(dry?.4:.48));
   color=color.map(c=>c+(streak-.5)*15+veins*2.3+(fine-.5)*4);
   color=blend(color,dry?[176,150,93]:[123,134,66],midrib*.35);
   h=midrib*.15+veins*.016+(fine-.5)*.015;
   rough=dry?.82+streak*.12+fine*.04:.56+streak*.17;ao=.96+streak*.04;
  }else if(role==='cloth'){
   const warp=Math.sin(u*size*.55),weft=Math.sin(v*size*.55),thread=warp*weft;
   const fold=Math.sin(u*17+Math.sin(v*12)*1.9)*Math.sin(v*14),grime=clamp((cloud-.45)*2.4);
   color=blend([146,127,88],[82,74,50],grime*.74);
   color=color.map(c=>c+thread*4+fold*8+(fine-.5)*8);
   h=thread*.085+fold*.055+(fine-.5)*.025;rough=.91+fine*.08;ao=1-grime*.12-clamp(-fold)*.12;
  }
  for(let k=0;k<3;k++)images[0].data[i+k]=clamp(color[k],0,255);
  images[0].data[i+3]=255;images[2].data.set([clamp(ao)*255,clamp(rough)*255,clamp(metallic)*255,255],i);height[y*size+x]=h;
 }
 // Sparse directional scratches are cut into the same height/ORM pixels as
 // the exposed paint. Wear clusters at edges; broad camouflage stays readable.
 if(paint||metal)for(let n=0;n<(metal?200:130);n++){
  const sx=Math.floor(noise(n,1,51)*(size-1)),sy=Math.floor(noise(n,2,51)*(size-1));
  const length=3+Math.floor(noise(n,3,51)*size*.045),slope=(noise(n,4,51)-.5)*.6;
  for(let j=0;j<length;j++){
   const x=sx+j,y=Math.round(sy+j*slope);if(x>=size||y>=size||y<0)continue;
   const i=(y*size+x)*4,opacity=.25+noise(n,j,87)*.25;
   for(let k=0;k<3;k++)images[0].data[i+k]=lerp(images[0].data[i+k],[102,105,94][k],opacity);
   images[2].data[i]=190;images[2].data[i+1]=135;images[2].data[i+2]=175;height[y*size+x]-=.15;
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(y*size+x)*4,sample=(a,b)=>height[clamp(b,0,size-1)*size+clamp(a,0,size-1)];
  const dx=(sample(x-1,y)-sample(x+1,y))*2.7,dy=(sample(x,y-1)-sample(x,y+1))*2.7,len=Math.hypot(dx,dy,1);
  images[1].data.set([(dx/len*.5+.5)*255,(-dy/len*.5+.5)*255,(1/len*.5+.5)*255,255],at);
 }
 const textures=canvases.map((c,i)=>{
  contexts[i].putImageData(images[i],0,0);const t=new T.CanvasTexture(c);t.name='Sandforge prop r2 '+key+' '+['albedo','tangent normal','occlusion roughness metallic'][i];t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;return t;
 });
 const maps={map:textures[0],normalMap:textures[1],orm:textures[2]};cache.set(key,maps);return maps;
}

export function applyPropPBR(model,kind){
 let meshIndex=0;const materials=new Map();
 model.traverse(n=>{
  if(!n.isMesh)return;
  const role=n.userData.propSurface,index=meshIndex++,name=n.name;
  if(!role)throw Error('Missing prop surface: '+name);
  const ground=/base flange|mast socket|footing|bearer|root flare/i.test(name);
  const variant=ground?'ground':kind.startsWith('military-crate')&&!/pallet slat/i.test(name)?'crate':kind==='service-terminal'?'service':'standard';
  const surface=role==='dry'&&kind==='palm-tree'&&/scar/.test(name)?'bark':role==='dry'&&kind==='sandbags'?'cloth':role;
  let uvBounds;
  if(organicRoles.includes(role)){
   const uv=n.geometry.attributes.uv;let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
   for(let i=0;i<uv.count;i++){u0=Math.min(u0,uv.getX(i));u1=Math.max(u1,uv.getX(i));v0=Math.min(v0,uv.getY(i));v1=Math.max(v1,uv.getY(i));}
   uvBounds=[u0,v0,Math.max(.001,u1-u0),Math.max(.001,v1-v0)];
  }else if(role!=='light'){
   const [x,y,w,h]=surfaceRect(role);uvBounds=[x/2048,1-(y+h)/2048,w/2048,h/2048];
  }
  const tint=surface==='leaf'?index%4:surface==='cloth'?index%3:0,key=[role,surface,variant,tint,uvBounds?.join(',')].join(':');
  if(materials.has(key)){n.material=materials.get(key);return;}
  const m=new T.MeshStandardMaterial({name:'Sandforge r2 '+surface+' '+variant,side:n.material.side});
  if(role==='light'){m.color.set('#d7d4ba');m.emissive.set('#cbbc8c');m.emissiveIntensity=.24;m.roughness=.45;}
  else{
   const source=propSurfaceMaps(surface,variant);
   const texture=t=>{const out=t.clone();out.repeat.set(1/uvBounds[2],1/uvBounds[3]);out.offset.set(-uvBounds[0]/uvBounds[2],-uvBounds[1]/uvBounds[3]);out.updateMatrix();return out;};
   m.map=texture(source.map);m.normalMap=texture(source.normalMap);const orm=texture(source.orm);
   m.aoMap=m.roughnessMap=m.metalnessMap=orm;m.roughness=m.metalness=1;m.aoMapIntensity=.65;
   m.normalScale.setScalar(surface==='bone'?.65:surface==='bark'?.8:surface==='cloth'?.65:surface==='leaf'?.35:.5);
   if(surface==='leaf')m.color.set(['#ffffff','#d4dec0','#b2c59a','#ded7b2'][tint]);
   if(surface==='cloth')m.color.set(['#ffffff','#e6dcc6','#cfbf9c'][tint]);
   if(role==='dry'&&kind==='desert-skull')m.color.set('#9b9279');
  }
  m.userData={propSurfaceRevision:PROP_SURFACE_REVISION,surface,variant};n.material=m;materials.set(key,m);
 });
 model.userData.propPack.surfaceRevision=PROP_SURFACE_REVISION;
 return model;
}
