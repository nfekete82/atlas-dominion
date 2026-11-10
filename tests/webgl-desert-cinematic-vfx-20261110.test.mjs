import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('new battles default to desert while preserving explicit snow and jungle',()=>{
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(menu,/biome='desert'/);
 assert.match(menu,/\$\('sf3d-biome'\)\.value='desert'/);
 assert.match(menu,/biome:\$\('sf3d-biome'\)\.value/);
 assert.match(preview,/normalizeBiome\(query\.get\('biome'\)\)/);
});

test('desert blasts stage a brief flash, drifting smoke and grounded ejected grit',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 for(const feature of [
  "if(mode==='flash')",
  "this.flash=makePool(scene,'flash'",
  'this.particle(this.flash,x,z,impactGround+',
  "if(pool.mode==='debris')p.vy-=230*dt",
  "if(pool.mode==='smoke')",
  "if(mode==='scorch')",
  "this.shocks.push({x,z,y:impactGround+3"
 ])assert.ok(vfx.includes(feature),'missing staged desert VFX '+feature);
 assert.match(vfx,/for\(const pool of \[this\.smoke,this\.flash,this\.flames,this\.dust,this\.sparks,this\.debris\]\)/);
 assert.match(vfx,/dummy\.position\.set\(shock\.x-this\.world\.size\*\.5,shock\.y,/);
 assert.doesNotMatch(vfx,/this\.heightAt\(shock\.x,shock\.z\)/,
  'ground height is cached at detonation, not sampled on every frame');
 assert.match(vfx,/mesh\.userData=\{visualOnly:true,nonPlayable:true,combatParticles:true,mode\}/);
 assert.doesNotMatch(vfx,/this\.game\.step\(/);
});
