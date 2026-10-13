import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('RTS military overview exposes stable actual-force counters',()=>{
 for(const id of ['rtsMilitaryMobile','rtsMilitaryField','rtsMilitaryLosses',
   'rtsMilitarySelected','rtsMilitaryStatus','rtsMilitaryReports']){
   assert.match(html,new RegExp('id="'+id+'"'));
   assert.ok(main.includes("'"+id+"'"),id+' must be populated');
 }
 assert.match(main,/game\.squads\.filter\(u=>u\.owner===0\)/);
});

test('classic command DOM remains available while hidden only in RTS mode',()=>{
 for(const id of ['attackRatio','attackPreview','borderDefense','borderHotspots'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/\.rts-military-mode \.attack-control\{display:none\}/);
 assert.match(css,/\.rts-military-mode \.front-command/);
 assert.match(css,/\.rts-military-mode \.rts-military-panel\{display:grid/);
});
