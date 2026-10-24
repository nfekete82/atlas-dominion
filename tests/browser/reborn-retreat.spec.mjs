import { test, expect } from '@playwright/test';

test('control: selected helicopter escapes active combat via M and Alt-right-click', async ({ page }) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/?debug&legacy');
  await page.locator('#loading').waitFor({state:'detached'});
  const pilotId=await page.evaluate(()=>{
    const {game:g,renderer:r}=window.__reborn;
    g.paused=true;g.aiClock=-1e8;g.units=[];
    g.world.blocked.fill(0);g.world.opaque.fill(0);
    const h=g.spawn(0,{x:1900,y:2100},'scout');
    const attacker=g.spawn(1,{x:2070,y:2100},'heavy');
    g.stop([attacker.id],true);g.updateVision();
    r.camera={x:1870,y:2100,zoom:1.25};r.boundCamera();r.render(0);
    return h.id;
  });
  await page.evaluate(()=>{
    const {game:g,renderer:r}=window.__reborn;g.paused=false;
    for(let i=0;i<12;i++)g.step(.05);
    g.paused=true;r.render(0);
  });
  const combat=await page.evaluate(id=>{
    const g=window.__reborn.game,h=g.units.find(u=>u.id===id);
    return {x:h.x,hp:h.hp,shots:g.shots.filter(s=>s.source===id).length};
  },pilotId);
  expect(combat.hp).toBeLessThan(360);
  const clickWorld=async(p,button='left',modifiers=[])=>{
    const s=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);
    expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,s)).toBe('world');
    await page.mouse.click(s.x,s.y,{button,modifiers});
  };
  const helicopter=await page.evaluate(async id=>{
    const {unitSelectionPoint}=await import('/src/reborn/unit-presentation.js');
    return unitSelectionPoint(window.__reborn.game.units.find(u=>u.id===id));
  },pilotId);
  await clickWorld(helicopter);
  expect(await page.evaluate(id=>window.__reborn.renderer.selected.has(id),pilotId)).toBe(true);
  await expect(page.locator('#selection-title')).toHaveText('Transportheli');

  await page.keyboard.press('m');
  await clickWorld({x:1600,y:2100});
  expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).orders[0].kind,pilotId)).toBe('move');
  await page.evaluate(()=>{
    const a=window.__reborn;a.game.paused=false;
    for(let i=0;i<10;i++)a.game.step(.05);
    a.game.paused=true;a.renderer.render(0);
  });
  const after=await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).x,pilotId);
  expect(after).toBeLessThan(combat.x-5);

  await clickWorld({x:2070,y:2100},'right',['Alt']);
  const orders=await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).orders,pilotId);
  expect(orders[0].kind).toBe('move');
  expect(orders[0].target).toBeUndefined();
  expect(errors).toEqual([]);
});
