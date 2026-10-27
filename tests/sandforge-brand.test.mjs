import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const html=readFileSync('dist/index.html','utf8');
const css=readFileSync('dist/retro-desert.css','utf8');
const js=readFileSync('dist/src/assets/reborn/sandforge-brand.js','utf8');

test('Sandforge branding is available in menus, title and HUD',()=>{
 assert.match(html,/<title>Sandforge: Bastion Wars<\/title>/);
 assert.match(html,/sandforge-brand\.js/);
 assert.match(html,/sandforge-icon\.svg/);
 assert.match(js,/#main-dialog/);
 assert.match(js,/#pause-dialog/);
 assert.match(js,/#loading/);
 assert.match(js,/sandforge-hud-copy/);
 assert.match(css,/SANDFORGE BRAND V2/);
 assert.match(css,/sandforge-splash-logo/);
 for(const name of ['sandforge-logo.webp','sandforge-icon.svg','sandforge-brand.js']){
   assert.ok(statSync('src/assets/reborn/'+name).size>100);
   assert.ok(statSync('dist/src/assets/reborn/'+name).size>100);
 }
});
test('package and lock names are synchronized',()=>{
 const p=JSON.parse(readFileSync('package.json','utf8'));
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 assert.equal(p.name,'sandforge-bastion-wars');
 assert.equal(lock.name,p.name);
 assert.equal(lock.packages[''].name,p.name);
});

test('launch route shows full-screen desert art before map selection',()=>{
 const main=readFileSync('src/reborn/main.ts','utf8');
 assert.match(main,/if\(!query\.has\('debug'\)\)modal\('main-dialog'\)/);
 assert.doesNotMatch(main,/if\(!query\.has\('debug'\)\)modal\('new-dialog'\)/);
 assert.match(main,/main-dialog'\)\.addEventListener\('cancel',event=>event\.preventDefault\(\)\)/);
 assert.match(main,/main-continue'\)\.hidden=!hasEnteredCampaign/);
 assert.match(html,/<dialog id="main-dialog" class="main-menu"/);
 assert.match(css,/#main-dialog\[open\]\s*\{display:flex/);
 assert.match(css,/url\('\/src\/assets\/reborn\/start-screen\.png'\)/);
 assert.ok(statSync('src/assets/reborn/start-screen.png').size>100_000,'title image must be present');
 assert.ok(statSync('dist/src/assets/reborn/start-screen.png').size>100_000,'title image must be shipped');
});
