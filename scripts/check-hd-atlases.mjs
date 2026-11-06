/** Validate every offline vehicle atlas before modifying GitHub-tracked assets. */
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('src/assets/reborn/animation');
const kinds=['rover','tank','artillery','scout','bomber'];
let count=0;
for(const kind of kinds)for(const team of [0,1]){
 const stem=kind+'-'+team;
 const meta=JSON.parse(await readFile(join(root,stem+'.json'),'utf8'));
 const png=await readFile(join(root,stem+'.png'));
 assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a','PNG signature: '+stem);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.deepEqual(meta.cell,[192,192],stem+' must be native 2x');
 assert.equal(meta.renderResolution,192);
 assert.ok(meta.nativeScale>0&&meta.nativeScale<1,stem+' must preserve on-screen size');
 assert.ok(meta.frames.length>=32,'frame coverage: '+stem);
 assert.ok(width>=192*12&&height>=192*2,'texture resolution: '+stem);
 assert.equal(meta.model,stem+'.glb','3D model gallery link: '+stem);
 for(const f of meta.frames){
  assert.equal(f.w,192);assert.equal(f.h,192);
  assert.deepEqual(f.pivot,[96,156]);
  assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=width&&f.y+f.h<=height,'frame bounds: '+stem);
 }
 count++;
 console.log(stem+': '+meta.frames.length+' HD frames '+width+'x'+height+' OK');
}
assert.equal(count,12);
console.log('Validated '+count+' native 192px faction atlases.');
