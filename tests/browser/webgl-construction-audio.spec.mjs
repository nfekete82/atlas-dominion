import {test,expect} from '@playwright/test';

// The WebGL catalog now reflects the selected actor, just like a classic RTS.
async function selectEngineer(page){
 await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.hp>0&&u.kind==='engineer');
  if(!engineer)throw Error('Starting engineer missing');
  battlefield.selected=new Set([engineer.id]);
  battlefield.selectedBase=null;
  battlefield.drawInterface();
 });
}


test('3D original-style blueprint: translucent ghost, live site validation and R rotation',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await selectEngineer(page);
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="buildings"]').first().click();
 await page.locator('[data-build="headquarters"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildPreview?.userData.buildGhost)).toBe(true);
 const canvas=page.locator('#stage canvas');
 const rect=await canvas.boundingBox();expect(rect).toBeTruthy();
 await page.mouse.move(rect.x+rect.width*.44,rect.y+rect.height*.47);
 await expect(page.locator('#sf3d-build-hint')).toBeVisible();
 const ghost=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL.battlefield;
  const g=a.buildPreview;
  return {visible:g.visible,footprint:g.children.some(o=>o.geometry?.type==='RingGeometry'),
   opacity:g.children.filter(o=>o.type==='Group').some(x=>x.children.some(c=>c.material?.transparent)),
   facing:g.rotation.y,hit:!!a.terrainPoint({clientX:window.innerWidth*.44,clientY:window.innerHeight*.47})};
 });
 expect(ghost.visible).toBe(true);
 expect(ghost.footprint).toBe(true);
 // Each tap advances exactly 90°, including a full return to the
 // starting orientation. Legacy stored facing=1 still means 180°.
 for(const [facing,angle,degrees] of [
  [2,Math.PI/2,90],[1,Math.PI,180],[3,Math.PI*1.5,270],[0,0,0]
 ]){
  await page.keyboard.press('r');
  const placement=await page.evaluate(()=>{
   const b=window.__sandforgeWebGL.battlefield;
   return {facing:b.placementFacing,angle:b.buildPreview.rotation.y};
  });
  expect(placement.facing).toBe(facing);
  expect(placement.angle).toBeCloseTo(angle,5);
  await expect(page.locator('#sf3d-build-hint')).toContainText('R drehen ('+degrees+'°)');
 }
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildPreview)).toBe(null);
 await expect(page.locator('#sf3d-build-hint')).toBeHidden();
 expect(errors).toEqual([]);
});

test('3D construction: foundations, columns, rails and roof appear by actual build progress',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const stages=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No legal site for a new HQ');
  const building=g.build(0,'headquarters',site);
  if(!building)throw Error('HQ construction rejected');
  const capture=(fraction)=>{
   building.buildRemaining=(1-fraction)*20;
   b.sync(true,.06,false,1);
   const e=b.bases.get(building.id),c=e?.construction;
   if(!c)throw Error('Missing staged 3D construction');
   return {progress:fraction,post:c.columns[0].scale.y,
    top:c.roof.visible,rail0:c.rails[0].meshes[0].visible,
    rail1:c.rails[1].meshes[0].visible,
    clipped:c.materials.length>0&&c.materials.every(m=>m.clippingPlanes?.[0]===c.clip),
    label:c.lastLabel,labelWidth:c.label.scale.x,labelHeight:c.label.scale.y,
    labelOpacity:c.label.material.opacity};
  };
  const phases=[.1,.42,.82].map(capture);
  building.buildRemaining=0;building.hp=1200;b.sync(true,.06,false,1);
  const e=b.bases.get(building.id);
  return {phases,finished:e.construction===null,scale:e.node.scale.y,
   completed:g.hasHeadquarters(0)};
 });
 const [early,middle,late]=stages.phases;
 expect(early.clipped).toBe(true);
 expect(early.labelWidth).toBeLessThanOrEqual(85);
 expect(early.labelHeight).toBeLessThanOrEqual(22);
 expect(early.labelOpacity).toBeLessThanOrEqual(.9);
 expect(early.top).toBe(false);
 expect(early.rail0).toBe(false);
 expect(middle.post).toBeGreaterThan(early.post);
 expect(middle.rail0).toBe(true);
 expect(middle.rail1).toBe(false);
 expect(late.rail1).toBe(true);
 expect(late.top).toBe(true);
 expect(stages.completed).toBe(true);
 expect(stages.finished).toBe(true);
 expect(stages.scale).toBe(1);
});

test('3D audio and HUD: clicks enabled by user gesture, complete unit text, zoom and sight bonus',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const before=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  return {minZoom:a.controls.minZoom,vision:a.game.visionScale,
   audioEnabled:a.sound.enabled,
   soundState:a.sound.context?.state??'not created'};
 });
 expect(before.minZoom).toBeCloseTo(.46,2);
 expect(before.vision).toBeCloseTo(1.30,2);
 expect(before.audioEnabled).toBe(true);
 // Unit sprites remain present in the DOM but only the selected producer can show them.
 const soldier=page.locator('[data-unit="infantry"] .card-name');
 await expect(soldier).toHaveText('Infanteriesoldat');
 // All 3D unit-card names now occupy one line, with the price below.
 // Keep the entire accessible name in the DOM; only visual overflow clips.
 expect(await soldier.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
 const artillery=page.locator('[data-unit="artillery"]');
 await expect(artillery.locator('.card-name')).toHaveText('Raketenwerfer');
 expect(await artillery.locator('.card-name').evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
 expect(await artillery.locator('.card-cost')).toHaveText('600');
 await selectEngineer(page);
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="buildings"]').first().click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.sound?.context?.state==='running',{timeout:20000});
 expect(await page.evaluate(()=>window.__sandforgeWebGL.sound.enabled)).toBe(true);
});

test('Audio resumes after suspension; locked production stays legible; interrupted 3D work gets reassigned',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await selectEngineer(page);
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="buildings"]').first().click();
 await expect(page.locator('[data-build="barracks"]')).toBeDisabled();
 const filter=await page.locator('[data-build="barracks"] .sf-card-image img')
   .evaluate(el=>({filter:getComputedStyle(el).filter,opacity:getComputedStyle(el).opacity}));
 // Unavailable building thumbnails are intentionally dimmed and softly
 // blurred. Text and costs stay sharp and the button must not look selected.
 const muted=filter.filter.match(/grayscale\(([0-9.]+)\)/);
 const blur=filter.filter.match(/blur\(([0-9.]+)px\)/);
 expect(muted).not.toBeNull();
 expect(Number(muted[1])).toBeGreaterThanOrEqual(.65);
 expect(blur).not.toBeNull();
 expect(Number(blur[1])).toBeGreaterThan(0);
 expect(Number(blur[1])).toBeLessThanOrEqual(1);
 expect(Number(filter.opacity)).toBeGreaterThanOrEqual(.65);
 const locked=await page.locator('[data-build="barracks"]').evaluate(el=>({
  selected:el.classList.contains('sf-selected-build'),
  name:getComputedStyle(el.querySelector('.card-name')).filter,
  price:getComputedStyle(el.querySelector('.card-cost')).filter,
  reason:el.getAttribute('aria-description')||el.title
 }));
 expect(locked.selected).toBe(false);
 expect(locked.name).toBe('none');
 expect(locked.price).toBe('none');
 expect(locked.reason.length).toBeGreaterThan(0);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.sound?.context?.state==='running',{timeout:20000});
 await page.evaluate(()=>window.__sandforgeWebGL.sound.context.suspend());
 await page.waitForFunction(()=>window.__sandforgeWebGL.sound.context.state==='suspended');
 // The next real pointer interaction is a permitted autoplay-unlock gesture.
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="territories"]').first().click();
 await page.waitForFunction(()=>window.__sandforgeWebGL.sound.context.state==='running',{timeout:15000});
 const recovered=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,repair=a.constructionRecovery;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  const base=g.build(0,'headquarters',site);
  if(!base)throw Error('Cannot commission HQ');
  const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  repair.tick(); // Capture the original worker ID.
  worker.orders=[];worker.path=[];worker.repath=0;
  g.time+=4.4;repair.tick();
  return {working:worker.orders[0]?.kind,target:worker.orders[0]?.target,baseId:base.id,
   restored:repair.recovered,remaining:base.buildRemaining};
 });
 expect(recovered.restored).toBe(1);
 expect(recovered.working).toBe('build');
 expect(recovered.target).toBe(recovered.baseId);
 expect(recovered.remaining).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('3D placement overlay is drawn in a separate foreground pass after black fog and rocks',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await selectEngineer(page);
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="buildings"]').first().click();
 await page.locator('[data-build="headquarters"]').click();
 const canvas=page.locator('#stage canvas'),r=await canvas.boundingBox();
 await page.mouse.move(r.x+r.width*.47,r.y+r.height*.47);
 const result=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,b=a.battlefield,ghost=b.buildPreview;
  return {ghostVisible:ghost?.visible,
   foregroundScene:ghost?.parent===b.buildPreviewScene,
   absentFromWorld:!a.scene.children.includes(ghost),
   lightCount:b.buildPreviewScene.children.filter(x=>x.isLight).length,
   transparent:(()=>{
    const meshes=[];
    ghost.traverse(node=>{if(node.isMesh)meshes.push(node);});
    return meshes.length>0&&meshes.every(node=>{
      const materials=Array.isArray(node.material)?node.material:[node.material];
      return materials.length>0&&materials.every(m=>
        m?.transparent===true&&m.depthTest===false&&m.depthWrite===false
      );
    });
   })(),
   stage:a.renderer.domElement.width};
 });
 expect(result.ghostVisible).toBe(true);
 expect(result.foregroundScene).toBe(true);
 expect(result.absentFromWorld).toBe(true);
 expect(result.lightCount).toBeGreaterThanOrEqual(2);
 expect(result.transparent).toBe(true);
 expect(result.stage).toBeGreaterThan(400);
 expect(errors).toEqual([]);
});

test('Space opens original Sandforge pause dialog even with units selected and resumes on second Space',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const wasRunning=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  a.battlefield.selected=new Set(a.game.units.filter(x=>x.owner===0).map(u=>u.id));
  return a.simulationRunning;
 });
 expect(wasRunning).toBe(true);
 await page.keyboard.press('Space');
 await expect(page.locator('#sf3d-pause-dialog')).toBeVisible();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(false);
 await expect(page.locator('#sf3d-pause-dialog .pause-scene')).toBeVisible();
 await page.keyboard.press('Space');
 await expect(page.locator('#sf3d-pause-dialog')).toBeHidden();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
});

test('3D audio settings can be enabled again and the user can play an audible test',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await page.locator('[data-action="menu"]').click();
 await page.locator('#sf3d-pause-options').click();
 await expect(page.locator('#sf3d-options-dialog')).toBeVisible();
 await page.locator('#sf3d-sound').uncheck();
 await page.locator('#sf3d-options-save').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.sound.enabled)).toBe(false);
 await page.locator('#sf3d-pause-options').click();
 await page.locator('#sf3d-sound').check();
 await page.locator('#sf3d-audio-test').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.sound?.context?.state==='running',{timeout:15000});
 await expect(page.locator('#sf3d-audio-status')).toContainText('Soundtest gespielt');
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  return {enabled:a.sound.enabled,volume:a.sound.volume,commands:a.sound.played.commands,state:a.sound.context.state};
 });
 expect(state.enabled).toBe(true);
 expect(state.volume).toBeGreaterThanOrEqual(.85);
 expect(state.commands).toBeGreaterThanOrEqual(1);
 expect(state.state).toBe('running');
});

test('R cycles through all four cardinal placements for every 3D building type',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 for(const kind of ['headquarters','barracks','factory','airfield','generator','turret']){
  await page.evaluate(kind=>window.__sandforgeWebGL.battlefield.beginPlacement(kind),kind);
  for(const [stored,angle] of [[2,Math.PI/2],[1,Math.PI],[3,Math.PI*1.5],[0,0]]){
   await page.keyboard.press('r');
   const state=await page.evaluate(()=>{
    const b=window.__sandforgeWebGL.battlefield;
    return {facing:b.placementFacing,rotation:b.buildPreview.rotation.y,kind:b.buildKind};
   });
   expect(state.kind).toBe(kind);
   expect(state.facing).toBe(stored);
   expect(state.rotation).toBeCloseTo(angle,5);
  }
 }
 // The actual building, not just the green ghost, must retain 90° orientation.
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No available HQ site');
  const built=game.build(0,'headquarters',site,undefined,2);
  if(!built)throw Error('Could not place the rotated headquarters');
  battlefield.sync(true);
  return {savedFacing:built.facing,
   sceneFacing:battlefield.bases.get(built.id)?.node.rotation.y,
   recoveredFacing:game.constructor.load(game.save()).bases.find(b=>b.id===built.id)?.facing};
 });
 expect(state.savedFacing).toBe(2);
 expect(state.sceneFacing).toBeCloseTo(Math.PI/2,5);
 expect(state.recoveredFacing).toBe(2);
 expect(errors).toEqual([]);
});
