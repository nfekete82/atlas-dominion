import * as THREE from 'three';
import {tintStylizedTeam} from './webgl-stylized-pack.js';
import {applyBuildingDesign} from './webgl-building-design.js';
import {desert002Texture} from './webgl-desert002.js';

/** Painted ownership belongs INSIDE the authored PBR surfaces.
 * No floating blue cubes, box geometry or extra draw calls.
 * The original texture/albedo remains intact; only the material's
 * multiplicative base-color tint shifts slightly toward the team color.
 */
export const FACTION_COLORS=Object.freeze({0:'#347c9c',1:'#af5449'});
const team={0:new THREE.Color(FACTION_COLORS[0]),1:new THREE.Color(FACTION_COLORS[1])};

/** Shared sand / khaki / olive military finish for every building, whether
 * it comes from an authored GLB or a procedural strategic facility.
 * World-positioned camouflage patches retain roughness, normals, shadows
 * and the original scratches. No extra per-frame geometry or draw calls.
 */
export const DESERT_BUILDING_PALETTE=Object.freeze({
 sand:'#cbb68a',khaki:'#99946e',olive:'#747958',metal:'#61665d'
});
// These three stylized uniforms follow the player's reference photos:
// winter greys/white, sandy khaki desert, and olive forest/jungle.
// This is render-only: weapons, collision, factions and navigation stay intact.
export const CAMOUFLAGE_PALETTES=Object.freeze({
 desert:Object.freeze({name:'Sand/Khaki',base:'#c7b089',middle:'#ab9872',dark:'#6f755d',
  rgb:['.78,.69,.54','.63,.56,.42','.39,.44,.34']}),
 snow:Object.freeze({name:'Winter White/Grey',base:'#e1e5e4',middle:'#a8b1b6',dark:'#616d75',
  rgb:['.90,.92,.92','.66,.71,.73','.36,.43,.46']}),
 jungle:Object.freeze({name:'Olive/Forest',base:'#87936e',middle:'#526b45',dark:'#2e4936',
  rgb:['.53,.58,.41','.32,.43,.29','.18,.31,.22']})
});
// The HQ3's baked desert texture is the visual reference. All other facility
// materials follow this dark sand/khaki/olive palette without modifying their
// authored geometry, windows, doors, beacons or original UV detail.
export const HQ3_MATCHED_DESERT_PALETTE=Object.freeze({
 wall:Object.freeze(['.57,.52,.40','.39,.42,.32','.20,.27,.22']),
 roof:Object.freeze(['.24,.27,.24','.21,.24,.21','.13,.17,.15'])
});
// Human-scale camouflage needs substantially more contrast and sharper, larger
// olive/khaki patches than the earlier near-grey uniform. It is derived from
// the HQ3's dark painted wall tones, not the charcoal roof coating.
export const SOLDIER_HQ3_DESERT_PALETTE=Object.freeze({
 rgb:Object.freeze(['.72,.63,.47','.38,.43,.29','.19,.27,.18'])
});
// The Kaserne's steep roof uses deeper charcoal than the generic military
// facility palette. Linear RGB values retain individual panel shading.
export const BARRACKS_HQ3_CHARCOAL_ROOF=Object.freeze([
 '.088,.093,.083','.064,.069,.062','.040,.046,.043'
]);
export const DESERT_FINISH_REVISION='biome-camouflage-hq3-charcoal-barracks-v12-20261113';
const SOLDIER_KINDS=new Set(['infantry','medic','engineer','heavy','rocket']);
let selectedCamouflageBiome='desert';
export function setWorldCamouflageBiome(value){
 selectedCamouflageBiome=Object.hasOwn(CAMOUFLAGE_PALETTES,value)?value:'desert';
 return selectedCamouflageBiome;
}
export const worldCamouflageBiome=()=>selectedCamouflageBiome;
function applyDesertBuildingCamo(material,style='standard'){
 const biome=selectedCamouflageBiome;
 const soldier=style==='soldier';
 const matchedDesert=biome==='desert'&&
  (style==='barracks'||style==='bastion'||style==='facility'||soldier);
 // Building roofs and exposed armour use the HQ3 charcoal from their
 // upward-facing normals. Floor slabs, ground pads, signal lamps, glazing
 // and moving hardware are not repainted as roofs.
 const roof=matchedDesert&&(
  (style==='barracks'&&/^SF_(?:(?:olive|steel|deck)(?:_dark|_light)?|white|concrete_high)$/.test(material.name))||
  (style==='bastion'&&/^SF_Bastion_(?:concrete|sandplate|armor)$/.test(material.name))||
  (style==='facility'&&/roof|armou?r|concrete|sandplate|hull|deck|top|panel|steel|olive/i.test(material.name))
 );
 const revision=DESERT_FINISH_REVISION+'-'+biome+'-'+style+(roof?'-roof':'');
 if(material.userData?.sandforgeDesertFinish===revision)return;
 const oldCompile=material.onBeforeCompile;
 const colors=soldier&&biome==='desert'?SOLDIER_HQ3_DESERT_PALETTE.rgb:
  matchedDesert?HQ3_MATCHED_DESERT_PALETTE.wall:CAMOUFLAGE_PALETTES[biome].rgb;
 material.onBeforeCompile=function(shader,renderer){
  oldCompile?.call(this,shader,renderer);
  const varying='varying vec3 sfDesertWorld;'+(roof?'\nvarying vec3 sfDesertUp;':'')+
   (roof&&style==='barracks'?'\nvarying float sfBarracksHeight;':'');
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\n'+varying);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfDesertWorld='+(
    soldier?'transformed;':'(modelMatrix*vec4(transformed,1.0)).xyz;')+
   (roof?'\nsfDesertUp=normalize(mat3(modelMatrix)*normal);':'')+
   (roof&&style==='barracks'?'\nsfBarracksHeight=transformed.y;':''));
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\n'+varying);
  // Three clearly separated irregular patches; do not merely colour a few
  // already-khaki surfaces. Flat white/grey roofs and wall albedo are painted
  // as well, while original PBR normals, AO and subtle relief remain.
  const paint=[
   '#include <color_fragment>',
   // Infantry armour needs small, stable patches. World-positioned building
   // camouflage is far too broad for a human-sized helmet or vest and
   // appears as plain beige. Bind uniforms to their local mesh coordinates
   // so the pattern travels with the soldier instead of sliding over it.
   ...(soldier?[
    'float sfPatch=sin(sfDesertWorld.x*8.6+sin(sfDesertWorld.z*6.2)*1.4)',
    ' +cos(sfDesertWorld.y*9.4+sfDesertWorld.z*7.3)',
    ' +.35*sin((sfDesertWorld.x-sfDesertWorld.y)*12.1);'
   ]:[
    'float sfPatch=sin(sfDesertWorld.x*.071+sin(sfDesertWorld.z*.044)*1.8)',
    ' +cos(sfDesertWorld.z*.084-sin(sfDesertWorld.x*.057)*1.6)',
    ' +.39*sin((sfDesertWorld.x-sfDesertWorld.z)*.16);'
   ]),
   'float sfKhaki=smoothstep(-.42,-.16,sfPatch);',
   'float sfOlive=smoothstep(.42,.70,sfPatch);',
   'vec3 sfPaint=mix(vec3('+colors[0]+'),vec3('+colors[1]+'),sfKhaki);',
   'sfPaint=mix(sfPaint,vec3('+colors[2]+'),sfOlive);',
   // The HQ-like dark roof is limited to upward-facing surfaces.
   // Real wall geometry, doors, glass, radar and team markers are untouched.
   ...(roof?[
    // GLB inspection: real gable roof polygons at local Y 5.3–9.0 have
    // normal.y as low as .24. The old .50 cutoff left those slopes beige.
    ...(style==='barracks'?[
     'float sfRoof=smoothstep(.12,.24,max(sfDesertUp.y,0.0))*',
     ' smoothstep(4.85,5.25,sfBarracksHeight);'
    ]:[
     'float sfRoof=smoothstep(.50,.78,max(sfDesertUp.y,0.0));'
    ]),
    'vec3 sfRoofPaint=mix(vec3('+
     (style==='barracks'?BARRACKS_HQ3_CHARCOAL_ROOF[0]:HQ3_MATCHED_DESERT_PALETTE.roof[0])+
     '),vec3('+
     (style==='barracks'?BARRACKS_HQ3_CHARCOAL_ROOF[1]:HQ3_MATCHED_DESERT_PALETTE.roof[1])+
     '),sfKhaki);',
    'sfRoofPaint=mix(sfRoofPaint,vec3('+
     (style==='barracks'?BARRACKS_HQ3_CHARCOAL_ROOF[2]:HQ3_MATCHED_DESERT_PALETTE.roof[2])+
     '),sfOlive);',
    'sfPaint=mix(sfPaint,sfRoofPaint,sfRoof*.998);'
   ]:[]),
   // The original Kaserne's pale plates need real-looking mottled painted
   // wear and sharper organic camo, not just a flat recoloured material.
   ...(style==='barracks'&&biome==='desert'?[
    'float sfGrain=sin(sfDesertWorld.x*.67+sfDesertWorld.z*.47)*',
    ' sin(sfDesertWorld.y*.73-sfDesertWorld.z*.36);',
    'float sfWear=sin(sfDesertWorld.x*2.35+sfDesertWorld.y*.71)*',
    ' sin(sfDesertWorld.z*2.07-sfDesertWorld.y*1.11);',
    'sfPaint*=clamp(.92+sfGrain*.085+sfWear*.025,.78,1.03);'
   ]:[]),
   'float sfSurface=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));',
   'float sfRelief=clamp(.82+sfSurface*.24,.77,1.07);',
   'diffuseColor.rgb=mix(diffuseColor.rgb,clamp(sfPaint*sfRelief,0.0,1.0),'+
    (style==='barracks'&&biome==='desert'?'.985':'.94')+');'
  ].join('\n');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',paint);
 };
 material.customProgramCacheKey=()=>revision;
 material.userData={...material.userData,sandforgeDesertFinish:revision,
  sandforgeCamouflageBiome:biome};
 material.needsUpdate=true;
}

const skip=/weapon|gun|rifle|barrel|muzzle|rocket|rotor|propeller|blade|glass|window|skylight|canopy|windshield|visor|eye|skin|face|hand|tyre|tire|wheel|track|exhaust|smoke|lightbulb|lamp|emission|transparent|glow|engine|shadow|invisible|(?:^|[_\\s])flag(?:[_\\s]|$)|beacon|sensor|screen|recess|warning|indicator|bastion_light|yellow|copper|team|insignia|stencil|radar|satellite|dish|antenna|airlock|shutter|gate|door/i;
const priority=/cloth|uniform|armor|armour|vest|shoulder|chest|helmet|backpack|rucksack|pack|pants|trousers|boot|leg|body|hull|fuselage|camo|camouflage|panel|paint|metal|frame|side|roof|wall|tower|base|concrete|plaster|sandstone|trim|structure/i;
/** This function is testable with the asset's actual glTF material names,
 * but safely handles exports with generic numbered materials as well. */
export function shouldTintFactionSurface(kind,type,materialName='',meshName='',mat=null){
 // Common glTF rig names contain "SkinnedMesh". Do not mistake that
 // renderer type for exposed human skin and skip the entire uniform.
 const rigName=meshName.replace(/skinnedmesh/ig,'')
  .replace(/rocket[_ -]?(?=infantry|soldier|trooper)/ig,'');
 const name=(materialName+' '+rigName).toLowerCase();
 // The MK2's capture beacon uses SF_Bastion_red: without an explicit
 // exemption, the 94%-opaque camo shader would hide the red/blue owner
 // signal even after tintBastionCaptureSignals updates the PBR color.
 if(kind==='bastion'&&/^SF_Bastion_(?:red|light|yellow|glass|dish|dishshade|stripe|black|bolt|frame)$/.test(materialName))
  return false;
 if(skip.test(name))return false;
 if(mat?.transparent&&mat.opacity<.95)return false;
 // Never exclude structural paint solely because it was authored in pure
 // white, light-grey or near-black. Those colours caused most new GLB facades
 // to bypass the camouflage entirely. Protected glass/lamps use names above.
 if(priority.test(name))return true;
 return type==='building'||SOLDIER_KINDS.has(kind)||
  ['scout','bomber','tank','rover','artillery'].includes(kind);
}

/** Only once per actor/material. A captured base can change owner without
 * cloning again, and the cached glTF template is never mutated. */
export function tintFactionMaterials(root,owner,kind,type){
 if(!root)return 0;
 // Original reference assets contain authored vertex colour camouflage and
 // faction panels. Legacy world-space repainting would erase the art direction.
 if(tintStylizedTeam(root,owner))return 0;
 // Neutral Bastion MK2 also receives biome paint, without a faction tint.
 const teamColor=team[owner]??null;
 const owned=new Map();let tinted=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.factionAccent)return;
  const paint=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   // These coatings already use the exact HQ3 albedo. Capture updates team
   // markers separately; never multiply the facade texture by its old paint.
   if(type==='building'&&source.userData?.sandforgeBuildingDesign)return source;
   // Split a shared glTF material when one mesh is uniform armour and
   // another is a rifle/visor. A single paint clone for both would cause
   // the weapon or face to inherit the camouflage shader.
   const eligible=shouldTintFactionSurface(kind,type,source.name,mesh.name,source);
   let mat=source;
   if(!source.userData?.sandforgeFactionTint){
    let variants=owned.get(source);
    if(!variants){variants=new Map();owned.set(source,variants);}
    if(variants.has(eligible))mat=variants.get(eligible);
    else{
     mat=source.clone();
     mat.userData={...source.userData,sandforgeFactionTint:true,
      sandforgeBaseColor:source.color.getHex()};
     variants.set(eligible,mat);
    }
   }
   const base=new THREE.Color(mat.userData.sandforgeBaseColor);
   const teamFlag=/^SF_team_blue$/i.test(mat.name);
   if(teamFlag){
    if(teamColor)mat.color.copy(teamColor);
    tinted++;
    return mat;
   }
   // Existing texture detail, team marks and metalwork remain.
   const weight=type==='building'?.025:
    SOLDIER_KINDS.has(kind)?.10:
    ['scout','bomber'].includes(kind)?.23:.17;
   mat.color.copy(base);
   if(eligible){
    if(teamColor)mat.color.lerp(teamColor,weight);
    // Apply the terrain palette to every eligible building/unit material,
    // including imported grey/white GLBs and already-textured camouflage.
    // The shader preserves texture relief; glass and emissive signals are
    // excluded before this point, not recoloured.
    if(['building','unit'].includes(type)&&
       !(mat.emissiveIntensity>.29&&mat.emissive?.getHex?.()!==0)){
      // The uploaded textured-plus HQ already contains high-detail real
      // desert camouflage, UV maps, scratches and normal variation.
      // Keep its authored pixels in desert while recolouring all other
      // buildings and switching this HQ to snow/jungle on those maps.
      const keepNative=selectedCamouflageBiome==='desert'&&
       mat.userData?.sandforgePreserveHQDesertTextures;
      if(!keepNative){
       // The original soldier model's bright metallic grey finish previously
       // flattened the camouflage. Cloth/armour read matte like HQ3 paint.
       const uniform=type==='unit'&&SOLDIER_KINDS.has(kind);
       const hqMatched=type==='building'&&selectedCamouflageBiome==='desert';
       const kazerne=hqMatched&&kind==='barracks';
       mat.roughness=Math.max(kazerne?.91:hqMatched?.88:type==='building'?.84:uniform?.89:.72,mat.roughness);
       mat.metalness=Math.min(kazerne?.15:hqMatched?.20:type==='building'?.26:uniform?.16:.48,mat.metalness);
       // All building kinds (including future ones) share HQ3 colours. The
       // textured HQ3 itself stays authored: keepNative above prevents any
       // generic camouflage on its original UV-textured parts.
       if(uniform&&selectedCamouflageBiome==='desert'){
        // Use the ACTUAL user-supplied desert 002 image instead of the old
        // procedural green shader. Only eligible soldier armour/cloth/helmet
        // receives this albedo; rifle, visor, skin, team badges stay intact.
        mat.map=desert002Texture();mat.color.set('#ffffff');
        mat.metalness=.035;mat.roughness=.93;
        mat.userData.sandforgeMasterCamo='desert-002';mat.needsUpdate=true;
       }else applyDesertBuildingCamo(mat,
        kind==='barracks'||kind==='bastion'?kind:
        type==='building'?'facility':'standard');
      }
    }
    tinted++;
   }
   return mat;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(paint):paint(mesh.material);
 });
 if(type==='building')applyBuildingDesign(root,{kind,biome:selectedCamouflageBiome});
 return tinted;
}

/** Keep the old entry-point for callers; now it updates real mesh materials,
 * never attaches geometry to the unit. */
export function applyFactionAccents(entry,entity,type){
 if(!entry?.node||!entity)return null;
 if(entity.owner!==0&&entity.owner!==1)return null;
 if(entry.factionOwner===entity.owner&&entry.factionPaintedDetail===entry.detail)return null;
 tintFactionMaterials(entry.detail??entry.placeholder??entry.node,entity.owner,entity.kind,type);
 entry.factionOwner=entity.owner;
 entry.factionPaintedDetail=entry.detail;
 return null;
}
