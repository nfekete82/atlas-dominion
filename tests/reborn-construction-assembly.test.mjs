import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base='src/assets/reborn/buildings-3d';
for(const kind of ['headquarters','barracks','factory','airfield','generator','turret'])
 for(const team of [0,1])test('assembly: '+kind+' team '+team+' builds through six registered 3D mesh stages',()=>{
  const prefix=path.join(base,kind+'-'+team);
  const meta=JSON.parse(fs.readFileSync(prefix+'-construction.json','utf8'));
  const finished=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));
  const stage=meta.layer;
  assert.equal(meta.kind,kind);
  assert.equal(meta.team,team);
  assert.equal(meta.model,finished.model);
  assert.equal(meta.stages,6);
  assert.ok(meta.parts>=6);
  assert.equal(stage.frames.length,6);
  assert.deepEqual(stage.pivot,[finished.body.pivot[0]-stage.originalBounds.x,finished.body.pivot[1]-stage.originalBounds.y]);
  assert.equal(stage.image,kind+'-'+team+'-construction.png');
  const png=fs.readFileSync(path.join(base,stage.image));
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.ok(width>=stage.frames[0].w*6&&width<=4096,'six stages are packed in an atlas');
  assert.ok(height>=stage.frames[0].h&&height<=512,'source art is not stretched');
  assert.ok(png.length>10000);
  assert.ok(stage.frames.every(f=>f.w>0&&f.h>0&&f.x>=0&&f.y>=0&&f.x+f.w<=width&&f.y+f.h<=height));
 });
