import * as THREE from 'three';

/** User-approved desert 002 reference, cropped to remove the caption.
 * One real shared albedo for all desert buildings and soldier cloth;
 * doors, glass, metal roofs, weapons, skin and terrain retain their own art.
 * This lives in the repository, not in the browser's cache or user's Downloads.
 */
export const DESERT_002_TEXTURE_URL='/src/assets/reborn/textures/desert-002-master.webp';
export const DESERT_002_TEXTURE_REVISION='desert-002-main-20261114';
let shared=null;
export function desert002Texture(){
 if(shared)return shared;
 shared=typeof document==='undefined'?new THREE.Texture():
  new THREE.TextureLoader().load(DESERT_002_TEXTURE_URL);
 shared.name='Sandforge_Desert002_MainCamouflage';
 shared.colorSpace=THREE.SRGBColorSpace;
 shared.wrapS=shared.wrapT=THREE.RepeatWrapping;
 shared.flipY=false;
 shared.anisotropy=4;
 return shared;
}
