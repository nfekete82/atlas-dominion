import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {healthColor,healthFraction} from '../dist/webgl-health.js';
import {MODEL_HEIGHTS,calibratedScale} from '../dist/webgl-scale.js';

test('health graphics use true HP and fully green at maximum, shrink under fire',()=>{
 assert.equal(healthFraction(100,100),1);
 assert.equal(healthFraction(80,100),.8);
 assert.equal(healthFraction(50,100),.5);
 assert.equal(healthFraction(15,100),.15);
 assert.equal(healthFraction(0,100),0);
 assert.equal(healthFraction(200,100),1);
 assert.equal(healthFraction(-8,100),0);
 assert.equal(healthFraction(100,0),0);
 assert.equal(healthColor(1),'#24e568');
 assert.equal(healthColor(.5),'#f6d44b');
 assert.equal(healthColor(.3),'#f29a36');
 assert.equal(healthColor(.1),'#ed5146');
});
test('four infantry classes are normalized by measured GLB height, not weapons',()=>{
 const bounds={x:2,y:4,z:1.2};
 for(const kind of ['infantry','medic','engineer','heavy']){
  const width=kind==='heavy'?44:38;
  const scale=calibratedScale(kind,'unit',bounds,width);
  assert.equal(Math.round(scale*bounds.y),MODEL_HEIGHTS[kind],kind+' model height');
 }
 // Rifle / shoulder equipment can be wider than the torso. It must NOT
 // make a whole infantry class smaller than other soldiers.
 for(const kind of ['infantry','medic','engineer','heavy']){
  const width=kind==='heavy'?44:38;
  const scale=calibratedScale(kind,'unit',{x:28,y:4,z:1.2},width);
  assert.equal(Math.round(scale*4),MODEL_HEIGHTS[kind],kind+' wide-weapon model height');
 }
 for(const kind of ['tank','rover','artillery','scout','bomber']){
  const scale=calibratedScale(kind,'unit',{x:8,y:5,z:10},90);
  assert.ok(scale>0&&scale*5<=MODEL_HEIGHTS[kind]+.001,kind+' bounded height');
 }
 for(const kind of ['headquarters','barracks','factory','airfield','generator','turret']){
  const scale=calibratedScale(kind,'building',{x:8,y:5,z:10},180);
  assert.ok(scale>0&&scale*5<=MODEL_HEIGHTS[kind]+.001,kind+' bounded building');
 }
});
test('3D menu, terrain, models and health parity modules are all shipped',()=>{
 const files=['webgl-edge-cliffs.js','webgl-grounding.js','webgl-scale.js','webgl-health.js'];
 for(const name of files)assert.ok(existsSync('dist/'+name),name+' must be in OrbStack dist');
 const preview=readFileSync('dist/webgl-preview.js','utf8');
 const actor=readFileSync('dist/webgl-actor-presentation.js','utf8');
 const adapter=readFileSync('dist/webgl-battlefield.js','utf8');
 const cliff=readFileSync('dist/webgl-edge-cliffs.js','utf8');
 const docker=readFileSync('Dockerfile','utf8');
 for(const name of files)assert.ok(docker.includes('COPY scripts ./scripts')||docker.includes('COPY scripts/'+name),name+' missing from Docker script copy');
 assert.match(preview,/addBoundaryCliffs\(/);
 assert.match(adapter,/calibratedScale\(/);
 assert.match(adapter,/attachBuilding\(entry,b\)/);
 assert.match(actor,/healthFraction\(hp,maxHp\)/);
 assert.match(actor,/healthColor\(pct\)/);
 assert.match(actor,/transparent:true,opacity:1/);
 assert.match(actor,/showHealth='all'/);
 assert.match(cliff,/nonPlayable:true/);
 assert.match(cliff,/const along=-offset\+t\*\(size\+2\*offset\)/);
});
