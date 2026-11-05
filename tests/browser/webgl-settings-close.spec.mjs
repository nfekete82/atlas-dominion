import {test,expect} from '@playwright/test';

test('WebGL settings can be closed using X and Escape',async({page})=>{
  await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1');
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true);

  const panel=page.locator('#sf-classic-root');
  const settings=panel.locator('#sf-settings');
  const trigger=panel.locator('.sf-tool-button[aria-label="Karteneinstellungen anzeigen"]');

  await trigger.click();
  await expect(panel).toHaveClass(/sf-settings-open/);
  await expect(settings).toBeVisible();

  await panel.locator('#sf-settings-close').click();
  await expect(panel).not.toHaveClass(/sf-settings-open/);

  await trigger.click();
  await expect(panel).toHaveClass(/sf-settings-open/);

  await page.keyboard.press('Escape');
  await expect(panel).not.toHaveClass(/sf-settings-open/);
});

test('tactical pause shows authentic Sandforge logo and headline',async({page})=>{
 test.setTimeout(110000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 await page.keyboard.press('Escape');
 const dialog=page.locator('#sf3d-pause-dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('.sf3d-pause-title')).toHaveText('TAKTISCHE PAUSE');
 const logo=dialog.locator('.sandforge-pause-logo');
 await expect(logo).toHaveAttribute('src','/src/assets/reborn/sandforge-logo-transparent.webp');
 await expect(logo).toBeVisible();
 await expect.poll(()=>logo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(dialog.locator('#sf3d-pause-resume')).toBeVisible();
 await dialog.locator('#sf3d-pause-resume').click();
 await expect(dialog).not.toBeVisible();
});
