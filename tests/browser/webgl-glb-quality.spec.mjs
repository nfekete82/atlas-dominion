import {test,expect} from '@playwright/test';

test('GLB A/B viewer compares identical local model using one shared camera',async({page})=>{
 test.setTimeout(85000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/glb-quality.html?asset=/src/assets/reborn/prototype/infantry-0.glb&kind=infantry',
  {waitUntil:'domcontentloaded'});
 await expect(page.locator('#stage canvas')).toBeVisible({timeout:15000});
 await expect(page.locator('#status')).toContainText('Dreiecke',{timeout:65000});
 await expect(page.locator('#right-label')).toContainText('originale PBR-Materialien');
 await page.locator('#mode').selectOption('legacy');
 await expect(page.locator('#status')).toContainText('Dreiecke',{timeout:65000});
 await expect(page.locator('#right-label')).toContainText('bisherige Sandforge');
 expect(errors).toEqual([]);
});

test('GLB audit rejects remote and traversal URLs',async({page})=>{
 await page.goto('/glb-quality.html',{waitUntil:'domcontentloaded'});
 await page.locator('#asset').fill('/src/assets/../../index.html');
 await page.locator('#load').click();
 await expect(page.locator('#error')).toContainText('Nur lokale GLB-Pfade');
});
