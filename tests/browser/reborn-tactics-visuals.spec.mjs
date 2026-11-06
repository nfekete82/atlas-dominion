import {test,expect} from '@playwright/test';

test('tactical pause: large centred sharp text, blurred battlefield and sidebar, frozen simulation and both resume controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});await page.locator('#world').focus();
 for(const viewport of [{width:1440,height:1000},{width:800,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeVisible();
  const state=await page.evaluate(()=>{const label=document.querySelector('#pause-label'),title=label.querySelector('strong'),rect=label.getBoundingClientRect(),text=title.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,titleX:text.x+text.width/2,font:parseFloat(getComputedStyle(title).fontSize),blur:getComputedStyle(document.querySelector('#app')).filter,foreground:getComputedStyle(label).filter,inert:document.querySelector('#app').inert,time:window.__reborn.game.time};});
  expect(state.x).toBe(0);expect(state.y).toBe(0);expect(state.width).toBe(viewport.width);expect(state.height).toBe(viewport.height);expect(state.titleX).toBeCloseTo(viewport.width/2,0);expect(state.font).toBeGreaterThanOrEqual(30);expect(state.blur).toContain('blur(7px)');expect(state.foreground).toBe('none');expect(state.inert).toBe(true);
  await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__reborn.game.time)).toBe(state.time);
  if(viewport.width===1440)await page.screenshot({path:'artifacts/reborn/tactical-pause-large.png'});
  await page.getByRole('button',{name:'GEFECHT FORTSETZEN'}).click();await expect(page.locator('#pause-label')).toBeHidden();expect(await page.evaluate(()=>document.querySelector('#app').inert)).toBe(false);
 }
 await page.keyboard.press('Space');await page.keyboard.press('Escape');await expect(page.locator('#pause-dialog')).toBeVisible();expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#app')).filter)).toBe('none');
 await page.evaluate(()=>document.querySelector('#pause-dialog').close());await expect(page.locator('#pause-label')).toBeVisible();await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeHidden();expect(errors).toEqual([]);
});

test('terrain and turret: natural rock texture has no cyan crystals, map geometry survives painting, both refined rigs render',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?debug&perfTest&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const {game:g,renderer:r}=window.__reborn,{paintMesas}=await import('/src/reborn/terrain-presentation.js');
  const geometry=JSON.stringify(g.world.generated),navigation=g.world.blocked.slice(),mesa=g.world.generated.mesas.find(m=>m.crystals);
  const stone=new Image();stone.src='/src/assets/reborn/sandstone-strata-v1.png';await stone.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),x=Math.min(...mesa.outline.map(p=>p.x)),y=Math.min(...mesa.outline.map(p=>p.y));c.translate(30-x,30-y);paintMesas(c,[mesa],g.seed,stone);
  const pixels=c.getImageData(0,0,512,512).data;let cyan=0,painted=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>64){painted++;if(pixels[i+1]>pixels[i]*1.15&&pixels[i+2]>pixels[i]*1.1)cyan++;}
  const rigs=[0,1].map(owner=>{const a=r.structures.asset('turret',owner);return {revision:a.data.design.revision,views:a.data.turret.frames.length,parts:a.data.design.parts,imageLoaded:a.turret.complete};});
  return {cyan,painted,sameMap:geometry===JSON.stringify(g.world.generated),sameNavigation:navigation.every((v,i)=>v===g.world.blocked[i]),rigs};
 });
 expect(result.cyan).toBe(0);expect(result.painted).toBeGreaterThan(5000);expect(result.sameMap).toBe(true);expect(result.sameNavigation).toBe(true);for(const rig of result.rigs){expect(rig.revision).toBe(3);expect(rig.views).toBe(64);expect(rig.parts).toBeGreaterThanOrEqual(170);expect(rig.imageLoaded).toBe(true);}expect(errors).toEqual([]);
});
