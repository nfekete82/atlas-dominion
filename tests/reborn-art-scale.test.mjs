import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {unitArtScale,buildingArtWidth} from '../dist/src/reborn/visual-scale.js';
import {ROSTER_IMAGE_WIDTH,ROSTER_IMAGE_HEIGHT,rosterImageRect} from '../dist/src/reborn/portrait-layout.js';

test('art scale: infantry reads smaller and command buildings read bigger; no simulation dimensions change',()=>{
  for(const kind of ['infantry','medic','engineer','heavy']){
    assert.ok(unitArtScale(kind)<=.8);
    assert.ok(unitArtScale(kind)>.7);
  }
  assert.equal(unitArtScale('rover'),1.09,'Humvee is enlarged visually without changing collision or transport capacity');
  assert.equal(unitArtScale('tank'),.98);
  assert.equal(unitArtScale('artillery'),.93);
  assert.equal(unitArtScale('scout'),1.52,'transport helicopter is enlarged without changing physics');
  assert.equal(unitArtScale('bomber'),1.40,'bomber is visually enlarged');
  for(const kind of ['headquarters','barracks','factory','airfield','generator','turret'])
    assert.ok(buildingArtWidth(kind,BUILDINGS[kind].width)>BUILDINGS[kind].width);
  assert.equal(UNITS.tank.width,90);
  assert.equal(UNITS.infantry.width,38);
  assert.equal(BUILDINGS.headquarters.width,225);
  assert.ok(buildingArtWidth('headquarters',225)>280);
});

test('roster art: crop rectangle is centered and fills the maximum available frame',()=>{
  assert.deepEqual([ROSTER_IMAGE_WIDTH,ROSTER_IMAGE_HEIGHT],[192,120]);
  for(const [w,h] of [[86,160],[250,120],[160,90],[200,200],[1,100]]){
    const r=rosterImageRect(w,h);
    assert.ok(r.x>=0&&r.y>=0);
    assert.ok(r.x+r.w<=ROSTER_IMAGE_WIDTH+.0001);
    assert.ok(r.y+r.h<=ROSTER_IMAGE_HEIGHT+.0001);
    assert.ok(Math.abs((r.x+r.w/2)-ROSTER_IMAGE_WIDTH/2)<.001);
    assert.ok(Math.abs((r.y+r.h/2)-ROSTER_IMAGE_HEIGHT/2)<.001);
    assert.ok(r.w>=ROSTER_IMAGE_WIDTH-6-.01||r.h>=ROSTER_IMAGE_HEIGHT-6-.01);
  }
});

test('tank: both faction GLBs contain actual embedded PBR textures and current HD gameplay atlases',()=>{
  for(const team of [0,1]){
    const root='src/assets/reborn/animation/tank-'+team;
    const glb=fs.readFileSync(root+'.glb');
    assert.equal(glb.toString('ascii',0,4),'glTF');
    assert.ok(glb.length>8_000_000,'tank model must not fall back to flat-color old GLB');
    assert.equal(glb.toString('ascii',16,20),'JSON');
    const jsonLength=glb.readUInt32LE(12);
    const model=JSON.parse(glb.toString('utf8',20,20+jsonLength));
    assert.ok(model.images?.length>=3,'embedded color, normal and material maps');
    assert.ok(model.materials?.some(m=>m.pbrMetallicRoughness?.baseColorTexture),'GLB must contain painted camouflage');
    assert.ok(model.materials?.some(m=>m.normalTexture),'GLB must contain a relief/normal map');
    assert.ok(model.materials?.some(m=>m.pbrMetallicRoughness?.metallicRoughnessTexture),'GLB must contain roughness and metal maps');
    const png=fs.readFileSync(root+'.png');
    assert.ok(png.length>1_500_000,'PBR baked sprite atlas unexpectedly tiny');
    const meta=JSON.parse(fs.readFileSync(root+'.json','utf8'));
    assert.equal(meta.model,'tank-'+team+'.glb');
    assert.deepEqual(meta.cell,[192,192]);
    assert.equal(meta.directions,16);
    assert.ok(meta.clips.turret&&meta.clips.barrel);
  }
});
