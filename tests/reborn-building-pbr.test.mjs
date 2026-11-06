import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditBuildingAssets} from '../scripts/validate-building-assets.mjs';

test('buildings PBR: all 15 shipped GLBs contain real surfaces and every registered sprite frame has visible pixels',()=>{
 const models=auditBuildingAssets();assert.equal(models.length,15);assert.equal(models.filter(m=>m.team===-1).length,1);
 assert.equal(models.find(m=>m.kind==='airfield').parts>models.find(m=>m.kind==='generator').parts,true);
});
