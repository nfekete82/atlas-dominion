import {test,expect} from '@playwright/test';

test('Generals-like shell impacts, metal ricochets and dust are visual-only and bounded',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&play=1&lite=1&pause=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const result=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,e=v.effects;
  const oldSee=g.canSee.bind(g);
  g.canSee=()=>true;
  const x=g.world.size*.54,y=g.world.size*.48;
  const origin={x:x-80,y};
  const shot=weapon=>({weapon,armored:true,targetClass:'armor',
   impactElevation:42,groundFrom:origin,groundTo:{x,y},hit:true,life:.48});
  const start={
   sparks:e.sparks.particles.length,dust:e.dust.particles.length,
   debris:e.debris.particles.length,blasts:e.stats.blasts
  };
  e.impactAt(shot('machinegun'));
  const metal={
   sparks:e.sparks.particles.length-start.sparks,
   debris:e.debris.particles.length-start.debris,
   dust:e.dust.particles.length-start.dust,
   blasts:e.stats.blasts-start.blasts
  };
  const beforeDust=e.dust.particles.length;
  e.impactAt({...shot('rifle'),armored:false,targetClass:'sand'});
  const dirt=e.dust.particles.length-beforeDust;
  e.impactAt(shot('rocket'));
  const explosions=e.stats.blasts-start.blasts;
  const tank={kind:'tank',id:99999,owner:0,hp:300,x,y};
  const beforeSmoke=e.smoke.particles.length;
  e.damagedVehicleSmoke([tank]);
  const engineSmoke=e.smoke.particles.length-beforeSmoke;
  e.damagedVehicleSmoke([tank]);
  const smokeTwice=e.smoke.particles.length-beforeSmoke;
  const meshPools=[e.sparks,e.dust,e.smoke,e.flames,e.debris].map(pool=>({
   size:pool.particles.length,cap:pool.max,
   instanced:pool.mesh.isInstancedMesh
  }));
  g.shots=[{...shot('machinegun'),from:origin,to:{x,y},owner:0,source:101}];
  v.battlefield.updateShots();
  const geometry=v.battlefield.tracer.geometry;
  const positions=geometry.getAttribute('position').array;
  const visible=geometry.drawRange.count;
  const streak=visible>=2?Math.hypot(positions[3]-positions[0],
   positions[4]-positions[1],positions[5]-positions[2]):999;
  g.canSee=oldSee;
  return {metal,dirt,explosions,engineSmoke,smokeTwice,meshPools,streak,visible};
 });
 expect(result.metal.sparks).toBeGreaterThanOrEqual(6);
 expect(result.metal.debris).toBeGreaterThanOrEqual(2);
 expect(result.metal.dust).toBeLessThan(3);
 expect(result.metal.blasts).toBe(0,'machinegun hit cannot explode');
 expect(result.dirt).toBeGreaterThan(3);
 expect(result.explosions).toBe(1);
 expect(result.engineSmoke).toBe(1);
 expect(result.smokeTwice).toBe(1,'damaged-vehicle plume is throttled');
 expect(result.meshPools.every(p=>p.instanced&&p.size<=p.cap)).toBe(true);
 expect(result.visible).toBe(2);
 expect(result.streak).toBeLessThan(25,'bright moving tracer cannot be a map-wide laser');
 expect(errors).toEqual([]);
});
