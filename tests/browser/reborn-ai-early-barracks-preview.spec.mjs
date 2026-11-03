import {test,expect} from '@playwright/test';

test('early barracks preview applies to a real bootstrapped four-bastion campaign',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&map=small&seed=2026&aiOpening=early-barracks');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(()=>{
  const g=window.__reborn.game;
  const startedWithoutHQ=g.needsHeadquarters(1);
  const initially=g.tactical.earlyEconomyMode;
  g.paused=false;
  for(let i=0;i<900;i++)g.step(.05);
  return {version:g.world.mapVersion,startedWithoutHQ,initially,
   barracks:g.bases.filter(b=>b.owner===1&&b.kind==='barracks').length,
   firstAiPlan:g.tactical.state.lastPlan,credits:g.credits[1],status:g.status};
 });
 expect(result.version).toBe(11);
 expect(result.startedWithoutHQ).toBe(true,'actual player campaign, not prebuilt AI benchmark');
 expect(result.initially).toBe('barracks-first');
 expect(result.barracks).toBeGreaterThan(0);
 expect(result.firstAiPlan).toBeGreaterThanOrEqual(25);
 expect(errors).toEqual([]);
});
test('early economy preview remains disabled by default and on bigger maps',async({page})=>{
 for(const path of ['/?debug&perfTest&map=small&seed=2026',
  '/?debug&perfTest&map=medium&seed=2026&aiOpening=early-barracks']){
  await page.goto(path);
  await page.locator('#loading').waitFor({state:'detached'});
  const mode=await page.evaluate(()=>window.__reborn.game.tactical.earlyEconomyMode);
  expect(mode).toBe('classic');
 }
});
