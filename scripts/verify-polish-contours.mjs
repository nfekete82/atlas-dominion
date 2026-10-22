import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as after from '../dist/src/render/territory-contours.js';
if(!process.argv[2])throw Error('Usage: node scripts/verify-polish-contours.mjs <baseline territory-contours.js>');
const before=await import(pathToFileURL(resolve(process.argv[2])));
let grids=0,rings=0;
function check(grid,width){
 const a=before.territoryContours(grid,width),b=after.territoryContours(grid,width);
 assert.deepEqual(b,a,'exact segment coordinates and order');
 for(const [id,segments] of a){assert.deepEqual(after.contourRings(b.get(id)),before.contourRings(segments),'exact ring coordinates and order');rings++;}
 grids++;
}
for(const width of [1,2,3,17,480])for(let seed=0;seed<32;seed++)
 check(Int16Array.from({length:width*17},(_,i)=>((Math.imul(i+seed*77,1664525)>>>17)%6)-2),width);
const fixture=JSON.parse(readFileSync('docs/qa/deep-game-20261022/render-fixture.json','utf8'));
check(Int16Array.from(fixture.owner),480);
const result={grids,factionRingSets:rings,exactSegments:true,exactRings:true};
writeFileSync('docs/qa/final-polish-20261022/contour-equivalence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
