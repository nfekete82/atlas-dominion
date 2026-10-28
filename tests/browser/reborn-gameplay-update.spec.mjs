import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const evidence='artifacts/gameplay-update';
async function start(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.paused=true;g.aiClock=-1e8;g.units=[];g.credits=[10000,10000];g.world.blocked.fill(0);g.world.opaque.fill(0);g.explored[0].fill(1);const h=g.bases[0];g.bases.push({...h,id:1800,kind:'barracks',hp:800,queue:[],queueTypes:[],production:0,buildRemaining:0});a.renderer.selectedBase=1800;g.recruit(1800,'infantry');g.recruit(1800,'medic');g.recruit(h.id,'engineer');a.refresh();});return errors;}
for(const dpr of [1,2])test(`gameplay UI: 14px shared Retina role circles, complete proportional portraits and bounded sidebar at DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({deviceScaleFactor:dpr});const page=await context.newPage();try{const errors=await start(page);fs.mkdirSync(evidence,{recursive:true});
 for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){await page.setViewportSize({width,height});
  const result=await page.evaluate(async()=>{
   const {drawRoleBadge}=await import('/src/reborn/role-visuals.js');const colors={infantry:[39,127,206],medic:[38,155,98],engineer:[214,157,28]};const badges=[];
   for(const kind of Object.keys(colors)){
    const card=document.querySelector(`[data-unit="${kind}"]`),badge=card.querySelector('.role-badge'),image=card.querySelector('img'),b=badge.getBoundingClientRect(),i=image.getBoundingClientRect(),s=getComputedStyle(badge),url=s.backgroundImage.slice(5,-2),img=new Image();img.src=url;await img.decode();
    const c=document.createElement('canvas');c.width=c.height=28;const cc=c.getContext('2d');cc.drawImage(img,0,0);const actual=cc.getImageData(0,0,28,28).data,vector=document.createElement('canvas');vector.width=vector.height=28;drawRoleBadge(vector.getContext('2d'),kind,14,14,28);const expected=vector.getContext('2d').getImageData(0,0,28,28).data;
    badges.push({kind,width:b.width,height:b.height,native:img.width,color:Array.from(cc.getImageData(14,3,1,1).data).slice(0,3),expectedColor:colors[kind],shared:actual.every((v,i)=>v===expected[i]),fit:getComputedStyle(image).objectFit,aspect:image.naturalWidth/image.naturalHeight,rectRatio:i.width/i.height,fits:b.right<=card.getBoundingClientRect().right&&b.bottom<card.querySelector('.card-meta').getBoundingClientRect().top});
   }
   const side=document.querySelector('#sidebar'),r=side.getBoundingClientRect();return {badges,overflow:document.body.scrollWidth>innerWidth,side:r.right,inner:innerWidth,cards:[...document.querySelectorAll('.catalog-card:not([hidden])')].map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height})),small:[...document.querySelectorAll('#queue-slots .role-badge,#recruit .role-badge,[data-context-unit] .role-badge')].map(b=>b.getBoundingClientRect().width)};
  });
  for(const b of result.badges){expect(b.width).toBe(14);expect(b.height).toBe(14);expect(b.native).toBe(28);expect(b.color).toEqual(b.expectedColor);expect(b.shared&&b.fits).toBe(true);expect(b.fit).toBe('contain');expect(b.aspect).toBe(1.6);}
  expect(result.overflow).toBe(false);expect(result.side).toBeLessThanOrEqual(width);expect(result.cards.every(c=>c.width<=128&&c.height<=110)).toBe(true);expect(result.small.every(w=>w===12)).toBe(true);
  await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.units=[];const u=g.spawn(0,{x:1900,y:2100},'medic');u.xp=278.5;a.renderer.selectedBase=null;a.renderer.selected=new Set([u.id]);a.renderer.camera.x=u.x;a.renderer.camera.y=u.y;a.renderer.boundCamera();g.updateVision();a.refresh();a.renderer.render(0);});
  await expect(page.locator('#selection-title')).toHaveText('Sanitäter · Elite');await expect(page.locator('#veterancy-xp')).toHaveText('278 XP · 222 XP bis Held');await expect(page.locator('#veterancy-bonuses')).toContainText('+15 % Heilrate');
  const fits=await page.locator('#veterancy').evaluate(n=>{const b=n.getBoundingClientRect(),p=document.querySelector('#selection-panel').getBoundingClientRect();return b.bottom<=p.bottom&&b.right<=p.right;});expect(fits).toBe(true);
  await page.screenshot({path:`${evidence}/ui-${width}-dpr${dpr}.png`});
  await page.evaluate(()=>{const a=window.__reborn;a.game.units[0].xp=500;a.refresh();});await expect(page.locator('#veterancy-xp')).toContainText('HELD · MAXIMALER RANG');
 }
 expect(errors).toEqual([]);
 }finally{await context.close();}
});
test('gameplay: storm HUD, fog, frozen animation and quiet reusable wind respect pause, saves and reduced motion',async({page})=>{
 const errors=await start(page);await page.setViewportSize({width:1440,height:900});await page.mouse.click(500,300);
 const state=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game;await a.audio.unlock();a.audio.ambience=true;g.units=[];const u=g.spawn(0,{x:1900,y:1900},'tank'),enemy=g.spawn(1,{x:2140,y:1900});u.hold=true;enemy.cooldown=1e8;a.renderer.selected=new Set([u.id]);a.renderer.selectedBase=null;a.renderer.camera.x=2000;a.renderer.camera.y=1900;a.renderer.boundCamera();g.updateVision();
  const before=g.canSee(0,enemy),warning=g.weather.endsAt;g.time=warning-.05;g.paused=false;g.step();g.paused=true;a.refresh();const warningText=document.querySelector('#weather-status').textContent;
  g.time=g.weather.endsAt-.05;g.paused=false;g.step();g.paused=true;a.refresh();a.renderer.render(0);const during=g.canSee(0,enemy);
  const c=a.renderer.context,first=c.getImageData(0,0,32,32).data.slice();a.renderer.render(1);const second=c.getImageData(0,0,32,32).data;const frozen=first.every((v,i)=>v===second[i]);
  const wind=a.audio.wind;await a.save();await a.load();a.game.paused=true;a.refresh();a.audio.update(a.game,a.renderer);const gain=a.audio.wind.gain.value;
  return {before,during,warningText,frozen,phase:a.game.weather.phase,xp:a.game.units.find(v=>v.id===u.id).xp,sameWind:wind===a.audio.wind,gain};
 });
 expect(state.before).toBe(true);expect(state.during).toBe(false);expect(state.warningText).toContain('STURMWARNUNG');expect(state.phase).toBe('SANDSTORM');expect(state.frozen).toBe(true);expect(state.sameWind).toBe(true);await expect(page.locator('#weather-status')).toContainText('SANDSTURM');
 await page.evaluate(()=>{const a=window.__reborn;a.game.time+=8;a.game.weather.update(a.game.time);a.renderer.units.particles.enabled=false;a.renderer.render(0);});await page.screenshot({path:`${evidence}/storm-static.png`});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('#loading').waitFor({state:'detached'});expect(await page.evaluate(()=>window.__reborn.renderer.reducedMotion)).toBe(true);expect(errors).toEqual([]);
});
