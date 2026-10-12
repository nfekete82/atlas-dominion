import {test,expect} from '@playwright/test';

test('music never autoplay on load; controls are independent and persist after reload',async({page})=>{
  await page.goto('/?debug');
  await expect(page.locator('#audioPanel')).toBeHidden();
  const initial=await page.evaluate(()=>window.__atlas.audio.debug());
  expect(initial.contextCreated).toBe(false);
  expect(initial.musicPlaying).toBe(false);

  await page.locator('#soundBtn').click();
  await expect(page.locator('#audioPanel')).toBeVisible();
  await expect(page.locator('#audioMusicEnabled')).not.toBeChecked();
  await expect(page.locator('#audioEffectsEnabled')).toBeChecked();

  await page.locator('#audioMusicEnabled').check();
  const active=await page.evaluate(()=>({
    audio:window.__atlas.audio.debug(),prefs:window.__atlas.audio.snapshot(),
  }));
  expect(active.prefs.music).toBe(true);
  expect(active.audio.musicGesture).toBe(true);

  await page.locator('#audioMusicVolume').evaluate(el=>{
    el.value='15';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#audioEffectsVolume').evaluate(el=>{
    el.value='37';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#audioMasterVolume').evaluate(el=>{
    el.value='52';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#audioEffectsEnabled').uncheck();
  await expect(page.locator('#audioMusicValue')).toHaveText('15 %');
  await expect(page.locator('#audioEffectsValue')).toHaveText('37 %');
  await expect(page.locator('#audioMasterValue')).toHaveText('52 %');
  await expect(page.locator('#audioStatus')).toContainText('Musik');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas-dominion-audio-v1')));
  expect(saved).toEqual({music:true,effects:false,master:52,musicVolume:15,effectsVolume:37});

  await page.locator('#audioClose').click();
  await expect(page.locator('#audioPanel')).toBeHidden();
  await page.reload();
  await expect(page.locator('#audioPanel')).toBeHidden();
  const afterReload=await page.evaluate(()=>({
    context:window.__atlas.audio.debug(),prefs:window.__atlas.audio.snapshot(),
  }));
  expect(afterReload.prefs).toEqual(saved);
  expect(afterReload.context.contextCreated).toBe(false);
  expect(afterReload.context.musicPlaying).toBe(false);

  // Opening controls is an explicit user gesture and may resume opted-in music.
  await page.locator('#soundBtn').click();
  await expect(page.locator('#audioMusicEnabled')).toBeChecked();
  await expect(page.locator('#audioEffectsEnabled')).not.toBeChecked();
  await page.locator('#audioPreview').click();
  await expect(page.locator('#audioStatus')).toContainText('Effekte einschalten');
  await page.locator('#audioEffectsEnabled').check();
  await page.locator('#audioPreview').click();
  await expect(page.locator('#audioStatus')).toContainText('Klangprobe');
});

test('sound mixer does not mutate the match, persists when a country is changed, and supports Escape',async({page})=>{
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
  const before=await page.evaluate(()=>JSON.stringify(window.__atlas.getGame().exportSave()));
  await page.locator('#soundBtn').click();
  await page.locator('#audioMusicEnabled').check();
  await page.locator('#audioEffectsEnabled').uncheck();
  await page.locator('#audioMasterVolume').evaluate(el=>{
    el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#audioPanel')).toBeHidden();
  const after=await page.evaluate(()=>JSON.stringify(window.__atlas.getGame().exportSave()));
  expect(after).toBe(before);
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-expanded','false');
});

test('music and effects can be switched completely off without any audio bus remaining active',async({page})=>{
  await page.goto('/?debug');
  await page.locator('#soundBtn').click();
  await page.locator('#audioMusicEnabled').check();
  await page.locator('#audioMusicEnabled').uncheck();
  await page.locator('#audioEffectsEnabled').uncheck();
  const state=await page.evaluate(()=>({
    settings:window.__atlas.audio.snapshot(),debug:window.__atlas.audio.debug(),
  }));
  expect(state.settings.music).toBe(false);
  expect(state.settings.effects).toBe(false);
  expect(state.debug.musicPlaying).toBe(false);
  await expect(page.locator('#soundBtn')).toHaveText('♪');
});
