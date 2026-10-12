import {test,expect} from '@playwright/test';

test('diplomacy sidebar creates a real treaty, blocks attacks and survives reload',async({page})=>{
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
  const select=page.locator('#diplomacyNation');
  await expect(select).toBeVisible();
  await select.selectOption('1');
  await expect(page.locator('#diplomacyOffer')).toBeEnabled();
  await page.locator('#diplomacyOffer').click();
  await expect(page.locator('#diplomacyAllies')).toContainText('Vereinigtes Königreich');
  await expect(page.locator('#diplomacyLeave')).toBeVisible();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,1))).toBe(true);
  const before=await page.evaluate(()=>{
    const g=window.__atlas.getGame();
    const index=g.owner.findIndex(o=>o===1);
    return {reserve:g.factions[0].troops,orders:g.attackOrders.length,
      action:g.launchAttack(0,{x:index%480,y:Math.floor(index/480)},35)};
  });
  expect(before.action.ok).toBe(false);
  expect(await page.evaluate(()=>window.__atlas.getGame().factions[0].troops)).toBe(before.reserve);
  await page.evaluate(()=>window.__atlas.save());
  await page.reload();
  await expect(page.locator('#countryPicker')).toBeHidden();
  await expect(page.locator('#diplomacyAllies')).toContainText('Vereinigtes Königreich');
  await page.locator('#diplomacyNation').selectOption('1');
  await page.locator('#diplomacyLeave').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,1))).toBe(false);
});

test('AI alliance proposal requires explicit accept or decline',async({page})=>{
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{
    const g=window.__atlas.getGame();g.paused=true;g.offerAlliance(2,0);
    window.__atlas.refresh();
  });
  await expect(page.locator('[data-alliance-accept="2"]')).toBeVisible();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,2))).toBe(false);
  await page.locator('[data-alliance-accept="2"]').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,2))).toBe(true);
  await expect(page.locator('#diplomacyAllies')).toContainText('Frankreich');
});
