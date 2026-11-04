import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const pageUrl='/webgl-preview.html?bastions=4&seed=2074&lite=1';
test('Playable 3D: assets, terrain, fog, units, buildings, minimap and production UI',async({page})=>{
 test.setTimeout(110000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 await expect(page.locator('#sf-stats')).toContainText('Credits');
 await expect(page.locator('#sf-actions')).toContainText('SEKTOR');
 const before=await page.evaluate(()=>{
  const {battlefield,game}=window.__sandforgeWebGL;
  return {
   unitCount:battlefield.units.size,baseCount:battlefield.bases.size,
   sectors:battlefield.bastions.size,worldSectors:game.territories.length,
   fogMeshes:battlefield.fogNodes.length,textureWidth:battlefield.fogTexture.image.width,
   fps:window.__sandforgeWebGL.renderer.info.render.frame
  };
 });
 expect(before.unitCount).toBeGreaterThanOrEqual(4);
 expect(before.baseCount).toBe(0);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.needsHeadquarters(0))).toBe(true);
 expect(before.sectors).toBe(4);
 expect(before.worldSectors).toBe(4);
 // Fog overlays only the 16 playable chunks. Decorative terrain is outside
 // the authoritative map and fades naturally into the black background.
 expect(before.fogMeshes).toBe(16);
 expect(before.textureWidth).toBe(240);
 const initial=await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled);
 await page.locator('[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(!initial);
 await page.evaluate(()=>{window.__stableCommandButton=document.querySelector('[data-action="select-all"]');});
 await page.waitForTimeout(900);
 expect(await page.evaluate(()=>document.querySelector('[data-action="select-all"]')===window.__stableCommandButton)).toBe(true);
 await page.locator('[data-action="select-all"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.selected.size)).toBeGreaterThan(0);
 await page.locator('[data-tab="buildings"]').click();
 await expect(page.locator('[data-sf-group="buildings"]')).toBeVisible();
 await expect(page.locator('[data-sf-group="units"]')).toBeHidden();
 await expect(page.locator('[data-build="barracks"]')).toBeDisabled();
 await expect(page.locator('[data-build="factory"]')).toBeDisabled();
 await expect(page.locator('[data-build="headquarters"]')).toBeEnabled();
 await expect(page.locator('[data-build="barracks"]')).toHaveAttribute('title',/Hauptquartier/);
 await page.locator('[data-build="headquarters"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildKind)).toBe('headquarters');
 await page.locator('[data-action="cancel"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildKind)).toBe(null);
 expect(errors).toEqual([]);
 await mkdir(fileURLToPath(new URL('./artifacts/',import.meta.url)),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('./artifacts/webgl-playable.png',import.meta.url)),fullPage:true});
});

test('Playable 3D: save and resume hold authoritative combat and economy state',async({page})=>{
 test.setTimeout(110000);
 await page.goto(pageUrl+'&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const initial=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  g.paused=false;for(let i=0;i<24;i++)g.step(.05);g.paused=true;
  return {time:g.time,credits:g.credits[0],units:g.units.length,mapVersion:g.world.mapVersion};
 });
 await page.locator('[data-action="save"]').click();
 await expect(page.locator('#sf-message')).toContainText('gespeichert');
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&resume=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const after=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  return {time:g.time,credits:g.credits[0],units:g.units.length,mapVersion:g.world.mapVersion};
 });
 expect(after).toEqual(initial);
});

test('3D RTS: mouse drag rectangle selects owned units without interfering with camera or HUD',async({page})=>{
 test.setTimeout(105000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const target=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  const unit=a.game.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  const entry=a.battlefield.units.get(unit.id);
  const delta=entry.node.position.clone().sub(a.controls.target);
  a.controls.target.add(delta);a.camera.position.add(delta);a.controls.update();
  const p=entry.node.position.clone().project(a.camera);
  const rect=a.renderer.domElement.getBoundingClientRect();
  return {id:unit.id,x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(.5-p.y*.5)*rect.height};
 });
 expect(target.x).toBeGreaterThan(100);
 expect(target.y).toBeGreaterThan(110);
 await page.mouse.move(target.x-65,target.y-65);
 await page.mouse.down();
 await page.mouse.move(target.x+65,target.y+65,{steps:8});
 await page.mouse.up();
 const result=await page.evaluate(id=>({
  selected:window.__sandforgeWebGL.battlefield.selected.has(id),
  boxHidden:window.__sandforgeWebGL.battlefield.selectionBox.style.display==='none'
 }),target.id);
 expect(result.selected).toBe(true);
 expect(result.boxHidden).toBe(true);
});

test('3D RTS: original-style HUD starts live and a real right click moves selected units',async({page})=>{
 test.setTimeout(115000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 await expect(page.locator('.sf-rts .top .wordmark')).toContainText('SANDFORGE');
 await expect(page.locator('#sidebar .catalog-tabs')).toBeVisible();
 await expect(page.locator('#sidebar .radar')).toBeVisible();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game;
  const u=g.units.find(v=>v.owner===0&&v.kind==='infantry'&&v.hp>0);
  if(!u)throw new Error('Starting infantry not found');
  const origin={x:u.x,y:u.y};
  let point=null;
  for(const distance of [180,230,290,350,420]){
   if(point)break;
   for(let i=0;i<16;i++){
    const angle=i*Math.PI/8;
    const p={x:u.x+Math.cos(angle)*distance,y:u.y+Math.sin(angle)*distance};
    if(!g.world.walkable(p,g.obstacles()))continue;
    const path=g.world.path(u,p,g.obstacles());
    if(path.length&&Math.hypot(path.at(-1).x-p.x,path.at(-1).y-p.y)<70){point=p;break;}
   }
  }
  if(!point)throw new Error('No safe nearby marching destination found');
  const target=a.battlefield.pos(point.x,point.y);
  const viewport=a.renderer.domElement.getBoundingClientRect();
  const cameraCenter=a.battlefield.pos(u.x,u.y),delta=cameraCenter.clone().sub(a.controls.target);
  a.controls.target.add(delta);a.camera.position.add(delta);a.controls.update();
  target.project(a.camera);
  return {id:u.id,origin,point,
   x:viewport.left+(target.x*.5+.5)*viewport.width,
   y:viewport.top+(.5-target.y*.5)*viewport.height,
   running:a.simulationRunning,paused:g.paused};
 });
 expect(state.running).toBe(true);
 expect(state.paused).toBe(false);
 expect(state.x).toBeGreaterThan(50);
 expect(state.x).toBeLessThan(1100);
 expect(state.y).toBeGreaterThan(90);
 expect(state.y).toBeLessThan(770);
 await page.locator('[data-action="select-all"]').click();
 await page.mouse.click(state.x,state.y,{button:'right'});
 const pulse=await page.evaluate(()=>{
  const p=window.__sandforgeWebGL.battlefield.commandPulse;
  return {visible:p.visible,opacity:p.material.opacity,position:p.position.clone().toArray()};
 });
 expect(pulse.visible).toBe(true);
 expect(pulse.opacity).toBeGreaterThan(.3);
 await expect(page.locator('#sf-message')).toContainText('Marsch');
 await page.waitForFunction(()=>!window.__sandforgeWebGL.battlefield.commandPulse.visible,
   null,{timeout:4000});
 await page.waitForFunction(({id,origin})=>{
  const u=window.__sandforgeWebGL.game.units.find(x=>x.id===id);
  return u&&Math.hypot(u.x-origin.x,u.y-origin.y)>12;
 },{id:state.id,origin:state.origin},{timeout:14000});
 expect(errors).toEqual([]);
});

test('WebGL menu v2: every tab isolates its content and unit sprites become proper portraits',async({page})=>{
 test.setTimeout(110000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 await expect(page.locator('[data-sf-group="units"]')).toBeHidden();
 await expect(page.locator('[data-sf-group="buildings"]')).toBeHidden();
 await expect(page.locator('[data-sf-group="territories"]')).toBeVisible();
 await expect(page.locator('[data-tab="units"]')).toBeHidden();
 await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const engineer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  b.selected=new Set([engineer.id]);b.selectedBase=null;b.drawInterface();
 });
 await expect(page.locator('[data-sf-group="buildings"]')).toBeVisible();
 await expect(page.locator('[data-tab="buildings"]')).toBeVisible();
 await page.waitForFunction(()=>{
  const icons=[...document.querySelectorAll('img[data-sf-unit-icon]')];
  return icons.length===9&&icons.every(i=>i.dataset.sfIconStatus==='ready'&&i.naturalWidth===192&&i.naturalHeight===132);
 },{timeout:60000});
 const icon=await page.locator('img[data-sf-unit-icon="infantry"]').getAttribute('src');
 expect(icon).toMatch(/^data:image\/png;base64,/);
 await expect(page.locator('[data-build="headquarters"]')).toBeVisible();
 await page.locator('[data-tab="territories"]').click();
 await expect(page.locator('[data-sf-group="buildings"]')).toBeHidden();
 await expect(page.locator('[data-sf-group="territories"]')).toBeVisible();
 await expect(page.locator('[data-territory="0"]')).toBeVisible();
 await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ site');
  const building=g.build(0,'headquarters',site);
  if(!building)throw Error('Could not build HQ');
  building.buildRemaining=0;building.hp=1200;
  b.selected.clear();b.selectedBase=building.id;
  b.sync(true,.06,false,1);b.drawInterface();
 });
 await expect(page.locator('[data-sf-group="units"]')).toBeVisible();
 await expect(page.locator('[data-sf-producer="headquarters"]')).toBeVisible();
 await expect(page.locator('[data-sf-producer="barracks"]')).toBeHidden();
 await expect(page.locator('[data-unit="engineer"]')).toBeVisible();
 await expect(page.locator('[data-unit="infantry"]')).toBeHidden();
 expect(errors).toEqual([]);
 await mkdir(fileURLToPath(new URL('./artifacts/',import.meta.url)),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('./artifacts/webgl-menu-v2.png',import.meta.url)),fullPage:true});
});

test('WebGL terrain: landscape uses seamless original sand, never the building material atlas',async({page})=>{
 test.setTimeout(110000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 await page.waitForFunction(()=>{
  const mesh=window.__sandforgeWebGL.scene.children.find(o=>o.userData.terrain);
  return mesh?.material?.map?.image?.width===2048;
 },{timeout:35000});
 const map=await page.evaluate(()=>{
  const mesh=window.__sandforgeWebGL.scene.children.find(o=>o.userData.terrain);
  return {w:mesh.material.map.image.width,h:mesh.material.map.image.height,
   isCanvas:mesh.material.map.isCanvasTexture,
   hasMicroNormal:mesh.material.normalMap?.isCanvasTexture===true,
   normalWidth:mesh.material.normalMap?.image?.width};
 });
 expect(map.w).toBe(2048);
 expect(map.h).toBe(2048);
 expect(map.isCanvas).toBe(true);
 // The dedicated wind-ripple normal texture is valid; only the old building
 // material atlas (color AND normal) must never be mapped onto terrain.
 expect(map.hasMicroNormal).toBe(true);
 expect(map.normalWidth).toBe(256);
});
