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
