import {test,expect} from '@playwright/test';

test('3D original-style blueprint: translucent ghost, live site validation and R rotation',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
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
 await page.keyboard.press('r');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.placementFacing)).toBe(1);
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
    label:c.lastLabel};
  };
  const phases=[.1,.42,.82].map(capture);
  building.buildRemaining=0;building.hp=1200;b.sync(true,.06,false,1);
  const e=b.bases.get(building.id);
  return {phases,finished:e.construction===null,scale:e.node.scale.y,
   completed:g.hasHeadquarters(0)};
 });
 const [early,middle,late]=stages.phases;
 expect(early.clipped).toBe(true);
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
 expect(before.minZoom).toBeCloseTo(.70,2);
 expect(before.vision).toBeCloseTo(1.12,2);
 expect(before.audioEnabled).toBe(true);
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="units"]').first().click();
 const soldier=page.locator('[data-unit="infantry"] .card-name');
 await expect(soldier).toHaveText('Infanteriesoldat');
 expect(await soldier.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('normal');
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
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="buildings"]').first().click();
 await expect(page.locator('[data-build="barracks"]')).toBeDisabled();
 const filter=await page.locator('[data-build="barracks"] .sf-card-image img')
   .evaluate(el=>({filter:getComputedStyle(el).filter,opacity:getComputedStyle(el).opacity}));
 expect(filter.filter).toContain('grayscale(1)');
 expect(filter.filter).toContain('blur(');
 expect(Number(filter.opacity)).toBeLessThan(1);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.sound?.context?.state==='running',{timeout:20000});
 await page.evaluate(()=>window.__sandforgeWebGL.sound.context.suspend());
 await page.waitForFunction(()=>window.__sandforgeWebGL.sound.context.state==='suspended');
 // The next real pointer interaction is a permitted autoplay-unlock gesture.
 await page.locator('#sf-classic-root .catalog-tabs [data-tab="units"]').first().click();
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
