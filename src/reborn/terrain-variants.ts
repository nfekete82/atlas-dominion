/**
 * Four deterministic silhouettes per authored PNG. Build once when a map loads:
 * no extra downloads, no runtime per-frame texture processing and no save changes.
 */
export type TerrainSpriteKind='palm'|'rocks'|'crater';
export type TerrainVariantAtlases=Record<TerrainSpriteKind,readonly HTMLCanvasElement[]>;
export const TERRAIN_VARIANT_COUNT=4;

export function terrainVariantIndex(value:number):number {
  return Math.max(0,Math.min(TERRAIN_VARIANT_COUNT-1,Math.floor(Math.max(0,Number.isFinite(value)?value:0)*TERRAIN_VARIANT_COUNT)));
}

interface Treatment {angle:number;sx:number;sy:number;shear:number;hue:number;saturation:number;brightness:number}
const PRESETS:Record<TerrainSpriteKind,readonly Treatment[]>={
  palm:[
    {angle:0,sx:1,sy:1,shear:0,hue:0,saturation:1,brightness:1},
    {angle:-.11,sx:.79,sy:1.09,shear:-.08,hue:11,saturation:.87,brightness:1.03},
    {angle:.10,sx:1.17,sy:.91,shear:.09,hue:-14,saturation:1.10,brightness:.95},
    {angle:-.06,sx:.92,sy:1.04,shear:.13,hue:20,saturation:.78,brightness:.93}
  ],
  rocks:[
    {angle:0,sx:1,sy:1,shear:0,hue:0,saturation:1,brightness:1},
    {angle:-.13,sx:.81,sy:1.08,shear:.06,hue:-4,saturation:.93,brightness:.97},
    {angle:.16,sx:1.15,sy:.79,shear:-.08,hue:5,saturation:1.08,brightness:1.03},
    {angle:-.07,sx:.90,sy:.95,shear:.15,hue:-8,saturation:.87,brightness:.94}
  ],
  crater:[
    {angle:0,sx:1,sy:1,shear:0,hue:0,saturation:1,brightness:1},
    {angle:.10,sx:1.13,sy:.85,shear:.05,hue:-3,saturation:.94,brightness:.94},
    {angle:-.16,sx:.84,sy:1.09,shear:-.07,hue:5,saturation:1.08,brightness:1.01},
    {angle:.07,sx:1.06,sy:.94,shear:.10,hue:-5,saturation:.87,brightness:.97}
  ]
};

function canvas(size:number):HTMLCanvasElement {
  const result=document.createElement('canvas');
  result.width=result.height=size;
  return result;
}
function treatmentFilter(t:Treatment):string {
  return 'hue-rotate('+t.hue+'deg) saturate('+t.saturation+') brightness('+t.brightness+')';
}

/** Palm crown gets its own geometric silhouette while the trunk foot and
 * sun-facing ground shadow retain their fixed placement and light direction. */
function palmVariant(source:HTMLImageElement,size:number,t:Treatment,index:number):HTMLCanvasElement {
  const output=canvas(size),c=output.getContext('2d')!;
  c.drawImage(source,0,0,size,size);
  if(index===0)return output;

  const crown=canvas(size),cc=crown.getContext('2d')!;
  cc.translate(size*.48,size*.33);
  cc.rotate(t.angle);
  cc.transform(t.sx,0,t.shear,t.sy,0,0);
  cc.filter=treatmentFilter(t);
  cc.drawImage(source,-size*.48,-size*.33,size,size);
  cc.filter='none';
  const fade=cc.createLinearGradient(0,0,0,size*.68);
  fade.addColorStop(0,'#000');
  fade.addColorStop(.76,'#000');
  fade.addColorStop(1,'#0000');
  cc.setTransform(1,0,0,1,0,0);
  cc.globalCompositeOperation='destination-in';
  cc.fillStyle=fade;cc.fillRect(0,0,size,size);
  cc.globalCompositeOperation='source-over';

  // Remove the original canopy using the same alpha ramp as the new one:
  // the preserved trunk and its original shadow still blend without a seam.
  c.save();
  c.globalCompositeOperation='destination-out';
  c.fillStyle=fade;c.fillRect(0,0,size,size);
  c.restore();
  c.drawImage(crown,0,0);
  return output;
}
function earthVariant(source:HTMLImageElement,size:number,t:Treatment,index:number):HTMLCanvasElement {
  const output=canvas(size),c=output.getContext('2d')!;
  if(index===0){c.drawImage(source,0,0,size,size);return output;}
  c.translate(size/2,size/2);
  c.rotate(t.angle);
  c.transform(t.sx,0,t.shear,t.sy,0,0);
  c.filter=treatmentFilter(t);
  c.drawImage(source,-size/2,-size/2,size,size);
  c.filter='none';
  return output;
}

/** Keep the original high-resolution PNG files, but sample them into modest
 * pre-baked 640px variants (sufficient for in-game zoom). */
export function buildTerrainVariants(sources:Record<TerrainSpriteKind,HTMLImageElement>):TerrainVariantAtlases {
  const size=640;
  const result={} as Record<TerrainSpriteKind,HTMLCanvasElement[]>;
  for(const kind of ['palm','rocks','crater'] as const){
    if(!sources[kind].complete||sources[kind].naturalWidth===0)throw new Error('Terrain image not loaded: '+kind);
    result[kind]=PRESETS[kind].map((t,i)=>kind==='palm'?palmVariant(sources[kind],size,t,i):earthVariant(sources[kind],size,t,i));
  }
  return result;
}
