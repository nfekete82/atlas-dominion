import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildingArtScale,buildingArtWidth,bastionArtWidth} from '../dist/src/reborn/visual-scale.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';

test('visual scale: energy generator 12% smaller, bastion 20% larger',()=>{
 assert.equal(buildingArtScale('generator'),1.21*.88);
 assert.ok(Math.abs(buildingArtWidth('generator',BUILDINGS.generator.width)-BUILDINGS.generator.width*1.21*.88)<1e-10,'generator visual scale matches within floating-point precision');
 assert.equal(bastionArtWidth,67*1.20);
 assert.equal(buildingArtScale('headquarters'),1.30);
 assert.equal(buildingArtScale('factory'),1.26);
 assert.equal(buildingArtScale('barracks'),1.26);
 assert.equal(buildingArtScale('airfield'),1.26);
});

test('rendering: bastion body and animation scale together across all ownership states',()=>{
 const source=readFileSync('src/reborn/renderer.ts','utf8');
 assert.match(source,/this\.spriteDraw\(this\.bastions\[t\.owner===0\?'blue':t\.owner===1\?'red':'neutral'\],p,bastionArtWidth/);
 assert.match(source,/this\.structures\.drawActivity\(c,'bastion',t\.owner,p,bastionArtWidth/);
 assert.match(source,/this\.spriteDraw\(sprite,anchor,artWidth/);
});

test('gameplay footprint and capture radius stay unchanged',()=>{
 assert.equal(BUILDINGS.generator.radius,38);
 assert.equal(RULES.captureRadius,95);
 assert.equal(RULES.bastion.radius,24);
});
