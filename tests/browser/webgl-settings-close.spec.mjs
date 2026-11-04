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
