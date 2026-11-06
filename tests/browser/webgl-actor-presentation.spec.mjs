import {test,expect} from '@playwright/test';
test('3D soldiers: health changes, weapon fire, hit recoil and death effect follow actual simulation state',async({page})=>{
 test.setTimeout(115000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const before=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0);
  const entry=b.units.get(unit.id);
  if(!entry)throw new Error('Missing 3D unit');
  const initial={hp:unit.hp,life:entry.presentation.bar.previousHp,bars:b.presentation.stats.visibleBars};
  unit.hp=Math.max(1,unit.hp-20);
  b.sync(true,.05,false,1);
  const damage={hp:entry.presentation.bar.previousHp,hurt:entry.presentation.hurtTime,
   fill:entry.presentation.bar.fill.scale.x,color:'#'+entry.presentation.bar.fillMaterial.color.getHexString()};
  g.shots.push({from:{x:unit.x,y:unit.y},to:{x:unit.x+10,y:unit.y+10},source:unit.id,
   owner:0,hit:true,weapon:'rifle',life:.4,at:g.time});
  b.sync(true,.05,false,1);
  const flash={trigger:entry.presentation.shotTrigger,shown:entry.presentation.flash.visible};
  unit.hp=0;
  b.sync(true,.05,false,1);
  const corpse=a.scene.children.filter(x=>x.userData.deathEffect);
  const removed=!b.units.has(unit.id);
  b.presentation.stepRemnants(3.3,true);
  return {initial,damage,flash,corpses:corpse.length,removed,remaining:a.scene.children.filter(x=>x.userData.deathEffect).length};
 });
 expect(before.damage.hp).toBeLessThan(before.initial.hp);
 expect(before.damage.hurt).toBeGreaterThan(0);
 expect(before.flash.trigger).toBeGreaterThan(0);
 expect(before.flash.shown).toBe(true);
 expect(before.corpses).toBeGreaterThan(0);
 expect(before.removed).toBe(true);
 expect(before.remaining).toBe(0);
 await page.locator('[data-action="health"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.presentation.showHealth)).toBe('selected');
 await page.locator('[data-action="health"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.presentation.showHealth)).toBe('off');
 expect(errors).toEqual([]);
});
