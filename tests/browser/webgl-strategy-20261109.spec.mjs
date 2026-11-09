import {test,expect} from '@playwright/test';

test('real WebGL strategic research, silo countdown and interceptor controls are playable',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});

 const fixture=await page.evaluate(()=>{
  const {game:g,battlefield:b,scene}=window.__sandforgeWebGL;
  const {size}=g.world;
  const names=['headquarters','research','silo','interceptor'];
  const positions=[
   [.20,.25],[.30,.25],[.43,.25],[.55,.25]
  ];
  const specs=[
   ['headquarters',300,1200],
   ['research',950,950],
   ['silo',5000,1900],
   ['interceptor',2500,1150]
  ];
  for(let i=0;i<names.length;i++){
   const kind=names[i],spec=window.__sandforgeWebGL.game.bases.find(q=>q.kind===kind);
   g.bases.push({
    id:9920+i,owner:0,kind,hp:spec?.hp??specs[i][2],
    x:size*positions[i][0],y:size*positions[i][1],
    territory:0,radius:kind==='silo'?91:kind==='interceptor'?56:kind==='research'?59:86,
    queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null,
    ...(kind==='silo'?{siloCharge:0}:{}),
    ...(kind==='interceptor'?{interceptorAmmo:2}:{})
   });
  }
  g.credits[0]=50_000;
  g.explored[0].fill(1);
  g.updateVision();
  b.selected.clear();b.selectedBase=9921;b.drawInterface();b.sync(true);
  return {
   names:names.slice(1).map(k=>Boolean(scene.getObjectByName('Strategic_'+k))),
   research:g.research[0].completed.length
  };
 });
 expect(fixture.names).toEqual([true,true,true]);
 expect(fixture.research).toBe(0);
 await expect(page.locator('button[data-tab="research"]')).toBeVisible();
 await page.locator('button[data-tab="research"]').click();
 const research=page.locator('[data-upgrade="armor1"]');
 await expect(research).toBeVisible();
 await expect(research).toBeEnabled();
 await research.click();
 await expect(research).toBeDisabled();
 const after=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  return {credits:g.credits[0],active:g.research[0].active,seconds:g.research[0].remaining};
 });
 expect(after.active).toBe('armor1');
 expect(after.credits).toBe(49_200);
 expect(after.seconds).toBe(40);

 await page.evaluate(()=>{
  const b=window.__sandforgeWebGL.battlefield;
  b.selectedBase=9922;b.drawInterface();
 });
 await expect(page.locator('#sf-strategic-fire')).toBeVisible();
 await expect(page.locator('#sf-strategic-fire')).toBeEnabled();
 await expect(page.locator('#sf-selection')).toContainText('RAKETE BEREIT');
 await page.locator('#sf-strategic-fire').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.strategicTargetMode)).toBe(true);

 const target=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  const p={x:g.world.size*.7,y:g.world.size*.7};
  const launched=g.launchStrategicMissile(0,p);
  window.__sandforgeWebGL.battlefield.strategicTargetMode=false;
  window.__sandforgeWebGL.battlefield.drawInterface();
  return {launched,count:g.strategicMissiles.length,charge:
   g.bases.find(b=>b.id===9922).siloCharge};
 });
 expect(target.launched).toBe(true);
 expect(target.count).toBe(1);
 expect(target.charge).toBe(600);
 await expect(page.locator('#sf-strategic-fire')).toBeDisabled();
 await expect(page.locator('#sf-selection')).toContainText('Ladezeit');

 await page.evaluate(()=>{
  const b=window.__sandforgeWebGL.battlefield;
  b.selectedBase=9923;b.drawInterface();
 });
 await expect(page.locator('#sf-interceptor-rearm')).toBeVisible();
 await page.locator('#sf-interceptor-rearm').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.bases.find(b=>b.id===9923).interceptorAmmo)).toBe(3);
 await expect(page.locator('#sf-interceptor-rearm')).toBeDisabled();
 expect(errors).toEqual([]);
});

test('strategic missile launches visibly in real 3D and respects zoom/fog',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&play=1&lite=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const id=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  g.credits[0]=20_000;g.explored[0].fill(1);
  g.bases.push({
   id:9952,owner:0,kind:'silo',hp:1900,x:g.world.size*.22,
   y:g.world.size*.22,territory:0,radius:91,queue:[],queueTypes:[],
   production:0,buildRemaining:0,cooldown:0,rally:null,siloCharge:0
  });
  if(!g.launchStrategicMissile(0,{x:g.world.size*.67,y:g.world.size*.72}))
   throw Error('Strategic launch rejected');
  return g.strategicMissiles[0].id;
 });
 await expect.poll(()=>page.evaluate(id=>{
  const {scene}=window.__sandforgeWebGL;
  return Boolean(scene.getObjectByName('Strategic_Missile_'+id));
 },id),{timeout:5000}).toBe(true);
 const visible=await page.evaluate(id=>{
  const v=window.__sandforgeWebGL;
  const mesh=v.scene.getObjectByName('Strategic_Missile_'+id);
  return {visible:mesh.visible,altitude:mesh.position.y,
   visualOnly:mesh.userData.visualOnly,nonPlayable:mesh.userData.nonPlayable};
 },id);
 expect(visible.altitude).toBeGreaterThan(50);
 expect(visible.visualOnly).toBe(true);
 expect(visible.nonPlayable).toBe(true);
 expect(errors).toEqual([]);
});
