import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {tintFactionMaterials,applyFactionAccents,shouldTintFactionSurface,FACTION_COLORS}
 from '../scripts/webgl-faction-accents.js';

const colorDelta=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b);
function model(name='Helicopter_Fuselage',materialName='camo'){
 const scene=new THREE.Group();
 const base=new THREE.MeshStandardMaterial({name:materialName,color:'#af9a74',roughness:.81});
 const texture=new THREE.Texture();base.map=texture;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),base);
 mesh.name=name;scene.add(mesh);
 return {scene,mesh,base,texture};
}
test('blue and red units subtly tint the actual PBR material, preserving camouflage texture',()=>{
 assert.equal(FACTION_COLORS[0],'#347c9c');
 assert.equal(FACTION_COLORS[1],'#af5449');
 for(const type of ['unit']){
  for(const kind of type==='unit'
   ?['scout','bomber','rover','tank','infantry','medic','heavy','engineer','artillery']
   :['headquarters','barracks','factory','generator','turret']){
   const m=model(type==='building'?'Tower_Panel':'Helicopter_Fuselage','Camo_Armor');
   const before=m.base.color.clone();
   assert.equal(tintFactionMaterials(m.scene,0,kind,type),1,kind+' blue');
   assert.equal(m.scene.children.length,1,'no additional floating cubes');
   assert.equal(m.mesh.material.map,m.texture,'keep original texture');
   assert.ok(colorDelta(m.mesh.material.color,before)>0);
   assert.ok(colorDelta(m.mesh.material.color,before)<.48,
    'do not repaint entire unit a saturated solid colour');
   assert.ok(m.mesh.material.userData.sandforgeFactionTint);
   assert.equal(m.mesh.material.userData.sandforgeBaseColor,before.getHex());
   assert.equal(m.base.color.getHex(),before.getHex(),'shared cached GLB template unchanged');
   const tinted=m.mesh.material.color.clone();
   tintFactionMaterials(m.scene,1,kind,type);
   assert.ok(colorDelta(tinted,m.mesh.material.color)>.01,'ownership recolors');
   assert.equal(m.mesh.material.map,m.texture);
  }
 }
});

test('the real helicopter canopy, rotor and infantry weapons are not tinted',()=>{
 assert.equal(shouldTintFactionSurface('scout','unit','GlassCanopy','Cockpit_Visor'),false);
 assert.equal(shouldTintFactionSurface('scout','unit','RotorMetal','Rotor_Blades'),false);
 assert.equal(shouldTintFactionSurface('infantry','unit','Fabric','Rifle_Muzzle'),false);
 assert.equal(shouldTintFactionSurface('medic','unit','Cloth','Shoulder'),true);
 assert.equal(shouldTintFactionSurface('headquarters','building','Facade','Wall'),true);
 const m=model('RotorBlade','Rotor');
 tintFactionMaterials(m.scene,0,'scout','unit');
 assert.equal(m.mesh.material.color.getHex(),m.base.color.getHex());
});

test('an entry is painted only once per loaded model and never gains faction geometry',()=>{
 const m=model('Soldier_Vest','Uniform_Armor');
 const entry={node:m.scene,placeholder:m.scene,kind:'infantry',owner:0};
 assert.equal(applyFactionAccents(entry,{kind:'infantry',owner:0},'unit',60,34),null);
 assert.equal(entry.factionOwner,0);
 const painted=m.mesh.material;
 const once=painted.color.clone();
 assert.equal(applyFactionAccents(entry,{kind:'infantry',owner:0},'unit'),null);
 assert.equal(m.mesh.material,painted);
 assert.equal(painted.color.getHex(),once.getHex());
 assert.equal(entry.node.children.length,1,'no added material-box geometry');
 applyFactionAccents(entry,{kind:'infantry',owner:1},'unit');
 assert.equal(entry.factionOwner,1);
 assert.equal(m.mesh.material,painted,'repaint existing owned material');
 assert.notEqual(painted.color.getHex(),once.getHex());
 const detailed=model('Armor_Body','Armor');
 entry.detail=detailed.scene;
 applyFactionAccents(entry,{kind:'infantry',owner:1},'unit');
 assert.ok(detailed.mesh.material.userData.sandforgeFactionTint);
});

test('WebGL ships the tint implementation and disposes per-actor colored materials',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(existsSync('dist/webgl-faction-accents.js'));
 assert.match(build,/cpSync\('scripts\/webgl-faction-accents\.js','dist\/webgl-faction-accents\.js'\)/);
 assert.match(battlefield,/applyFactionAccents\(entry,u,'unit'\)/);
 assert.match(battlefield,/applyFactionAccents\(entry,b,'building'\)/);
 assert.match(battlefield,/disposeTaggedMaterials\(e\.detail,'sandforgeFactionTint'\)/);
 assert.doesNotMatch(battlefield,/entry\.factionAccents/);
 const factionCode=readFileSync('scripts/webgl-faction-accents.js','utf8');
 assert.doesNotMatch(factionCode,/new THREE\.BoxGeometry/);
 assert.doesNotMatch(factionCode,/new THREE\.Mesh\(/);
});
