import {test,expect} from '@playwright/test';

async function arrive(page) {
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
}
async function begin(page,size='small'){
 await page.locator('#new').click();
 await expect(page.locator('#new-dialog')).toBeVisible();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
 await page.locator('#map-size').selectOption(size);
 await page.locator('#new-dialog button[value="new"]').click();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
}

test('title screen: reload opens real desert menu, map selection can return without starting, Esc cannot bypass title',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await arrive(page);
 await expect(page.locator('#main-dialog')).toHaveAttribute('open','');
 await expect(page.locator('#main-continue')).toBeDisabled();
 await expect(page.locator('#main-load')).toBeDisabled();
 await expect(page.locator('#new')).toBeEnabled();
 const scene=await page.locator('#main-dialog').evaluate(node=>({
  background:getComputedStyle(node).backgroundImage,paused:document.querySelector('#simulation-status')?.textContent,
  width:Math.round(node.getBoundingClientRect().width),viewport:innerWidth
 }));
 expect(scene.background).toContain('menu-desert.png');
 expect(scene.width).toBeGreaterThanOrEqual(scene.viewport-2);
 expect(scene.paused).toContain('PAUSIERT');
 await page.keyboard.press('Escape');
 await expect(page.locator('#main-dialog')).toBeVisible();
 await page.locator('#new').click();
 await expect(page.locator('#new-dialog')).toBeVisible();
 await page.locator('#new-dialog button[value="cancel"]').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 await begin(page,'small');
 await page.reload();
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-continue')).toBeDisabled();
 expect(errors).toEqual([]);
});

test('title screen: existing saved game is continued from reload, while in-page main menu resumes live session',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await arrive(page);
 await begin(page,'small');
 await page.locator('#menu').click();
 await expect(page.locator('#pause-dialog')).toBeVisible();
 await page.locator('#save').click();
 await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');
 await page.reload();
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#main-continue')).toBeEnabled();
 await expect(page.locator('#main-load')).toBeEnabled();
 await page.locator('#main-continue').click();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
 await expect(page.locator('#notices')).toContainText('Kampagne geladen');
 await page.locator('#menu').click();
 await page.locator('#to-main').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#main-continue')).toBeEnabled();
 await page.locator('#main-continue').click();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
 expect(errors).toEqual([]);
});
