import {test,expect} from '@playwright/test';

test('campaign: new game prompts for small, medium and large 4/8/12 bastion maps',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#new-dialog')).toBeVisible();
 await expect(page.locator('#map-size option')).toHaveCount(3);
 await page.locator('#map-size').selectOption('small');
 await page.locator('#new-dialog button[value="new"]').click();
 await expect(page.locator('#territories')).toContainText('/ 4');
 await page.locator('#menu').click();
 await page.locator('#new').click();
 await page.locator('#map-size').selectOption('medium');
 await page.locator('#new-dialog button[value="new"]').click();
 await expect(page.locator('#territories')).toContainText('/ 8');
 await page.locator('#menu').click();
 await page.locator('#new').click();
 await page.locator('#map-size').selectOption('large');
 await page.locator('#new-dialog button[value="new"]').click();
 await expect(page.locator('#territories')).toContainText('/ 12');
 expect(errors).toEqual([]);
});
