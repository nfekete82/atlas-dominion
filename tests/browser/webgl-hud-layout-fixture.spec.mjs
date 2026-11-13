import {test,expect} from '@playwright/test';
import {installClassicHud} from '../../scripts/webgl-classic-hud.js';
import {mkdir} from 'node:fs/promises';

async function fixture(page,width,height){
 await page.setViewportSize({width,height});
 // Load the exact shipping CSS and real WebGL menu document without
 // launching an expensive software-rendered terrain scene.
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.getElementById('main-dialog')?.close());
 await page.addScriptTag({content:'('+installClassicHud.toString()+')()'});
 await page.evaluate(()=>{
  const kinds=['headquarters','barracks','factory','airfield','generator','wall','turret','research','silo'];
  const names=['Feldkommando','Kaserne','Fahrzeugfabrik','Flugfeld','Energiekern','Sperrmauer','Geschützturm','Forschungszentrum','Langstrecken-Raketensilo'];
  const prices=[300,200,350,450,150,60,175,950,5000];
  // A lightweight genuine building preview fixture; the shipping game
  // populates identical card markup with the real GLB portrait loader.
  const cards=kinds.map((kind,i)=>'<button type="button" class="catalog-card" data-build="'+kind+'">'+
   '<span class="sf-card-image"><img src="/src/assets/reborn/buildings-3d/'+kind+'-0.png" alt=""></span>'+
   '<span class="card-meta"><span class="card-name">'+names[i]+'</span><span class="card-cost">'+prices[i]+'</span></span></button>').join('');
  document.querySelector('#sf-actions').innerHTML='<div class="sf-group" data-sf-group="buildings"><div class="catalog-grid" style="--sf-building-count:9">'+cards+'</div></div>'+
   '<div class="sf-group" data-sf-group="infantry"><div class="sf-roster-section"><h2>KASERNE</h2><div class="catalog-grid">'+cards+'</div></div></div>'+
   '<div class="sf-group" data-sf-group="vehicles"><div class="sf-roster-section"><h2>FAHRZEUGFABRIK</h2><div class="catalog-grid">'+cards+'</div></div></div>'+
   '<div class="sf-group" data-sf-group="aircraft"><div class="sf-roster-section"><h2>FLUGFELD</h2><div class="catalog-grid">'+cards+'</div></div></div>'+
   '<div class="sf-group" data-sf-group="research"><div class="sf-research-grid">Forschung</div></div>';
  document.querySelector('[data-tab="units"]').disabled=false;
  document.querySelector('[data-tab="research"]').disabled=false;
  document.querySelector('#sf-classic-root').addEventListener('sandforge-tabchange',event=>{
   document.querySelector('#sf-unit-categories').hidden=event.detail.tab!=='units';
  });
  const map=document.querySelector('#sf-map'),c=map.getContext('2d');
  c.fillStyle='#b17c51';c.fillRect(0,0,map.width,map.height);
  c.fillStyle='#a58a62';c.fillRect(20,25,180,180);
  c.fillStyle='#2677b5';c.fillRect(35,62,33,37);
  c.fillStyle='#c05241';c.fillRect(155,125,30,24);
  c.fillStyle='#f3dec2';c.beginPath();c.arc(120,94,7,0,Math.PI*2);c.fill();
 });
}
const box=(selector)=>{const r=document.querySelector(selector).getBoundingClientRect();
 return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};

test('shipping HUD occupies reference screenshot positions at 1600×900',async({page})=>{
 await fixture(page,1600,900);
 const state=await page.evaluate(fn=>{
  const bounds=(s)=>{const r=document.querySelector(s).getBoundingClientRect();
   return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return {dock:bounds('#sidebar'),map:bounds('.radar'),quick:bounds('.sf-modern-side-actions'),
   deck:bounds('#sidebar .catalog'),resource:bounds('.top.hud'),brand:bounds('.sf-modern-brand'),
   cards:[...document.querySelectorAll('[data-sf-group="buildings"] .catalog-card')].map(e=>{
    const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}),
   scrollWidth:document.documentElement.scrollWidth};
 });
 expect(state.dock.y).toBeGreaterThan(590);
 expect(state.dock.bottom).toBeLessThanOrEqual(903);
 expect(state.map.right).toBeLessThanOrEqual(state.quick.x+5);
 expect(state.quick.right).toBeLessThanOrEqual(state.deck.x+5);
 expect(state.deck.width).toBeGreaterThan(900);
 expect(state.resource.x).toBeGreaterThan(900);
 expect(state.brand.right).toBeLessThan(state.resource.x);
 expect(state.cards).toHaveLength(9);
 await expect(page.locator('.sf-modern-side-actions > button')).toHaveCount(3);
 const style=await page.evaluate(()=>{
  const grid=document.querySelector('[data-sf-group="buildings"] > .catalog-grid');
  const first=grid.querySelector('.catalog-card'),second=grid.querySelectorAll('.catalog-card')[1];
  return {display:getComputedStyle(grid).display,
   columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
   firstBorder:getComputedStyle(first).borderTopWidth,
   firstBg:getComputedStyle(first).backgroundColor,
   firstWidth:first.getBoundingClientRect().width,
   secondWidth:second.getBoundingClientRect().width};
 });
 expect(style.display).toBe('grid');
 // An implicit-column grid may report either `none` or resolved track sizes.
 expect(style.firstBorder).toBe('0px');
 expect(style.firstWidth).toBeGreaterThan(130);
 expect(Math.abs(style.firstWidth-style.secondWidth)).toBeLessThan(2);
 expect(state.cards[1].x).toBeGreaterThan(state.cards[0].x);
 expect(state.cards[8].x).toBeGreaterThan(state.cards[7].x);
 // The ninth building MUST NOT wrap under the first eight.
 expect(Math.abs(state.cards[8].y-state.cards[0].y)).toBeLessThan(2);
 expect(Math.abs(state.cards[8].h-state.cards[0].h)).toBeLessThan(2);
 const panelStyle=await page.evaluate(()=>{
  const el=document.querySelector('#sf-actions');
  const bg=getComputedStyle(el).backgroundColor;
  return {background:bg,border:getComputedStyle(el).borderTopWidth};
 });
 expect(panelStyle.border).toBe('0px');
 expect(panelStyle.background).toMatch(/^rgba\(/);
 // New visual tuning: the CSS must remove the legacy .frame::after gold
 // stripe and keep the thumbnail/text comfortably below their old size.
 const compact=await page.evaluate(()=>{
  const card=document.querySelector('[data-sf-group="buildings"] .catalog-card');
  const img=card.querySelector('.sf-card-image img');
  const name=card.querySelector('.card-name');
  const price=card.querySelector('.card-cost');
  const meta=card.querySelector('.card-meta');
  return {
   lineContent:getComputedStyle(document.querySelector('#sidebar > .catalog'),'::after').content,
   lineDisplay:getComputedStyle(document.querySelector('#sidebar > .catalog'),'::after').display,
   imageScale:new DOMMatrixReadOnly(getComputedStyle(img).transform).a,
   nameFont:parseFloat(getComputedStyle(name).fontSize),
   priceFont:parseFloat(getComputedStyle(price).fontSize),
   metaHeight:meta.getBoundingClientRect().height
  };
 });
 expect(compact.lineDisplay).toBe('none');
 expect(compact.lineContent).toBe('none');
 expect(compact.imageScale).toBeLessThanOrEqual(1.11);
 expect(compact.nameFont).toBeLessThanOrEqual(11);
 expect(compact.priceFont).toBeLessThanOrEqual(14);
 expect(compact.metaHeight).toBeLessThanOrEqual(45);
 const labels=await page.evaluate(()=>[...document.querySelectorAll('[data-sf-group="buildings"] .card-name')].map(el=>{
  const rect=el.getBoundingClientRect();
  const tile=el.closest('.catalog-card').getBoundingClientRect();
  return {name:el.textContent,boxWidth:rect.width,scrollWidth:el.scrollWidth,
   left:rect.left,right:rect.right,tileLeft:tile.left,tileRight:tile.right,
   whiteSpace:getComputedStyle(el).whiteSpace};
 }));
 for(const label of labels){
  expect(label.whiteSpace).toBe('normal');
  expect(label.left).toBeGreaterThanOrEqual(label.tileLeft-1);
  expect(label.right).toBeLessThanOrEqual(label.tileRight+1);
  expect(label.scrollWidth).toBeLessThanOrEqual(label.boxWidth+2);
 }
 expect(state.cards[0].h).toBeGreaterThan(120);
 expect(state.scrollWidth).toBeLessThanOrEqual(1605);
 await expect(page.locator('#sf-tools')).toBeHidden();
 await page.locator('#sf-hud-menu-toggle').click();
 await expect(page.locator('#sf-tools')).toBeVisible();
 await page.locator('#sf-hud-tools-toggle').click();
 await expect(page.locator('#sf-tools')).toBeHidden();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 await page.locator('#sf-modern-queue').click();
 await expect(page.locator('#sf-production')).toBeVisible();
 await expect(page.locator('#sf-selection-panel')).toBeHidden();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 await expect(page.locator('#sf-production')).toBeHidden();
 await page.locator('#sf-tabs [data-tab="units"]').click();
 await expect(page.locator('#sf-unit-categories')).toBeVisible();
 await page.locator('[data-sf-unit-category="vehicles"]').click();
 expect(await page.locator('#sf-classic-root').getAttribute('data-unit-category')).toBe('vehicles');
 await page.locator('#sf-tabs [data-tab="buildings"]').click();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeHidden();
 await mkdir('tests/browser/artifacts',{recursive:true});
 await page.screenshot({path:'tests/browser/artifacts/webgl-hud-fixture-1600.png'});
});

test('responsive HUD fits the viewport and retains drawer access at 820px',async({page})=>{
 await fixture(page,820,720);
 const result=await page.evaluate(()=>{
  const r=id=>{const e=document.querySelector(id).getBoundingClientRect();
   return {x:e.x,y:e.y,right:e.right,bottom:e.bottom,width:e.width,height:e.height};};
  return {dock:r('#sidebar'),radar:r('.radar'),quick:r('.sf-modern-side-actions'),deck:r('#sidebar .catalog')};
 });
 expect(result.dock.right).toBeLessThanOrEqual(821);
 expect(result.radar.width).toBeGreaterThan(90);
 expect(result.quick.right).toBeLessThanOrEqual(result.deck.x+5);
 expect(result.deck.width).toBeGreaterThan(350);
 const scroll=await page.evaluate(()=>{
  const el=document.querySelector('#sf-actions'),cards=[...document.querySelectorAll('[data-sf-group="buildings"] .catalog-card')];
  return {scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
   firstY:cards[0].getBoundingClientRect().top,lastY:cards.at(-1).getBoundingClientRect().top,
   firstX:cards[0].getBoundingClientRect().x,lastX:cards.at(-1).getBoundingClientRect().x};
 });
 expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
 expect(Math.abs(scroll.firstY-scroll.lastY)).toBeLessThan(2);
 expect(scroll.lastX).toBeGreaterThan(scroll.firstX);
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeHidden();
 await mkdir('tests/browser/artifacts',{recursive:true});
 await page.screenshot({path:'tests/browser/artifacts/webgl-hud-fixture-820.png'});
});
