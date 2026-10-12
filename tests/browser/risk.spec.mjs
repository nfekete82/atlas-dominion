import {test,expect} from '@playwright/test';

test('Risk hybrid loads independently from the realtime app and draws the province map',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/risk.html');
  await expect(page.locator('#country')).toHaveText('Deutschland');
  await expect(page.locator('#roundLabel')).toHaveText('RUNDE 1');
  await expect(page.locator('#phaseDescription')).toHaveText('Verstärken');
  await expect(page.locator('#riskCanvas')).toBeVisible();
  const size=await page.locator('#riskCanvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  expect(size.width).toBeGreaterThan(500);expect(size.height).toBeGreaterThan(300);
  await expect(page.locator('#provinceCount')).not.toHaveText('0');
  expect(errors).toEqual([]);
});

test('Risk hybrid can deploy, develop and complete a full 50-country round',async({page})=>{
  await page.goto('/risk.html');
  await page.locator('#quantity').fill('3');
  await page.locator('#deploy').click();
  await expect(page.locator('#reserveCount')).toHaveText('2');
  await page.locator('#nextPhase').click();
  await expect(page.locator('#phaseDescription')).toHaveText('Städte entwickeln');
  await page.locator('#upgrade').click();
  await expect(page.locator('#goldCount')).toHaveText('0');
  await page.locator('#nextPhase').click();
  await expect(page.locator('#phaseDescription')).toHaveText('Angreifen');
  await page.locator('#nextPhase').click();
  await expect(page.locator('#phaseDescription')).toHaveText('Verschieben');
  await page.locator('#nextPhase').click();
  await expect(page.locator('#roundLabel')).toHaveText('RUNDE 2');
  await expect(page.locator('#phaseDescription')).toHaveText('Verstärken');
  const savedGold=await page.locator('#goldCount').textContent();
  await page.reload();
  await expect(page.locator('#roundLabel')).toHaveText('RUNDE 2');
  await expect(page.locator('#goldCount')).toHaveText(savedGold);
});

test('Risk mode links back to the existing realtime game',async({page})=>{
  await page.goto('/');
  await expect(page.locator('a[href="/risk.html"]')).toBeVisible();
  await page.locator('a[href="/risk.html"]').click();
  await expect(page).toHaveURL(/risk\.html$/);
  await page.locator('a[href="/"]').first().click();
  await expect(page.locator('#battleCanvas')).toBeVisible();
});
