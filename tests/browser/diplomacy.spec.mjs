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

async function rightClickForeign(page,ownerId=1){
  await page.evaluate(()=>{const g=window.__atlas.getGame();g.paused=true;window.__atlas.renderer.fit();window.__atlas.refresh();});
  const spot=await page.evaluate(id=>{
    const r=window.__atlas.renderer,g=window.__atlas.getGame();
    const box=r.canvas.getBoundingClientRect();
    let choice=null,best=Infinity;
    for(let i=0;i<g.owner.length;i++){
      if(g.owner[i]!==id)continue;
      const x=box.left+r.ox+(i%480+.5)*(1600/480)*r.scale;
      const y=box.top+r.oy+(Math.floor(i/480)+.5)*(900/260)*r.scale;
      if(x<box.left+35||x>box.right-35||y<box.top+35||y>box.bottom-35)continue;
      const picked=r.cellAt(x,y,false);
      if(!picked||g.owner[picked.y*480+picked.x]!==id)continue;
      const distance=(x-box.left-box.width/2)**2+(y-box.top-box.height/2)**2;
      if(distance<best){best=distance;choice={x,y};}
    }
    return choice;
  },ownerId);
  expect(spot).toBeTruthy();
  await page.mouse.click(spot.x,spot.y,{button:'right'});
  return spot;
}

test('right click on foreign territory offers or ends a coalition without dispatching troops',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  const before=await page.evaluate(()=>{
    const g=window.__atlas.getGame();g.paused=true;
    return {troops:g.factions[0].troops,orders:g.attackOrders.length,score:g.evaluateAlliance(0,1)};
  });
  expect(before.score.accepted).toBe(true);
  const spot=await rightClickForeign(page,1);
  await expect(page.locator('#buildMenu')).toBeVisible();
  await expect(page.locator('[data-coalition-offer]')).toBeVisible();
  await expect(page.locator('[data-upgrade-city]')).toHaveCount(0);
  await expect(page.locator('#buildCoordinates')).toContainText('DIPLOMATIE');
  await expect(page.locator('#diplomacyNation')).toHaveValue('1');
  await page.locator('[data-coalition-offer]').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,1))).toBe(true);
  await expect(page.locator('#buildMenu')).toBeHidden();
  await page.mouse.click(spot.x,spot.y,{button:'right'});
  await expect(page.locator('[data-coalition-leave]')).toBeVisible();
  await page.locator('[data-coalition-leave]').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,1))).toBe(false);
  const after=await page.evaluate(()=>{
    const g=window.__atlas.getGame();
    return {troops:g.factions[0].troops,orders:g.attackOrders.length};
  });
  expect(after.troops).toBe(before.troops);
  expect(after.orders).toBe(before.orders);
});

test('right clicked coalition request can be rejected by the AI for bad strategic value',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');await page.locator('[data-country="DE"]').click();
  const evaluation=await page.evaluate(()=>{
    const g=window.__atlas.getGame();g.paused=true;
    g.factions[0].troops=1;g.factions[1].troops=2500;g.recount();
    window.__atlas.refresh();return g.evaluateAlliance(0,1);
  });
  expect(evaluation.accepted).toBe(false);
  await rightClickForeign(page,1);
  await expect(page.locator('#buildMoney')).toContainText('GERINGER NUTZEN');
  await expect(page.locator('[data-coalition-offer]')).toBeVisible();
  await page.locator('[data-coalition-offer]').click();
  await expect(page.locator('#diplomacyFeedback')).toContainText(/abgelehnt/i);
  expect(await page.evaluate(()=>window.__atlas.getGame().isAllied(0,1))).toBe(false);
});
