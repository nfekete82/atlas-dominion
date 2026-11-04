import {test,expect} from '@playwright/test';

const route='/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1';
async function load(page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
}

test('3D canyon monoliths are decorative, outside the playable world and do not alter collision',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL;
    const mesh=a.boundaryCliffs?.monoliths;
    const worldSize=a.game.world.size;
    const center=worldSize*.5;
    const matrix=mesh?.instanceMatrix;
    const positions=[];
    if(mesh&&matrix){
      const data=matrix.array;
      for(let i=0;i<mesh.count;i++){
        const x=data[i*16+12]+center;
        const z=data[i*16+14]+center;
        positions.push({x,z});
      }
    }
    return {
      count:mesh?.count??0,
      visual:mesh?.userData?.visualBoundary===true,
      nonPlayable:mesh?.userData?.nonPlayable===true,
      collisionChanged:a.boundaryCliffs?.collisionChanged,
      outside:positions.length>0&&positions.every(p=>p.x<0||p.x>worldSize||p.z<0||p.z>worldSize)
    };
  });
  expect(state.count).toBeGreaterThanOrEqual(40);
  expect(state.visual).toBe(true);
  expect(state.nonPlayable).toBe(true);
  expect(state.collisionChanged).toBe(false);
  expect(state.outside).toBe(true);
});

test('bastion capture timer in the sector list reflects authoritative simulation progress',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL;
    const sector=a.game.territories[0];
    const original={progress:sector.progress,capturing:sector.capturing};
    sector.progress=2.4;
    sector.capturing=0;
    a.battlefield.drawInterface();
    const label=a.battlefield.panel.querySelector('[data-territory="0"]')?.textContent??'';
    sector.progress=original.progress;
    sector.capturing=original.capturing;
    return label;
  });
  expect(state).toContain('EROBERUNG');
  expect(state).toContain('BLAU');
  expect(state).toContain('2.4 s');
});

test('a completed production building exposes a rally command and Escape cancels it',async({page})=>{
  await load(page);
  const prepared=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
    const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
    if(!site)return false;
    const building=g.build(0,'headquarters',site);
    if(!building)return false;
    building.buildRemaining=0;
    building.hp=1200;
    b.selected.clear();
    b.selectedBase=building.id;
    b.sync(true,.06,false,1);
    b.drawInterface();
    return true;
  });
  expect(prepared).toBe(true);
  const button=page.locator('#sf-classic-root [data-action="rally"]');
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.rallyMode)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.rallyMode)).toBe(false);
});

test('bastions show an in-world progress bar only while capture is active',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL;
    const t=a.game.territories[0],entry=a.battlefield.bastions.get(t.id);
    const original={progress:t.progress,capturing:t.capturing,fog:a.battlefield.fogEnabled};
    a.battlefield.fogEnabled=false;
    t.capturing=1;
    t.progress=2;
    a.battlefield.sync(true,0,false);
    const active={
      visible:entry.captureBar.visible,
      fraction:entry.captureBar.userData.captureFraction,
      duration:entry.captureBar.userData.captureSeconds,
      red:entry.captureBar.userData.captureFill.material.color.getHexString()
    };
    t.progress=0;
    t.capturing=-1;
    a.battlefield.sync(true,0,false);
    const hidden=!entry.captureBar.visible;
    Object.assign(t,{progress:original.progress,capturing:original.capturing});
    a.battlefield.fogEnabled=original.fog;
    a.battlefield.sync(true,0,false);
    return {active,hidden};
  });
  expect(state.active.visible).toBe(true);
  expect(state.active.fraction).toBeGreaterThan(0);
  expect(state.active.fraction).toBeLessThanOrEqual(1);
  expect(state.active.duration).toBeGreaterThan(0);
  expect(state.active.red).toBe('f19b73');
  expect(state.hidden).toBe(true);
});

test('sector takeover and loss show player-only HUD feedback',async({page})=>{
  await load(page);
  const result=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,b=a.battlefield;
    const territory=a.game.territories[0],entry=b.bastions.get(territory.id);
    const owner=territory.owner,previous=entry.owner;
    // Exercise the real ownership-change synchronizer, not a mock banner.
    territory.owner=previous===0?1:0;
    b.sync(true,0,false);
    const first={
      message:b.panel.querySelector('#sf-message')?.textContent,
      type:b.panel.querySelector('#sf-message')?.getAttribute('data-sector-event')
    };
    territory.owner=previous;
    b.sync(true,0,false);
    const second={
      message:b.panel.querySelector('#sf-message')?.textContent,
      type:b.panel.querySelector('#sf-message')?.getAttribute('data-sector-event')
    };
    territory.owner=owner;
    b.message('Marschziel gesetzt');
    const reset=b.panel.querySelector('#sf-message')?.hasAttribute('data-sector-event');
    return {first,second,reset};
  });
  const events=[result.first,result.second];
  expect(events.some(e=>e.type==='secured'&&e.message.includes('EROBERT'))).toBe(true);
  expect(events.some(e=>e.type==='lost'&&e.message.includes('VERLOREN'))).toBe(true);
  expect(result.reset).toBe(false);
});

test('production percentage increases with elapsed time and construction is visible',async({page})=>{
  await load(page);
  const info=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
    // Campaigns deliberately start without a completed HQ. Build the
    // same real headquarters fixture used by the rally control test.
    const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
    if(!site)return {error:'No valid HQ construction site'};
    const base=g.build(0,'headquarters',site);
    if(!base)return {error:'Could not create HQ fixture'};
    const old={queue:[...base.queue],queueTypes:[...base.queueTypes],production:base.production,buildRemaining:base.buildRemaining};
    base.queue=[5];base.queueTypes=['engineer'];base.production=2.5;
    base.buildRemaining=10;
    b.drawInterface();
    const bar=b.panel.querySelector('#sf-progress').style.width;
    const eta=b.panel.querySelector('#sf-queue-time').textContent;
    const construction=b.panel.querySelector('#sf-building-status').textContent;
    const count=b.panel.querySelector('#sf-queue-count').textContent;
    base.queue=old.queue;base.queueTypes=old.queueTypes;
    base.production=old.production;base.buildRemaining=old.buildRemaining;
    b.drawInterface();
    return {bar,eta,construction,count};
  });
  expect(info.error).toBeUndefined();
  // CSSOM normalizes 50.0% to 50%; assert the numeric progress, not formatting.
  expect(parseFloat(info.bar)).toBeCloseTo(50,5);
  expect(info.eta).toBe('3 s');
  expect(info.construction).toContain('50%');
  expect(info.count).toContain('1 PRODUKTION');
  expect(info.count).toContain('1 BAU');
});

test('visual depth preview keeps an angled 3D RTS camera and desert fog',async({page})=>{
  await load(page);
  const state=await page.evaluate(async()=>{
    const view=window.__sandforgeWebGL;
    const {MODEL_HEIGHTS,DIMENSIONS_VERSION}=await import('/webgl-scale.js');
    const shader=view.battlefield.fogNodes[0]?.material?.fragmentShader??'';
    return {
      angle:view.controls.getPolarAngle(),
      zoom:view.camera.zoom,
      infantryHeight:MODEL_HEIGHTS.infantry,
      dimensionVersion:DIMENSIONS_VERSION,
      fogStillOpaque:view.battlefield.fogTexture.image.data.some((v,i)=>i%4===3&&v===255),
      fogTint:shader.includes('vec4(0.040,0.032,0.025,a)'),
      isWebGLRenderer:view.renderer.isWebGLRenderer===true
    };
  });
  expect(state.isWebGLRenderer).toBe(true);
  expect(state.angle).toBeGreaterThan(1);
  expect(state.angle).toBeLessThan(1.3);
  expect(state.zoom).toBeCloseTo(.74,2);
  expect(state.infantryHeight).toBe(61);
  expect(state.dimensionVersion).toBe(2);
  expect(state.fogStillOpaque).toBe(true);
  expect(state.fogTint).toBe(true);
});

test('3D showcase uses a stationary camera, keeps fog and restores the RTS view',async({page})=>{
  await load(page);
  const before=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {
      camera:v.camera.position.toArray(),
      target:v.controls.target.toArray(),
      zoom:v.camera.zoom,fog:v.battlefield.fogEnabled
    };
  });
  const button=page.locator('#sf3d-showcase');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#sf3d-showcase-hint')).toBeVisible();
  const active=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {
      active:v.showcaseActive,zoom:v.camera.zoom,
      autoRotate:v.controls.autoRotate,
      fog:v.battlefield.fogEnabled,
      axes:v.scene.getObjectByName('visual-only-3d-reference-axes')?.visible
    };
  });
  expect(active).toEqual({
    active:true,zoom:1.55,autoRotate:false,fog:before.fog,axes:true
  });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#sf3d-showcase-hint')).toBeHidden();
  const restored=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {
      active:v.showcaseActive,zoom:v.camera.zoom,
      fog:v.battlefield.fogEnabled,
      autoRotate:v.controls.autoRotate,
      axes:v.scene.getObjectByName('visual-only-3d-reference-axes')?.visible
    };
  });
  expect(restored).toEqual({
    active:false,zoom:before.zoom,fog:before.fog,autoRotate:false,axes:false
  });
});

test('showcase URL parameter starts an obvious 3D preview automatically',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(route+'&showcase=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
  await expect(page.locator('#sf3d-showcase')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#sf3d-showcase-hint')).toBeVisible();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.showcaseActive)).toBe(true);
});

test('Fog of War can be toggled during 3D showcase and stays selected on return',async({page})=>{
  await load(page);
  const button=page.locator('#sf3d-showcase');
  const fog=page.locator('#sf-tools button[data-action="fog"]');
  await expect(fog).toHaveAttribute('aria-pressed','true');
  await expect(fog).toHaveText('NEBEL AN');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(fog).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#sf3d-showcase-hint')).toContainText('Kriegsnebel AN');
  expect(await page.evaluate(()=>window.__sandforgeWebGL.controls.autoRotate)).toBe(false);
  await fog.click();
  await expect(fog).toHaveAttribute('aria-pressed','false');
  await expect(fog).toHaveText('NEBEL AUS');
  await expect(page.locator('#sf3d-showcase-hint')).toContainText('Kriegsnebel AUS');
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogNodes.every(n=>!n.visible))).toBe(true);
  await button.click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(false);
  await fog.click();
  await expect(fog).toHaveText('NEBEL AN');
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogNodes.every(n=>n.visible))).toBe(true);
});

test('3D Fog-of-War frontier follows the real vision grid and hides when disabled',async({page})=>{
  await load(page);
  const initial=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {
      fog:v.battlefield.fogEnabled,
      frontier:v.atmosphere.fogMesh.count,
      visualOnly:v.atmosphere.fogMesh.userData.nonPlayable,
      authoritativeCells:v.game.visible[0].filter(Boolean).length
    };
  });
  expect(initial.fog).toBe(true);
  expect(initial.visualOnly).toBe(true);
  expect(initial.authoritativeCells).toBeGreaterThan(0);
  expect(initial.frontier).toBeGreaterThan(0);
  expect(initial.frontier).toBeLessThanOrEqual(300);
  const fog=page.locator('#sf-tools button[data-action="fog"]');
  await fog.click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.atmosphere.fogMesh.count)).toBe(0);
  await fog.click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.atmosphere.fogMesh.count)).toBeGreaterThan(0);
});

test('3D sandstorm preview creates GPU dust without changing simulation weather',async({page})=>{
  await load(page);
  const initial=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {storm:v.atmosphere.stormPreview,dust:v.atmosphere.dustMesh.count,weather:v.game.weather.intensity};
  });
  expect(initial.storm).toBe(false);
  expect(initial.dust).toBe(0);
  const storm=page.locator('#sf3d-storm');
  await expect(storm).toBeVisible();
  await storm.click();
  await expect(storm).toHaveAttribute('aria-pressed','true');
  await page.waitForFunction(()=>window.__sandforgeWebGL.atmosphere.dustMesh.count>0);
  const active=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL;
    return {dust:v.atmosphere.dustMesh.count,weather:v.game.weather.intensity,
      tagged:v.atmosphere.dustMesh.userData.visualOnly,
      sceneFog:v.scene.fog.density};
  });
  expect(active.dust).toBeGreaterThan(0);
  expect(active.tagged).toBe(true);
  expect(active.weather).toBe(initial.weather);
  expect(active.sceneFog).toBeGreaterThan(0.00011);
  await storm.click();
  await page.waitForFunction(()=>window.__sandforgeWebGL.atmosphere.dustMesh.count===0);
  await expect(storm).toHaveAttribute('aria-pressed','false');
});

test('3D sand heightfield uses directional micro-normal maps with playable collision unchanged',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL;
    const chunks=a.scene.children.filter(m=>m.userData?.terrain);
    const mesh=chunks[0];
    return {
      chunks:chunks.length,
      geometry:mesh?.geometry?.getAttribute('position')?.count,
      sandNormals:mesh?.material?.normalMap?.isTexture===true,
      materialType:mesh?.material?.type,
      walkableCells:a.game.world.blocked.length
    };
  });
  expect(state.chunks).toBe(16);
  expect(state.geometry).toBeGreaterThan(3000);
  expect(state.sandNormals).toBe(true);
  expect(state.materialType).toBe('MeshStandardMaterial');
  expect(state.walkableCells).toBe(240*240);
});

test('real-time explosions create and retire 3D shockwaves independently of combat',async({page})=>{
  await load(page);
  const result=await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,e=a.effects;
    const soldier=a.game.units.find(u=>u.owner===0&&u.hp>0);
    const before=a.game.units.length;
    e.blastAt(soldier.x,soldier.y,true);
    e.update(.04,true);
    const during={
      count:e.shockwave.count,
      is3D:e.shockwave.geometry.type==='TorusGeometry',
      visualOnly:e.shockwave.userData.visualOnly
    };
    e.update(.72,true);
    return {during,after:e.shockwave.count,unitsUnchanged:a.game.units.length===before};
  });
  expect(result.during.count).toBeGreaterThan(0);
  expect(result.during.is3D).toBe(true);
  expect(result.during.visualOnly).toBe(true);
  expect(result.after).toBe(0);
  expect(result.unitsUnchanged).toBe(true);
});

test('right-clicking a visible enemy issues an explicit focus-fire order',async({page})=>{
  await load(page);
  const click=await page.evaluate(()=>{
    const view=window.__sandforgeWebGL,game=view.game,b=view.battlefield;
    const friendly=game.units.find(u=>u.owner===0&&u.kind==='infantry'&&u.hp>0);
    if(!friendly)return {error:'Missing friendly infantry'};
    const spot=game.world.nearest(
      {x:friendly.x+105,y:friendly.y+65},game.obstacles(),game.units,friendly
    );
    if(!spot)return {error:'No valid enemy spawn position'};
    const enemy=game.spawn(1,spot,'infantry');
    game.updateVision();
    b.sync(true);
    if(!game.canSee(0,enemy))return {error:'Enemy not visible in test fixture'};
    b.selected.clear();
    b.selected.add(friendly.id);
    b.drawInterface();
    view.camera.updateMatrixWorld(true);
    const entry=b.units.get(enemy.id);
    const pos=entry.node.position.clone();
    pos.y+=28;
    pos.project(view.camera);
    const rect=view.renderer.domElement.getBoundingClientRect();
    return {
      x:rect.left+(pos.x+1)*rect.width/2,
      y:rect.top+(1-pos.y)*rect.height/2,
      friendlyId:friendly.id,
      enemyId:enemy.id
    };
  });
  expect(click.error).toBeUndefined();
  await page.mouse.click(click.x,click.y,{button:'right'});
  const order=await page.evaluate(id=>{
    const g=window.__sandforgeWebGL.game;
    const u=g.units.find(u=>u.id===id);
    return {kind:u.orders[0]?.kind,target:u.orders[0]?.target};
  },click.friendlyId);
  expect(order).toEqual({kind:'attack',target:click.enemyId});
  await expect(page.locator('#sf-message')).toContainText('Ziel angreifen');
});

test('the higher, wider default camera is restored by Home',async({page})=>{
  await load(page);
  const before=await page.evaluate(()=>{
    const view=window.__sandforgeWebGL;
    return {zoom:view.camera.zoom,polar:view.controls.getPolarAngle()};
  });
  expect(before.zoom).toBeCloseTo(.74,2);
  expect(before.polar).toBeGreaterThan(.98);
  expect(before.polar).toBeLessThan(1.15);
  await page.locator('#sf3d-showcase').click();
  await page.locator('#sf3d-showcase').click();
  await page.locator('#home').click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.camera.zoom)).toBeCloseTo(.74,2);
});

test('Fog-of-War shader softens the visible-side border without uncovering hidden cells',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const view=window.__sandforgeWebGL;
    const mat=view.battlefield.fogNodes[0].material;
    return {softened:mat.fragmentShader.includes('n*0.44'),
      cellStep:mat.uniforms.fogStep.value,
      unexploredOpacity:view.battlefield.fogTexture.image.data.some((v,i)=>i%4===3&&v===255)};
  });
  expect(state.softened).toBe(true);
  expect(state.cellStep).toBeGreaterThan(0);
  expect(state.unexploredOpacity).toBe(true);
});

test('decorative 3D desert tapers into the horizon instead of ending as a hard cliff',async({page})=>{
  await load(page);
  const state=await page.evaluate(()=>{
    const perimeter=window.__sandforgeWebGL.visualPerimeter;
    const leftmost=Math.min(...perimeter.meshes.map(m=>m.userData.tileX));
    const edge=perimeter.meshes.find(m=>m.userData.tileX===leftmost&&m.userData.tileY===0);
    return {
      edgeHeight:edge?.geometry.getAttribute('position').getY(0),
      tileCount:perimeter.meshes.length,
      decorativeOnly:edge?.userData.nonPlayable,
      worldSize:window.__sandforgeWebGL.game.world.size
    };
  });
  expect(state.tileCount).toBeGreaterThan(10);
  expect(state.decorativeOnly).toBe(true);
  expect(state.edgeHeight).toBeCloseTo(0,3);
  expect(state.worldSize).toBeGreaterThan(0);
});
