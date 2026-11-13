import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalCatalogAvailability} from '../scripts/webgl-global-catalog.js';

const read=path=>readFileSync(path,'utf8');

test('the 3D game ships screenshot-inspired HUD after the legacy stylesheet',()=>{
 const page=read('dist/webgl-preview.html');
 assert.match(page,/href="\/webgl-classic-hud\.css"/);
 assert.match(page,/href="\/webgl-hud-showcase\.css"/);
 assert.ok(page.indexOf('webgl-hud-showcase.css')>page.indexOf('webgl-classic-hud.css'));
 const stylesheet=read('dist/webgl-hud-showcase.css');
 for(const selector of ['.sf-modern-brand','#sf-modern-queue-count',
   '#sf-tabs','.sf-modern-unit-categories','#sf-actions .catalog-card'])
  assert.ok(stylesheet.includes(selector),'HUD style missing '+selector);
 // Tactical redesign stays CSS-only, preserves card IDs and is 3D-specific.
 assert.match(stylesheet,/Sandforge tactical HUD v4/);
 assert.match(stylesheet,/--sf-hud-h:clamp\(116px,14vh,134px\)/);
 assert.ok(stylesheet.includes('background:rgba(19,23,24,.86)'));
 assert.ok(stylesheet.includes('border-left:1px solid rgba(224,205,170,.23)'));
 assert.ok(!read('dist/classic.html').includes('webgl-hud-showcase.css'),
  'classic Canvas UI must not inherit the 3D skin');
});

test('the interactive HUD retains real resource, button and action IDs',()=>{
 const hud=read('dist/webgl-classic-hud.js');
 for(const id of ['sf-credits','sf-income','sf-capacity','sf-map','sf-actions',
  'sf-production','sf-selection-panel','sf-hud-menu-toggle','sf-hud-tools-toggle',
  'sf-modern-selection','sf-modern-queue','sf-modern-focus'])
  assert.ok(hud.includes(id),'missing real HUD control '+id);
 assert.match(hud,/data-tab="units"/);
 assert.match(hud,/data-tab="research"/);
 assert.match(hud,/data-sf-unit-category="vehicles"/);
});

test('the combined Units tab unlocks from completed facilities only',()=>{
 const game={bases:[]};
 assert.deepEqual(globalCatalogAvailability(game),{
  buildings:true,units:false,infantry:false,vehicles:false,
  aircraft:false,research:false,territories:true
 });
 game.bases.push({owner:0,hp:800,kind:'factory',buildRemaining:10});
 assert.equal(globalCatalogAvailability(game).units,false);
 game.bases[0].buildRemaining=0;
 assert.equal(globalCatalogAvailability(game).units,true);
 assert.equal(globalCatalogAvailability(game).infantry,false);
 assert.equal(globalCatalogAvailability(game).vehicles,true);
 game.bases[0].hp=0;
 assert.equal(globalCatalogAvailability(game).units,false);
 game.bases.push({owner:1,hp:900,kind:'headquarters',buildRemaining:0});
 assert.equal(globalCatalogAvailability(game).units,false);
 game.bases.push({owner:0,hp:900,kind:'research',buildRemaining:0});
 assert.equal(globalCatalogAvailability(game).research,true);
 assert.equal(globalCatalogAvailability(game).units,false);
});
