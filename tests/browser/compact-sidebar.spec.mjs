import {test,expect} from '@playwright/test';

test('compact empire sidebar keeps primary military stats visible and collapses optional details',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
  await expect(page.locator('#troopCount')).toBeVisible();
  await expect(page.locator('#incomeCount')).toBeVisible();
  await expect(page.locator('#mobileTroops')).toBeVisible();
  await expect(page.locator('.troop-breakdown')).not.toHaveAttribute('open','');
  const cells=await page.locator('.stat').first().evaluate(e=>e.getBoundingClientRect().height);
  expect(cells).toBeLessThan(125);
  await page.locator('.troop-breakdown summary').click();
  await expect(page.locator('.troop-breakdown')).toHaveAttribute('open','');
  await expect(page.locator('#frontTroops')).toBeVisible();
  await expect(page.locator('.defense-extra')).not.toHaveAttribute('open','');
  await page.locator('.defense-extra summary').click();
  await expect(page.locator('.defense-extra')).toHaveAttribute('open','');
  await expect(page.locator('#casualtyReport')).toBeVisible();
  await expect(page.locator('.diplomacy-help')).not.toHaveAttribute('open','');
  await page.locator('.diplomacy-help summary').click();
  await expect(page.locator('.diplomacy-help')).toHaveAttribute('open','');
});

test('ranking defaults to 12 nations and can expand to all without losing selection',async({page})=>{
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await expect(page.locator('#leaderboard .power')).toHaveCount(12);
  await page.locator('#leaderboardToggle').click();
  await expect(page.locator('#leaderboard .power')).toHaveCount(50);
  await page.locator('#leaderboardToggle').click();
  await expect(page.locator('#leaderboard .power')).toHaveCount(12);
});
