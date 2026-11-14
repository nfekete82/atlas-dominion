import * as THREE from 'three';

/**
 * GLB fidelity path. A Meshy asset arrives with its own PBR material graph.
 * Never replace its base-colour map, normal map or metal/roughness data with
 * a second world-space camouflage shader. This also supports a developer
 * override (?glbMaterials=original) for any authored GLB.
 */
export const GLB_QUALITY_REVISION='glb-fidelity-pbr-20261114';
export function shouldPreserveAuthoredGLB(url,query=''){
 const params=new URLSearchParams(query);
 if(params.get('glbMaterials')==='sandforge')return false;
 return params.get('glbMaterials')==='original'||
  (typeof url==='string'&&url.startsWith('/src/assets/meshy/'));
}

const TEXTURE_SLOTS=['map','normalMap','roughnessMap','metalnessMap','aoMap',
 'emissiveMap','alphaMap','bumpMap','clearcoatMap','clearcoatNormalMap',
 'clearcoatRoughnessMap','sheenColorMap','sheenRoughnessMap','transmissionMap'];
export function protectAuthoredGlbMaterials(root,{maxAnisotropy=8}={}){
 if(!root?.traverse)return {meshes:0,materials:0,textures:0,triangles:0};
 const max=Math.max(1,Math.min(8,Math.floor(Number(maxAnisotropy)||1)));
 const owned=new Map(),textures=new Set();
 let meshes=0,triangles=0;
 const protect=source=>{
  if(!source?.isMaterial)return source;
  if(owned.has(source))return owned.get(source);
  const material=source.clone();
  material.userData={...material.userData,sandforgePreserveAuthoredMaterials:true};
  // GLTFLoader already assigns the correct colour spaces and UV transforms.
  // Only improve oblique RTS texture sampling; do not change texture pixels.
  for(const slot of TEXTURE_SLOTS){
   const texture=material[slot];
   if(!texture?.isTexture)continue;
   textures.add(texture);
   if(max>texture.anisotropy){texture.anisotropy=max;texture.needsUpdate=true;}
  }
  owned.set(source,material);
  return material;
 };
 root.traverse(node=>{
  if(!node.isMesh)return;
  meshes++;
  const position=node.geometry?.getAttribute('position');
  const index=node.geometry?.index;
  triangles+=index?Math.floor(index.count/3):position?Math.floor(position.count/3):0;
  node.material=Array.isArray(node.material)?node.material.map(protect):protect(node.material);
  node.userData={...node.userData,sandforgePreserveAuthoredMaterials:true};
 });
 root.userData={...root.userData,sandforgePreserveAuthoredMaterials:true};
 return {meshes,materials:owned.size,textures:textures.size,triangles};
}
export function glbMaterialAudit(root){
 const materials=new Set(),textures=new Set();
 let meshes=0,triangles=0;
 root?.traverse?.(node=>{
  if(!node.isMesh)return;
  meshes++;
  const position=node.geometry?.getAttribute('position'),index=node.geometry?.index;
  triangles+=index?Math.floor(index.count/3):position?Math.floor(position.count/3):0;
  for(const m of Array.isArray(node.material)?node.material:[node.material]){
   if(!m)continue;materials.add(m);
   for(const key of TEXTURE_SLOTS)if(m[key]?.isTexture)textures.add(m[key]);
  }
 });
 return {meshes,materials:materials.size,textures:textures.size,triangles};
}

const auditEntries=new Map();
export function glbAuditEntries(){return [...auditEntries.values()].map(item=>({...item}));}
export function recordGlbAsset(entry,{kind,owner,requested,actual,model,error=null,preserved=false}){
 // Traversing every soldier's mesh tree during large battles is expensive.
 // Detailed mesh statistics are computed only in explicit QA mode (or Node tests).
 const detailed=typeof window==='undefined'||
  (typeof location!=='undefined'&&new URLSearchParams(location.search).get('glbAudit')==='1');
 const audit=model&&detailed?glbMaterialAudit(model):
  {meshes:0,materials:0,textures:0,triangles:0};
 const info={kind,owner,requested,actual:actual??null,preserved,fallback:Boolean(actual&&actual!==requested),
  error:error?String(error):null,...audit};
 if(entry)entry.loadedGlb=info;
 auditEntries.set(kind+':'+owner+':'+(actual??requested),info);
 if(typeof window==='undefined'||typeof document==='undefined')return info;
 window.__sandforgeGLBAudit={get entries(){return glbAuditEntries();},revision:GLB_QUALITY_REVISION};
 if(new URLSearchParams(location.search).get('glbAudit')!=='1')return info;
 let panel=document.getElementById('sf-glb-audit');
 if(!panel){
  panel=document.createElement('aside');
  panel.id='sf-glb-audit';
  panel.setAttribute('aria-label','GLB-Modellprüfung');
  Object.assign(panel.style,{position:'fixed',top:'75px',right:'12px',zIndex:'65',
   width:'min(430px,45vw)',maxHeight:'45vh',overflow:'auto',
   background:'rgba(13,21,24,.96)',border:'1px solid #b59a62',
   borderRadius:'8px',padding:'11px',color:'#e8dfc9',font:'12px system-ui',
   boxShadow:'0 8px 32px #0009'});
  document.body.append(panel);
 }
 panel.replaceChildren();
 const heading=document.createElement('strong');
 heading.textContent='GLB-Audit · tatsächlich geladene Dateien';
 panel.append(heading);
 for(const item of glbAuditEntries().slice(-18)){
  const line=document.createElement('p');
  line.style.cssText='border-top:1px solid #ffffff26;padding-top:7px;overflow-wrap:anywhere';
  const label=document.createElement('span');
  label.textContent=item.kind+' / '+(item.owner===0?'Blau':'Rot')+' · '+(item.error?'FEHLER':item.fallback?'FALLBACK':item.preserved?'Original-PBR':'Sandforge-Finish')+' · '+item.triangles.toLocaleString('de-DE')+' Tris · '+item.textures+' Texturen';
  line.append(label,document.createElement('br'));
  const link=document.createElement('a');
  const href=new URL('/glb-quality.html',location.origin);
  const path=item.actual??item.requested;
  href.searchParams.set('asset',path);
  href.searchParams.set('kind',item.kind);
  link.href=href.pathname+href.search;link.textContent=path;
  link.style.color='#abd8eb';link.target='_blank';link.rel='noopener';
  line.append(link);
  if(item.error){const e=document.createElement('small');e.textContent=' '+item.error;line.append(e);}
  panel.append(line);
 }
 return info;
}
