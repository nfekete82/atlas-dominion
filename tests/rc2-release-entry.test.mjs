import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageProduction} from '../scripts/uberspace/package.mjs';

const read=p=>readFileSync(p,'utf8');

test('RC2 default entry serves real WebGL; classic remains a separate URL',()=>{
 const webgl=process.env.SANDFORGE_RENDERER!=='classic';
 const index=read('dist/index.html'),classic=read('dist/classic.html');
 assert.match(classic,/<canvas id="world"/);
 assert.ok(existsSync('dist/webgl-preview.html'));
 if(webgl){
  assert.match(index,/<div id="stage"/);
  assert.match(index,/<script type="importmap"/);
  assert.doesNotMatch(index,/<canvas id="world"/);
  assert.match(index,/<title>Sandforge: Bastion Wars<\/title>/);
  assert.match(index,/href="\/classic\.html"/);
  assert.match(index,/href="\/classic\.html"[^>]*>Klassische Version/);
 }else{
  assert.match(index,/<canvas id="world"/);
 }
 for(const path of [
  'dist/webgl-preview.js','dist/webgl-title-menu.js',
  'dist/webgl-battlefield.js','dist/webgl-bastion-capture.js',
  'dist/webgl-ground-tracks.js','dist/webgl-building-yard.js',
  'dist/webgl-perf-watch.js','dist/webgl-construction-recovery.js',
  'dist/vendor/three/three.module.js','dist/webgl-classic-hud.css'
 ])assert.ok(existsSync(path),'required 3D module missing: '+path);
});

test('RC2 Docker preview is isolated from the live compose service',()=>{
 const docker=read('Dockerfile'),preview=read('compose.rc2-preview.yaml');
 assert.match(docker,/COPY scripts \.\/scripts/);
 assert.match(docker,/SANDFORGE_RENDERER=webgl npm run build/);
 assert.match(preview,/127\.0\.0\.1:8106:8095/);
 assert.doesNotMatch(preview,/127\.0\.0\.1:8095:8095/);
 assert.match(preview,/sandforge-webgl-rc2-preview:local/);
});

test('old Uberspace Canvas packager refuses incomplete 3D artifacts',async()=>{
 const tmp=mkdtempSync(join(tmpdir(),'sandforge-rc2-packager-'));
 try{
  mkdirSync(join(tmp,'dist'));
  writeFileSync(join(tmp,'dist','index.html'),
    '<!doctype html><div id="stage"></div><script type="module" src="/webgl-preview.js"></script>');
  await assert.rejects(packageProduction({
   root:tmp,output:join(tmp,'output'),release:'v-test-123',
   commit:'0'.repeat(40),branch:'rc2'
  }),/legacy packaging does not contain the complete WebGL module graph/);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
