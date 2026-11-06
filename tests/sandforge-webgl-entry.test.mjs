import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('the classic Canvas RTS stays available through a stable explicit URL',()=>{
 assert.ok(existsSync('dist/classic.html'),'classic renderer must remain accessible for save/QA parity');
 const classic=read('dist/classic.html');
 assert.match(classic,/<canvas id="world"/,'classic game has its gameplay canvas');
 assert.match(classic,/src="\/src\/reborn\/main\.js"/,'classic game retains its controller entry');
});

test('3D root switch is reversible and preserves the standalone WebGL entry',()=>{
 const landing=read('dist/index.html');
 const standalone=read('dist/webgl-preview.html');
 const webglDefault=process.env.SANDFORGE_RENDERER==='webgl';
 assert.match(standalone,/id="stage"/,'WebGL game must still have its original standalone URL');
 if(webglDefault){
  assert.match(landing,/id="stage"/,'3D build must open a real Three.js stage at /');
  assert.match(landing,/type="importmap"/,'Three.js import map must ship in root HTML');
  assert.doesNotMatch(landing,/<canvas id="world"/,'3D root must not launch the Canvas battlefield');
  assert.match(landing,/href="\/classic\.html"/,'legacy fallback cannot loop back into 3D');
  assert.doesNotMatch(landing,/THREE\.JS PREVIEW/,'released title must not say preview');
 }else{
  assert.match(landing,/<canvas id="world"/,'standard build remains classic until 3D release gate');
  assert.match(landing,/src="\/src\/reborn\/main\.js"/);
 }
});
