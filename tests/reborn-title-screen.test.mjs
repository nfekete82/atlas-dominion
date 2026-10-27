import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

test('title menu appears on every normal reload and keeps debug gameplay unobstructed',()=>{
 const ts=readFileSync('src/reborn/main.ts','utf8');
 const html=readFileSync('dist/index.html','utf8');
 assert.match(ts,/if\(!query\.has\('debug'\)\)modal\('main-dialog'\)/);
 assert.doesNotMatch(ts,/if\(!query\.has\('debug'\)\)modal\('new-dialog'\)/);
 assert.match(ts,/main-dialog'\)\.addEventListener\('cancel',event=>event\.preventDefault\(\)\)/);
 assert.match(ts,/if\(id==='main-dialog'\).*hidden=!hasEnteredCampaign/);
 assert.match(html,/<dialog id="main-dialog" class="main-menu"/);
 for(const id of ['new','main-continue','main-load','map-size','new-dialog']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 const css=readFileSync('dist/retro-desert.css','utf8');
 assert.match(css,/#main-dialog\[open\]\s*\{display:flex/);
 assert.match(css,/url\('\/src\/assets\/reborn\/start-screen\.png'\)/);
 assert.ok(statSync('src/assets/reborn/start-screen.png').size>100_000,'original artwork must exist');
 assert.ok(statSync('dist/src/assets/reborn/start-screen.png').size>100_000,'artwork must ship inside Docker dist');
});
