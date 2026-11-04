import {test,expect} from '@playwright/test';

test('moving infantry and vehicles leave short-lived footprint and tire decals',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const stamps=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,g=view.game,tracks=view.groundTracks;
  const soldier=g.units.find(u=>u.owner===0&&u.kind==='infantry');
  if(!soldier)throw new Error('missing starting infantry');
  // The paused renderer does not change physics, so shift an isolated actor
  // during the test to verify stamping without waiting for AI/game clocks.
  const original={x:soldier.x,y:soldier.y};
  tracks.capture();
  soldier.x+=33;tracks.capture();
  soldier.x=original.x;soldier.y=original.y;tracks.capture();
  const fake={id:900001,kind:'rover',owner:0,hp:100,carrier:null,
   x:original.x+90,y:original.y+90};
  g.units.push(fake);
  tracks.capture();
  fake.y+=55;tracks.capture();
  g.units.pop();tracks.capture();
  const firstFade=tracks.foot.fading.array[0];
  const vehicleFade=tracks.vehicle.fading.array[0];
  return {
   foot:tracks.foot.mesh.count,vehicle:tracks.vehicle.mesh.count,
   footName:tracks.foot.mesh.name,vehicleName:tracks.vehicle.mesh.name,
   footFade:firstFade,vehicleFade,footTTL:tracks.foot.ttl,
   vehicleTTL:tracks.vehicle.ttl,
   footWidth:Math.hypot(...tracks.foot.mesh.instanceMatrix.array.slice(0,3)),
   footLength:Math.hypot(...tracks.foot.mesh.instanceMatrix.array.slice(8,11)),
   footAlpha:tracks.foot.mesh.material.uniforms.baseAlpha.value
  };
 });
 expect(stamps.foot).toBeGreaterThan(0);
 expect(stamps.vehicle).toBeGreaterThanOrEqual(2);
 expect(stamps.footName).toBe('visual-moving-footprints');
 expect(stamps.vehicleName).toBe('visual-moving-vehicle-tracks');
 expect(stamps.footFade).toBeGreaterThan(.9);
 expect(stamps.vehicleFade).toBeGreaterThan(.9);
 expect(stamps.vehicleTTL).toBeGreaterThan(stamps.footTTL);
 expect(stamps.footWidth).toBeGreaterThanOrEqual(10);
 expect(stamps.footLength).toBeGreaterThanOrEqual(20);
 expect(stamps.footAlpha).toBeGreaterThanOrEqual(.75);

 const expired=await page.evaluate(()=>{
  const tracks=window.__sandforgeWebGL.groundTracks;
  tracks.clock+=tracks.vehicle.ttl+1;
  tracks.update(.02,false);
  return {foot:tracks.foot.fading.array[0],vehicle:tracks.vehicle.fading.array[0],
   visualOnly:tracks.foot.mesh.userData.nonPlayable&&tracks.vehicle.mesh.userData.nonPlayable};
 });
 expect(expired.foot).toBe(0);
 expect(expired.vehicle).toBe(0);
 expect(expired.visualOnly).toBe(true);
});

test('an unselected ground right-click still produces a short temporary destination circle',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const target=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,canvas=view.renderer.domElement;
  const world=view.game.world,unit=view.game.units.find(u=>u.owner===0&&u.hp>0);
  const p=world.nearest({x:unit.x+180,y:unit.y+40});
  const camera=view.camera,controls=view.controls;
  const center=view.battlefield.pos(p.x,p.y);
  const delta=center.clone().sub(controls.target);
  controls.target.add(delta);camera.position.add(delta);controls.update();
  const rect=canvas.getBoundingClientRect();
  center.project(camera);
  return {x:rect.left+(center.x*.5+.5)*rect.width,
   y:rect.top+(.5-center.y*.5)*rect.height};
 });
 expect(target.x).toBeGreaterThan(0);
 expect(target.x).toBeLessThan(1300);
 expect(target.y).toBeGreaterThan(0);
 expect(target.y).toBeLessThan(590);
 await page.mouse.click(target.x,target.y,{button:'right'});
 const marker=await page.evaluate(()=>{
  const pulse=window.__sandforgeWebGL.battlefield.commandPulse;
  return {visible:pulse.visible,opacity:pulse.material.opacity,transient:pulse.userData.commandPulse};
 });
 expect(marker.visible).toBe(true);
 expect(marker.opacity).toBeGreaterThan(.3);
 expect(marker.transient).toBe(true);
 await page.waitForFunction(()=>!window.__sandforgeWebGL.battlefield.commandPulse.visible,
   null,{timeout:4000});
});
