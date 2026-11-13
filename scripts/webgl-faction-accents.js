import * as THREE from 'three';

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
// Unlike the textured HQ3, the original Kaserne and Bastion MK2 have no
// baked desert camo. Match HQ3's dark khaki/olive with a charcoal roof
// without editing their authored GLBs or hiding lights and insignia.
export const HQ3_MATCHED_DESERT_PALETTE=Object.freeze({
 wall:Object.freeze(['.57,.52,.40','.39,.42,.32','.20,.27,.22']),
 roof:Object.freeze(['.24,.27,.24','.21,.24,.21','.13,.17,.15'])
});
export const DESERT_FINISH_REVISION='biome-camouflage-hq-barracks-bastion-v7-20261113';
let selectedCamouflageBiome='desert';
export function setWorldCamouflageBiome(value){
 selectedCamouflageBiome=Object.hasOwn(CAMOUFLAGE_PALETTES,value)?value:'desert';
 return selectedCamouflageBiome;
}
export const worldCamouflageBiome=()=>selectedCamouflageBiome;
function applyDesertBuildingCamo(material,style='standard'){
 const biome=selectedCamouflageBiome;
 const matchedDesert=biome==='desert'&&(style==='barracks'||style==='bastion');
 // Barracks roof panels and the Bastion's massive upper armour use the
 // HQ3's dark charcoal; only upward-facing polygon surfaces are darkened.
 // Radar dishes, capture lamps, doors and glass retain their PBR identities.
 const roof=matchedDesert&&(
  (style==='barracks'&&/^SF_(?:olive|steel)(?:_dark|_light)?$/.test(material.name))||
  (style==='bastion'&&/^SF_Bastion_(?:concrete|sandplate|armor)$/.test(material.name))
 );
 const revision=DESERT_FINISH_REVISION+'-'+biome+'-'+style+(roof?'-roof':'');
 if(material.userData?.sandforgeDesertFinish===revision)return;
 const oldCompile=material.onBeforeCompile;
 const colors=matchedDesert?HQ3_MATCHED_DESERT_PALETTE.wall:CAMOUFLAGE_PALETTES[biome].rgb;
 material.onBeforeCompile=function(shader,renderer){
  oldCompile?.call(this,shader,renderer);
  const varying='varying vec3 sfDesertWorld;'+(roof?'\nvarying vec3 sfDesertUp;':'');
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\n'+varying);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfDesertWorld=(modelMatrix*vec4(transformed,1.0)).xyz;'+
   (roof?'\nsfDesertUp=normalize(mat3(modelMatrix)*normal);':''));
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\n'+varying);
  // Three clearly separated irregular patches; do not merely colour a few
  // already-khaki surfaces. Flat white/grey roofs and wall albedo are painted
  // as well, while original PBR normals, AO and subtle relief remain.
  const paint=[
   '#include <color_fragment>',
   'float sfPatch=sin(sfDesertWorld.x*.071+sin(sfDesertWorld.z*.044)*1.8)',
   ' +cos(sfDesertWorld.z*.084-sin(sfDesertWorld.x*.057)*1.6)',
   ' +.39*sin((sfDesertWorld.x-sfDesertWorld.z)*.16);',
   'float sfKhaki=smoothstep(-.42,-.16,sfPatch);',
   'float sfOlive=smoothstep(.42,.70,sfPatch);',
   'vec3 sfPaint=mix(vec3('+colors[0]+'),vec3('+colors[1]+'),sfKhaki);',
   'sfPaint=mix(sfPaint,vec3('+colors[2]+'),sfOlive);',
   // The HQ-like dark roof is limited to upward-facing surfaces.
   // Real wall geometry, doors, glass, radar and team markers are untouched.
   ...(roof?[
    'float sfRoof=smoothstep(.50,.78,max(sfDesertUp.y,0.0));',
    'vec3 sfRoofPaint=mix(vec3('+HQ3_MATCHED_DESERT_PALETTE.roof[0]+'),vec3('+HQ3_MATCHED_DESERT_PALETTE.roof[1]+'),sfKhaki);',
    'sfRoofPaint=mix(sfRoofPaint,vec3('+HQ3_MATCHED_DESERT_PALETTE.roof[2]+'),sfOlive);',
    'sfPaint=mix(sfPaint,sfRoofPaint,sfRoof*.97);'
   ]:[]),
   'float sfSurface=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));',
   'float sfRelief=clamp(.82+sfSurface*.24,.77,1.07);',
   'diffuseColor.rgb=mix(diffuseColor.rgb,clamp(sfPaint*sfRelief,0.0,1.0),.94);'
  ].join('\n');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',paint);
 };
 material.customProgramCacheKey=()=>revision;
 material.userData={...material.userData,sandforgeDesertFinish:revision,
  sandforgeCamouflageBiome:biome};
 material.needsUpdate=true;
}

const skip=/weapon|gun|rifle|barrel|muzzle|rocket|rotor|propeller|blade|glass|window|canopy|windshield|visor|eye|skin|face|hand|tyre|tire|wheel|track|exhaust|smoke|lightbulb|lamp|emission|transparent|glow|engine|shadow|invisible|(?:^|[_\\s])flag(?:[_\\s]|$)|beacon|sensor|screen|recess|warning|indicator|bastion_light|yellow|copper|team|insignia|stencil/i;
const priority=/cloth|uniform|armor|armour|vest|shoulder|chest|helmet|body|hull|fuselage|camo|camouflage|panel|paint|metal|frame|side|roof|wall|tower|base|concrete|plaster|sandstone|trim|structure/i;
/** This function is testable with the asset's actual glTF material names,
 * but safely handles exports with generic numbered materials as well. */
export function shouldTintFactionSurface(kind,type,materialName='',meshName='',mat=null){
 const name=(materialName+' '+meshName).toLowerCase();
 if(skip.test(name))return false;
 if(mat?.transparent&&mat.opacity<.95)return false;
 // Never exclude structural paint solely because it was authored in pure
 // white, light-grey or near-black. Those colours caused most new GLB facades
 // to bypass the camouflage entirely. Protected glass/lamps use names above.
 if(priority.test(name))return true;
 return type==='building'||['infantry','medic','engineer','heavy',
  'scout','bomber','tank','rover','artillery'].includes(kind);
}

/** Only once per actor/material. A captured base can change owner without
 * cloning again, and the cached glTF template is never mutated. */
export function tintFactionMaterials(root,owner,kind,type){
 if(!root)return 0;
 // Neutral Bastion MK2 also receives biome paint, without a faction tint.
 const teamColor=team[owner]??null;
 const owned=new Map();let tinted=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.factionAccent)return;
  const paint=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   let mat=source;
   if(!source.userData?.sandforgeFactionTint){
    if(owned.has(source))mat=owned.get(source);
    else{
     mat=source.clone();
     mat.userData={...source.userData,sandforgeFactionTint:true,
      sandforgeBaseColor:source.color.getHex()};
     owned.set(source,mat);
    }
   }
   const base=new THREE.Color(mat.userData.sandforgeBaseColor);
   const teamFlag=/^SF_team_blue$/i.test(mat.name);
   if(teamFlag){
    if(teamColor)mat.color.copy(teamColor);
    tinted++;
    return mat;
   }
   const eligible=shouldTintFactionSurface(kind,type,mat.name,mesh.name,mat);
   // Existing texture detail, team marks and metalwork remain.
   const weight=type==='building'?.025:
    ['infantry','medic','engineer','heavy'].includes(kind)?.25:
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
       mat.roughness=Math.max(type==='building'?.84:.72,mat.roughness);
       mat.metalness=Math.min(type==='building'?.26:.48,mat.metalness);
       applyDesertBuildingCamo(mat,
        kind==='barracks'||kind==='bastion'?kind:'standard');
      }
    }
    tinted++;
   }
   return mat;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(paint):paint(mesh.material);
 });
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
