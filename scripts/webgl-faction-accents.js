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
export const DESERT_FINISH_REVISION='desert-camouflage-v3-20261109';
function applyDesertBuildingCamo(material){
 if(material.userData?.sandforgeDesertFinish===DESERT_FINISH_REVISION)return;
 const oldCompile=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  oldCompile?.call(this,shader,renderer);
  const varying='varying vec3 sfDesertWorld;';
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\n'+varying);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfDesertWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\n'+varying);
  const paint=[
   '#include <color_fragment>',
   'float sfPatch=sin(sfDesertWorld.x*.067+sin(sfDesertWorld.z*.054)*1.8)',
   ' +cos(sfDesertWorld.z*.075-sfDesertWorld.y*.031)',
   ' +.27*sin((sfDesertWorld.x+sfDesertWorld.z)*.19);',
   'float sfOlive=smoothstep(.67,1.17,sfPatch);',
   'float sfKhaki=smoothstep(-.56,.12,sfPatch);',
   'vec3 sfPaint=mix(vec3(.68,.57,.39),vec3(.46,.46,.32),sfKhaki*.79);',
   'sfPaint=mix(sfPaint,vec3(.30,.34,.23),sfOlive*.55);',
   'float sfSurface=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));',
   'float sfRelief=clamp(.57+sfSurface*.72,.28,1.12);',
   'float sfCoverage=smoothstep(.018,.12,sfSurface)*.94;',
   'diffuseColor.rgb=mix(diffuseColor.rgb,clamp(sfPaint*sfRelief*1.34,0.0,1.0),sfCoverage);'
  ].join('\n');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',paint);
 };
 material.customProgramCacheKey=()=>DESERT_FINISH_REVISION;
 material.userData={...material.userData,sandforgeDesertFinish:DESERT_FINISH_REVISION};
 material.needsUpdate=true;
}

const skip=/weapon|gun|rifle|barrel|muzzle|rocket|rotor|propeller|blade|glass|window|canopy|windshield|visor|eye|skin|face|hand|tyre|tire|wheel|track|exhaust|smoke|lightbulb|lamp|emission|transparent|glow|engine|shadow|invisible/i;
const priority=/cloth|uniform|armor|armour|vest|shoulder|chest|helmet|body|hull|fuselage|camo|camouflage|panel|paint|metal|frame|side|roof|wall|tower|base|concrete|plaster|sandstone|trim|structure/i;
/** This function is testable with the asset's actual glTF material names,
 * but safely handles exports with generic numbered materials as well. */
export function shouldTintFactionSurface(kind,type,materialName='',meshName='',mat=null){
 const name=(materialName+' '+meshName).toLowerCase();
 if(skip.test(name))return false;
 if(mat?.transparent&&mat.opacity<.95)return false;
 if(mat?.color&&mat.color.getHSL){
  const hsl={h:0,s:0,l:0};mat.color.getHSL(hsl);
  if(hsl.l<.11||hsl.l>.96)return false;
 }
 if(priority.test(name))return true;
 return type==='building'||['infantry','medic','engineer','heavy',
  'scout','bomber','tank','rover','artillery'].includes(kind);
}

/** Only once per actor/material. A captured base can change owner without
 * cloning again, and the cached glTF template is never mutated. */
export function tintFactionMaterials(root,owner,kind,type){
 if(!root||!team[owner])return 0;
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
   const eligible=shouldTintFactionSurface(kind,type,mat.name,mesh.name,mat);
   // Existing beige, charcoal, camouflage and texture detail remain.
   const weight=type==='building'?.025:
    ['infantry','medic','engineer','heavy'].includes(kind)?.25:
    ['scout','bomber'].includes(kind)?.23:.17;
   mat.color.copy(base);
   if(eligible){
    mat.color.lerp(team[owner],weight);
    if(type==='building'&&mat.metalness<.9&&
       !(mat.emissiveIntensity>.29&&mat.emissive?.getHex?.()!==0))
      applyDesertBuildingCamo(mat);
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
