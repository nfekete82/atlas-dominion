import {test,expect} from '@playwright/test';

async function started(page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
}
async function threatened(page){
  return page.evaluate(async()=>{
    const {landNeighbors,NEUTRAL}=await import('/src/engine/game.js');
    const g=window.__atlas.getGame();
    const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
    const foe=landNeighbors(own).find(n=>g.owner[n]===NEUTRAL);
    g.owner[foe]=1;g.frontline[own]=240;
    g.factions[0].troops=1600;g.factions.forEach(f=>f.ai=false);
    g.recount();g.setBorderMode(0,{x:own%480,y:Math.floor(own/480)},'defend');window.__atlas.refresh();
    return {own,foe,mobile:g.factions[0].troops};
  });
}
test('minimap renders real ownership and repositions map; panel folds and unfolds',async({page})=>{
  await started(page);
  await expect(page.locator('#minimapPanel')).toBeVisible();
  await expect(page.locator('#miniCanvas')).toBeVisible();
  const original=await page.evaluate(()=>window.__atlas.renderer.visibleWorldBounds());
  await page.locator('#miniCanvas').click({position:{x:80,y:55}});
  const center=await page.evaluate(()=>{
    const v=window.__atlas.renderer.visibleWorldBounds();
    return {x:v.x+v.width/2,y:v.y+v.height/2};
  });
  expect(Math.abs(center.x-80/240*1600)).toBeLessThan(12);
  expect(Math.abs(center.y-55/130*900)).toBeLessThan(12);
  expect(center.x).not.toBeCloseTo(original.x+original.width/2,0);
  await page.locator('#minimapToggle').click();
  await expect(page.locator('#minimapBody')).toBeHidden();
  await expect(page.locator('#minimapToggle')).toHaveAttribute('aria-expanded','false');
  await page.locator('#minimapToggle').click();
  await expect(page.locator('#miniCanvas')).toBeVisible();
});

test('border command center prioritizes defense, withdraws excess and persists all orders',async({page})=>{
  await started(page);
  const data=await threatened(page);
  await expect(page.locator('[data-border-index]')).not.toHaveCount(0);
  const card=page.locator(`[data-border-index="${data.own}"]`);
  await expect(card).toBeVisible();
  const before=await page.evaluate(()=>window.__atlas.getGame().populationOf(0));
  await card.locator('[data-border-mode="defend"]').click();
  expect(await page.evaluate(i=>window.__atlas.getGame().getBorderMode({x:i%480,y:Math.floor(i/480)}),data.own)).toBe('defend');
  await card.locator('[data-border-mode="withdraw"]').click();
  const result=await page.evaluate(i=>{
    const g=window.__atlas.getGame();
    return {troops:g.factions[0].troops,garrison:g.frontline[i],
      population:g.populationOf(0),mode:g.getBorderMode({x:i%480,y:Math.floor(i/480)})};
  },data.own);
  expect(result.troops).toBeGreaterThan(data.mobile);
  expect(result.garrison).toBeLessThan(240);
  expect(result.population).toBeCloseTo(before,4);
  expect(result.mode).toBe('withdraw');
  await page.evaluate(()=>window.__atlas.save());
  await page.reload();
  await expect(page.locator('#countryPicker')).toBeHidden();
  expect(await page.evaluate(i=>window.__atlas.getGame().getBorderMode({x:i%480,y:Math.floor(i/480)}),data.own)).toBe('withdraw');
});

test('right-click own frontier provides tactical orders and does not lose click targets',async({page})=>{
  await started(page);
  const data=await threatened(page);
  const spot=await page.evaluate(i=>{
    const r=window.__atlas.renderer;
    r.focusOnPoint({x:i%480,y:Math.floor(i/480)},3);
    const c=r.canvas.getBoundingClientRect();
    return {x:c.left+r.ox+(i%480+.5)*1600/480*r.scale,
      y:c.top+r.oy+(Math.floor(i/480)+.5)*900/260*r.scale};
  },data.own);
  await page.mouse.click(spot.x,spot.y,{button:'right'});
  await expect(page.locator('[data-strategic-mode="defend"]')).toBeVisible();
  await page.locator('[data-strategic-mode="defend"]').click();
  expect(await page.evaluate(i=>window.__atlas.getGame().getBorderMode({x:i%480,y:Math.floor(i/480)}),data.own)).toBe('defend');
});

test('minimap overview never advances tick or affects troop or ownership state',async({page})=>{
  await started(page);
  const before=await page.evaluate(()=>JSON.stringify(window.__atlas.getGame().exportSave()));
  await page.locator('#miniCanvas').click({position:{x:120,y:65}});
  await page.locator('#minimapToggle').click();
  await page.locator('#minimapToggle').click();
  const after=await page.evaluate(()=>JSON.stringify(window.__atlas.getGame().exportSave()));
  expect(after).toBe(before);
});
