import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('index.html','utf8');
const game=readFileSync('src/reborn/main.ts','utf8');
const branding=readFileSync('src/assets/reborn/sandforge-brand.js','utf8');

test('Sandforge branding: no retired titles or map names remain in active UI',()=>{
 for(const [name,source] of [['index.html',html],['src/reborn/main.ts',game],['sandforge-brand.js',branding]]){
  assert.doesNotMatch(source,/ATLAS\s*<b>DOMINION<\/b>|ATLAS DOMINION|\bARIDIS\b/i,name);
 }
 assert.match(html,/<title>Sandforge: Bastion Wars<\/title>/);
 assert.match(html,/SANDFORGE \/\/ BASTION WARS/);
 assert.match(html,/SANDFORGE \/ WÜSTENFRONT/);
 assert.match(game,/Sandforge gesichert\./);
 assert.match(branding,/sandforge-logo-transparent\.webp/);
});

test('Sandforge handbook: current capture and construction mechanics are documented',()=>{
 const handbook=html.match(/<p class="help-note">([\s\S]*?)<\/p>/)?.[1];
 assert.ok(handbook,'the actual game help section must remain available');
 assert.match(handbook,/ein eigener Nachbarsektor ist nicht erforderlich/);
 assert.match(handbook,/ungeschützte feindliche Bastionen in 5 Sekunden/);
 assert.match(handbook,/verteidigte in 8 Sekunden/);
 assert.match(handbook,/intakten feindlichen Hauptquartier/);
 assert.match(handbook,/die gesamte Baufläche bereits erkundet/);
 assert.match(handbook,/Rechtsklick auf freien Boden unterbricht laufende Bau- und Reparaturaufträge nicht/);
 assert.doesNotMatch(handbook,/Nur Gebiete neben eigenem Territorium/);
 assert.doesNotMatch(handbook,/im Nebel liegende Gebiete sind bebaubar/);
});

test('Sandforge controls remain wired after branding and help cleanup',()=>{
 for(const id of ['world','minimap','new','resume','save','load','help','pause','main-dialog','help-dialog']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(html,/src="\/src\/assets\/reborn\/sandforge-brand\.js"/);
 assert.match(html,/src="\/src\/reborn\/main\.js"/);
});
