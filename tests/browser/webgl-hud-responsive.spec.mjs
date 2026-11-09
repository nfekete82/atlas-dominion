import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {installClassicHud} from '../../scripts/webgl-classic-hud.js';

/**
 * Layout contract: use the actual production HUD installer and shipped CSS,
 * but no WebGL renderer. CI's software GPU cannot distort these measurements.
 */
test('one full-width tactical dock contains minimap, catalog, production and commands',async({page})=>{
 test.setTimeout(30000);
 const dummy=['rotate-left','rotate-right','home','sound','simulation',
  'clock','fps','bastions','seed','load','status','error'];
 await page.setViewportSize({width:1600,height:900});
 await page.setContent('<main id="fixture">'+dummy.map(id=>
  '<button id="'+id+'">'+id+'</button>').join('')+'</main>');
 for(const path of ['dist/style.css','dist/retro-desert.css','dist/webgl-classic-hud.css'])
  await page.addStyleTag({content:readFileSync(path,'utf8')});
 await page.addScriptTag({content:'('+installClassicHud.toString()+')();'});
 await page.evaluate(()=>{
  const panel=document.querySelector('#sf-classic-root'),catalog=panel.querySelector('#sf-actions');
  panel.dataset.tab='buildings';
  const cards=Array.from({length:6},(_,i)=>'<button class="catalog-card" data-build="headquarters">'+
   '<span class="sf-card-image"><img alt="" src="data:," /></span>'+
   '<span class="card-meta"><span class="card-name">Gebäude '+i+'</span>'+
   '<span class="card-cost">750</span></span></button>').join('');
  catalog.innerHTML='<section class="sf-group" data-sf-group="buildings"><div class="catalog-grid">'+cards+'</div></section>';
  panel.querySelector('#sf-queue-slots').innerHTML=Array.from({length:8},(_,i)=>
   '<div class="sf-production-slot" data-queue-index="'+i+'">'+
   '<img alt="" src="data:," /><span class="sf-production-slot-copy">'+
   '<strong>Auftrag '+i+'</strong><small>50 %</small></span>'+
   '<span class="sf-slot-progress"><i style="width:50%"></i></span></div>').join('');
 });
 const measure=()=>page.evaluate(()=>{
  const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();
   return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const prod=document.querySelector('#sf-production');
  const scroller=prod.querySelector('.sf-production-slots');
  return {dock:rect('#sidebar'),radar:rect('#sidebar .radar'),
   catalog:rect('#sidebar .catalog'),production:rect('#sf-production'),
   command:rect('#sf-selection-panel'),queueScroller:rect('#sf-queue-slots'),
   parentId:prod.parentElement.id,
   commandParentId:document.querySelector('#sf-selection-panel').parentElement.id,
   queueOverflowY:getComputedStyle(scroller).overflowY,
   queueOverflowX:getComputedStyle(scroller).overflowX,
   queueAxis:getComputedStyle(scroller).flexDirection,
   catalogCards:document.querySelectorAll('.catalog-card').length,
   queueCards:document.querySelectorAll('.sf-production-slot').length};
 });
 for(const width of [1600,1440,1250]){
  await page.setViewportSize({width,height:900});
  const v=await measure();
  expect(v.parentId).toBe('sidebar');
  expect(v.dock.height).toBeGreaterThanOrEqual(260);
  expect(v.dock.height).toBeLessThanOrEqual(282);
  expect(v.dock.x).toBeLessThanOrEqual(10);
  expect(v.dock.right).toBeGreaterThanOrEqual(width-10);
  expect(v.commandParentId).toBe('sidebar');
  expect(v.radar.right).toBeLessThanOrEqual(v.catalog.x+2);
  expect(v.catalog.right).toBeLessThanOrEqual(v.production.x+2);
  expect(v.production.right).toBeLessThanOrEqual(v.command.x+2);
  expect(v.command.right).toBeLessThanOrEqual(v.dock.right+2);
  expect(v.production.bottom).toBeLessThanOrEqual(v.dock.bottom+1);
  expect(v.queueAxis).toBe('column');
  expect(v.queueOverflowY).toBe('auto');
  expect(v.catalogCards).toBe(6);
  expect(v.queueCards).toBe(8);
  expect(v.production.width).toBeGreaterThan(190);
 }
 await page.setViewportSize({width:820,height:720});
 const narrow=await measure();
 expect(narrow.parentId).toBe('sidebar');
 expect(narrow.commandParentId).toBe('sidebar');
 expect(narrow.production.y).toBeGreaterThanOrEqual(narrow.catalog.y-2);
 expect(narrow.production.bottom).toBeLessThanOrEqual(narrow.dock.bottom+1);
 expect(narrow.production.right).toBeLessThanOrEqual(narrow.command.x+2);
 expect(narrow.command.right).toBeLessThanOrEqual(narrow.dock.right+2);
 expect(narrow.queueAxis).toBe('column');
 expect(narrow.queueOverflowY).toBe('auto');
});
