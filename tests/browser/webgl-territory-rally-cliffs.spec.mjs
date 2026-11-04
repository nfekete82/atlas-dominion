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
      width:entry.captureBar.children[0].scale.x,
      height:entry.captureBar.children[0].scale.y,
      y:entry.captureBar.position.y,
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
  expect(state.active.width).toBeLessThanOrEqual(80);
  expect(state.active.height).toBeLessThanOrEqual(10);
  expect(state.active.y).toBeLessThan(140);
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
      // The new Fog of War is near-black charcoal rather than desert brown.
      // Check its dark, neutral character without pinning the shader to one
      // hard-coded RGB triplet (the dedicated fog spec checks the exact mode).
      fogTint:(()=>{
        const match=shader.match(/gl_FragColor\s*=\s*vec4\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*a\s*\)/);
        if(!match)return false;
        const [r,g,b]=match.slice(1).map(Number);
        return [r,g,b].every(v=>v>=0&&v<=.06)&&b>=r&&g>=r;
      })(),
      isWebGLRenderer:view.renderer.isWebGLRenderer===true
    };
  });
  expect(state.isWebGLRenderer).toBe(true);
  expect(state.angle).toBeGreaterThan(1);
  expect(state.angle).toBeLessThan(1.3);
  expect(state.zoom).toBeCloseTo(.59,2);
  expect(state.infantryHeight).toBe(61);
  expect(state.dimensionVersion).toBe(3);
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
  expect(before.zoom).toBeCloseTo(.59,2);
  expect(before.polar).toBeGreaterThan(.98);
  expect(before.polar).toBeLessThan(1.15);
  await page.locator('#sf3d-showcase').click();
  await page.locator('#sf3d-showcase').click();
  await page.locator('#home').click();
  expect(await page.evaluate(()=>window.__sandforgeWebGL.camera.zoom)).toBeCloseTo(.59,2);
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


test('3D parity: click a completed base and right-click the map to set rally immediately',async({page})=>{
  test.setTimeout(115000);
  await load(page);
  const fixture=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
    const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
    if(!site)throw new Error('No valid HQ construction site');
    const base=g.build(0,'headquarters',site);
    if(!base)throw new Error('Could not build HQ fixture');
    base.buildRemaining=0;
    b.sync(true,.06,false,1);
    const node=b.bases.get(base.id)?.node;
    if(!node)throw new Error('3D building model missing');
    const target=g.world.nearest({x:base.x+250,y:base.y+145},g.obstacles());
    const center=b.pos(base.x,base.y);
    const shift=center.clone().sub(v.controls.target);
    v.controls.target.add(shift);v.camera.position.add(shift);v.controls.update();
    const rect=v.renderer.domElement.getBoundingClientRect();
    const project=(point)=>{
      const p=b.pos(point.x,point.y,point.height).project(v.camera);
      return {x:rect.left+(p.x+1)*rect.width/2,
       y:rect.top+(1-p.y)*rect.height/2};
    };
    return {id:base.id,target,baseClick:project({x:base.x,y:base.y,
      height:b.heightAt(base.x,base.y)+22}),targetClick:project(target)};
  });
  await page.mouse.click(fixture.baseClick.x,fixture.baseClick.y);
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.selectedBase)).toBe(fixture.id);
  expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.rallyMode)).toBe(false);
  await page.mouse.click(fixture.targetClick.x,fixture.targetClick.y,{button:'right'});
  const result=await page.evaluate(id=>{
    const v=window.__sandforgeWebGL,b=v.battlefield;
    const base=v.game.bases.find(x=>x.id===id);
    return {rally:base.rally,selectedBase:b.selectedBase,rallyMode:b.rallyMode,
      feedback:b.panel.querySelector('#sf-message').textContent,
      marker:b.rallyMarker.visible};
  },fixture.id);
  expect(result.selectedBase).toBe(fixture.id);
  expect(result.rallyMode).toBe(false);
  expect(result.marker).toBe(true);
  expect(result.feedback).toContain('Sammelpunkt gesetzt');
  expect(result.rally).toBeTruthy();
  expect(Math.hypot(result.rally.x-fixture.target.x,result.rally.y-fixture.target.y)).toBeLessThan(45);
});

test('3D parity: model click selects a soldier, RMB on ground issues one movement order',async({page})=>{
  test.setTimeout(115000);
  await load(page);
  const fixture=await page.evaluate(()=>{
    const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
    const unit=g.units.find(u=>u.owner===0&&u.kind==='infantry'&&u.hp>0);
    if(!unit)throw new Error('No friendly infantry');
    b.selected.clear();b.selectedBase=null;b.drawInterface();
    const position=b.pos(unit.x,unit.y);
    const delta=position.clone().sub(v.controls.target);
    v.controls.target.add(delta);v.camera.position.add(delta);v.controls.update();
    let target=null;
    for(const radius of [180,250,340]){
      if(target)break;
      for(let n=0;n<16;n++){
        const p={x:unit.x+Math.cos(n*Math.PI/8)*radius,
         y:unit.y+Math.sin(n*Math.PI/8)*radius};
        if(g.world.walkable(p,g.obstacles())&&g.world.path(unit,p,g.obstacles()).length){
          target=p;break;
        }
      }
    }
    if(!target)throw new Error('No safe movement destination');
    const rect=v.renderer.domElement.getBoundingClientRect();
    const project=point=>{
      const pt=b.pos(point.x,point.y,point.height).project(v.camera);
      return {x:rect.left+(pt.x+1)*rect.width/2,
       y:rect.top+(1-pt.y)*rect.height/2};
    };
    return {id:unit.id,
      unitClick:project({x:unit.x,y:unit.y,height:b.heightAt(unit.x,unit.y)+24}),
      targetClick:project(target)};
  });
  await page.mouse.click(fixture.unitClick.x,fixture.unitClick.y);
  const selected=await page.evaluate(id=>window.__sandforgeWebGL.battlefield.selected.has(id),fixture.id);
  expect(selected).toBe(true);
  await page.mouse.click(fixture.targetClick.x,fixture.targetClick.y,{button:'right'});
  const state=await page.evaluate(id=>{
    const v=window.__sandforgeWebGL,u=v.game.units.find(x=>x.id===id);
    return {kind:u.orders.at(-1)?.kind,pulse:v.battlefield.commandPulse.visible,
      message:v.battlefield.panel.querySelector('#sf-message').textContent};
  },fixture.id);
  expect(state.kind).toBe('move');
  expect(state.pulse).toBe(true);
  expect(state.message).toContain('Marsch');
});

test('3D soldier portraits use the same detailed prototype source as medic',async({page})=>{
  await load(page);
  const result=await page.evaluate(async()=>{
    const {unitAtlasUrl}=await import('/webgl-portraits.js');
    return Object.fromEntries(['infantry','engineer','medic','heavy','rover']
      .map(kind=>[kind,unitAtlasUrl(kind)]));
  });
  for(const kind of ['infantry','engineer','medic','heavy'])
    expect(result[kind]).toContain('/prototype/'+kind+'-0');
  expect(result.rover).toContain('/animation/rover-0');
});


test('right-clicking the visible 3D bastion sends infantry into its capture ring and changes ownership',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const fixture=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
  g.aiClock=-100000; // Capture path, not an unrelated director assault.
  const soldier=g.units.find(u=>u.owner===0&&u.kind==='infantry'&&u.hp>0);
  if(!soldier)throw Error('No starting infantry');
  const blockers=[...g.obstacles(),...g.bastionColliders()];
  let choice=null;
  for(const territory of g.territories.filter(t=>t.owner===-1)){
   if(g.units.some(u=>u.owner===1&&u.hp>0&&Math.hypot(u.x-territory.point.x,u.y-territory.point.y)<350))continue;
   for(let n=0;n<16&&!choice;n++){
    const theta=n*Math.PI/8;
    const start={x:territory.point.x+180*Math.cos(theta),
     y:territory.point.y+180*Math.sin(theta)};
    if(!g.world.walkable(start,blockers))continue;
    if(!g.world.path(start,territory.point,blockers).length)continue;
    choice={territory,start};
   }
   if(choice)break;
  }
  if(!choice)throw Error('No reachable neutral bastion fixture');
  const {territory,start}=choice;
  soldier.x=start.x;soldier.y=start.y;
  soldier.previousX=start.x;soldier.previousY=start.y;
  soldier.orders=[];soldier.path=[];soldier.repath=0;
  b.selected=new Set([soldier.id]);b.selectedBase=null;
  b.sync(true,.06,false,1);
  const center=b.pos(territory.point.x,territory.point.y);
  const pan=center.clone().sub(v.controls.target);
  v.controls.target.add(pan);v.camera.position.add(pan);
  v.controls.update();
  const entry=b.bastions.get(territory.id);
  entry.node.updateMatrixWorld(true);
  const modelPoint=entry.core.getWorldPosition(center.clone()).project(v.camera);
  const rect=v.renderer.domElement.getBoundingClientRect();
  return {id:territory.id,unitId:soldier.id,
   x:rect.left+(modelPoint.x+1)*rect.width*.5,
   y:rect.top+(1-modelPoint.y)*rect.height*.5,
   sourceDistance:Math.hypot(soldier.x-territory.point.x,soldier.y-territory.point.y)};
 });
 expect(fixture.sourceDistance).toBeGreaterThan(95);
 expect(fixture.x).toBeGreaterThan(0);
 expect(fixture.x).toBeLessThan(1440);
 expect(fixture.y).toBeGreaterThan(0);
 expect(fixture.y).toBeLessThan(580);
 await page.mouse.click(fixture.x,fixture.y,{button:'right'});
 const order=await page.evaluate(({id,unitId})=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const t=game.territories.find(t=>t.id===id);
  const soldier=game.units.find(u=>u.id===unitId);
  const o=soldier.orders[0];
  return {kind:o?.kind,distance:o?Math.hypot(o.x-t.point.x,o.y-t.point.y):9999,
   message:battlefield.panel.querySelector('#sf-message').textContent};
 },fixture);
 expect(order.kind).toBe('move');
 expect(order.distance).toBeLessThanOrEqual(95);
 expect(order.message).toContain('Bastion');
 const capture=await page.evaluate(({id,unitId})=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const t=game.territories.find(t=>t.id===id);
  let maxProgress=0;
  for(let n=0;n<380&&t.owner!==0;n++){
   game.step(.05);
   maxProgress=Math.max(maxProgress,t.progress);
  }
  battlefield.sync(true,.05,false,1);
  const soldier=game.units.find(u=>u.id===unitId);
  return {owner:t.owner,maxProgress,
   distance:soldier?Math.hypot(soldier.x-t.point.x,soldier.y-t.point.y):9999};
 },fixture);
 expect(capture.maxProgress).toBeGreaterThan(0);
 expect(capture.owner).toBe(0);
 expect(capture.distance).toBeLessThanOrEqual(95);
});
