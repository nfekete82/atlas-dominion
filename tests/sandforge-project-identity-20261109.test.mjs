import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('canonical project identity is Sandforge; package and lockfile match',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.name,'sandforge');
 assert.equal(lock.name,pkg.name);
 assert.equal(lock.packages[''].name,pkg.name);
 assert.match(pkg.description,/SANDFORGE: BASTION WARS/);
 assert.equal(pkg.scripts.build,'tsc -p tsconfig.json && node scripts/build.mjs');
});

test('Playwright package and lockfile also use the Sandforge project identity',()=>{
 const browser=JSON.parse(read('tests/browser/package.json'));
 const lock=JSON.parse(read('tests/browser/package-lock.json'));
 assert.equal(browser.name,'sandforge-browser-tests');
 assert.equal(lock.name,browser.name);
 assert.equal(lock.packages[''].name,browser.name);
});

test('new Docker Compose service does not alter the live port and preview remains isolated',()=>{
 const compose=read('compose.yaml'),preview=read('compose.rc2-preview.yaml');
 assert.match(compose,/^  sandforge:\s*$/m);
 assert.doesNotMatch(compose,/^  sandforge-bastion-wars:\s*$/m);
 assert.match(compose,/127\.0\.0\.1:8095:8095/);
 assert.match(preview,/127\.0\.0\.1:8106:8095/);
});

test('browser config has canonical SANDFORGE settings with legacy ATLAS aliases',()=>{
 const config=read('tests/browser/playwright.config.mjs');
 for(const key of ['BASE_URL','BROWSER_CHANNEL','TEST_DPR']){
  assert.ok(config.includes("'SANDFORGE_"+key+"'"));
  assert.ok(config.includes("'ATLAS_"+key+"'"));
 }
 assert.match(read('scripts/test-webgl-integration.mjs'),/SANDFORGE_BASE_URL:base/);
});

test('Sandforge branding and compatibility guidance remain explicit',()=>{
 const readme=read('README.md'),guide=read('docs/SANDFORGE-RENAME.md');
 const instructions=read('CODEX_PROMPT.md');
 assert.match(readme,/^# SANDFORGE: BASTION WARS/m);
 assert.match(readme,/docs\/SANDFORGE-RENAME\.md/);
 assert.match(guide,/IndexedDB/);
 assert.match(guide,/kein Release/i);
 assert.match(instructions,/Sandforge: Bastion Wars/);
 assert.doesNotMatch(instructions,/Natural-Earth-Topografie/);
});
