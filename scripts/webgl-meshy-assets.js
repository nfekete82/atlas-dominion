/**
 * Owner-selected Meshy HQ: default Feldkommando visual with an HQ3 fallback.
 * bundle is installed locally and visual QA is complete.
 *
 * ?models=meshy         => optional tank / artillery (HQ is default)
 * ?meshyStaticSoldier=1 => explicitly opt into an UNRIGGED infantry model;
 *                         keep the existing playable infantry animations by
 *                         default rather than silently losing them.
 *
 * These assets are *not* vendored here: original Meshy uploads can be large.
 * Run scripts/install-meshy-assets.mjs on the locally downloaded pack.
 */
export const MESHY_ASSET_KINDS=Object.freeze(['headquarters','tank','artillery','rocket','infantry']);
export const isMeshyAsset=url=>typeof url==='string'&&url.startsWith('/src/assets/meshy/');
export function meshyEnabled(query=typeof location==='undefined'?'':location.search){
 const params=new URLSearchParams(query);
 return params.get('models')==='meshy'||params.get('meshy')==='1';
}
export function meshyAsset(kind,owner=0,query=typeof location==='undefined'?'':location.search){
 if(!MESHY_ASSET_KINDS.includes(kind))return null;
 const params=new URLSearchParams(query);
 // User-approved Military HQ is default. ?hq=hq3 restores authored original.
 if(kind==='headquarters'){
  if(['hq3','original','stylized'].includes(params.get('hq'))||
     params.get('meshyHQ')==='0')return null;
  return '/src/assets/meshy/headquarters.glb';
 }
 if(!meshyEnabled(query))return null;
 // Preserve the real rigged soldier and Rocket Infantry until user-supplied
 // Meshy models have a skeleton and animations. Static preview is optional.
 if((kind==='infantry'||kind==='rocket')&&params.get('meshyStaticSoldier')!=='1')return null;
 return '/src/assets/meshy/'+kind+'.glb';
}
export const meshyModelYaw=kind=>kind==='tank'?Math.PI/2:0;
