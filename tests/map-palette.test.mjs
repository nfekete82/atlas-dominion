import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_PALETTE,mixHexColor} from '../dist/src/render/map-palette.js';

test('pastel territory colors preserve factions but mix into a light map palette',()=>{
  assert.equal(mixHexColor('#e9b85e','#e9e9cf',0),'#e9b85e');
  assert.equal(mixHexColor('#e9b85e','#e9e9cf',1),'#e9e9cf');
  const gold=mixHexColor('#e9b85e');
  const blue=mixHexColor('#62a6d8');
  assert.notEqual(gold,blue);
  assert.match(gold,/^#[a-f0-9]{6}$/);
  assert.ok(parseInt(MAP_PALETTE.oceanTop.slice(1),16)>0);
});

test('palette rejects malformed colors and clamps overspecified blend ratios',()=>{
  assert.throws(()=>mixHexColor('#fff'));
  assert.equal(mixHexColor('#123456','#fedcba',-50),'#123456');
  assert.equal(mixHexColor('#123456','#fedcba',50),'#fedcba');
});
