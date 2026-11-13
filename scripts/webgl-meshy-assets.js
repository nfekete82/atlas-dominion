/**
 * Optional user-supplied Meshy assets — intentionally opt-in until the model
 * bundle is installed locally and visual QA is complete.
 *
 * ?models=meshy         => authored HQ / tank plus available artillery
 * ?meshyStaticSoldier=1 => explicitly opt into an UNRIGGED infantry model;
 *                         keep the existing playable infantry animations by
 *                         default rather than silently losing them.
 *
 * These assets are *not* vendored here: original Meshy uploads can be large.
 * Run scripts/install-meshy-assets.mjs on the locally downloaded pack.
 */
// Exact, user-uploaded static Feldkommando mesh (not the older stylized HQ3).
// Its GLB binary is distributed separately and SHA-256 checked on install.
export const SANDFORGE_DEFAULT_FELDKOMMANDO_URL=
 '/src/assets/reborn/buildings-3d/sandforge_feldkommando_meshy.glb';
export const isDefaultFeldkommandoAsset=url=>url===SANDFORGE_DEFAULT_FELDKOMMANDO_URL;
export const MESHY_ASSET_KINDS=Object.freeze(['headquarters','tank','artillery','rocket','infantry']);
export const isMeshyAsset=url=>typeof url==='string'&&url.startsWith('/src/assets/meshy/');
export function meshyEnabled(query=typeof location==='undefined'?'':location.search){
 const params=new URLSearchParams(query);
 return params.get('models')==='meshy'||params.get('meshy')==='1';
}
export function meshyAsset(kind,owner=0,query=typeof location==='undefined'?'':location.search){
 if(!meshyEnabled(query)||!MESHY_ASSET_KINDS.includes(kind))return null;
 const params=new URLSearchParams(query);
 // Preserve the real rigged soldier and Rocket Infantry until user-supplied
 // Meshy models have a skeleton and animations. Static preview is optional.
 if((kind==='infantry'||kind==='rocket')&&params.get('meshyStaticSoldier')!=='1')return null;
 return '/src/assets/meshy/'+kind+'.glb';
}
export const meshyModelYaw=kind=>kind==='tank'?Math.PI/2:0;
