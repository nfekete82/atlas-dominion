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
