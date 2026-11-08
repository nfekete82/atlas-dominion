import {test,expect} from '@playwright/test';

test('3D blue/red faction accents are present on units and buildings, without altering game state',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const info=await page.evaluate(()=>{
  const scene=window.__sandforgeWebGL;
  const g=scene.game,field=scene.battlefield;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  if(!unit)throw Error('No player unit on battlefield');
  const enemy=g.spawn(1,{x:unit.x+100,y:unit.y+100},'infantry');
  field.sync(false,0,false,1);
  const read=id=>{
   const e=field.units.get(id),acc=e?.factionAccents;
   return {count:acc?.children.length??0,color:acc?.children[0]?.material.color.getHexString(),
    owner:acc?.userData.owner,visualOnly:acc?.userData.visualOnly,
    intercepts:acc?.children.some(m=>m.raycast.toString()!=='()=>{}'),
    nodeVisible:e?.node.visible};
  };
  return {blue:read(unit.id),red:read(enemy.id),units:g.units.length,
   blueUnitOwner:unit.owner,redUnitOwner:enemy.owner};
 });
 expect(info.blue.count).toBeGreaterThanOrEqual(4);
 expect(info.red.count).toBeGreaterThanOrEqual(4);
 expect(info.blue.color).toBe('2e9fc8');
 expect(info.red.color).toBe('cf5e4f');
 expect(info.blue.owner).toBe(0);
 expect(info.red.owner).toBe(1);
 expect(info.blue.visualOnly).toBe(true);
 expect(info.red.visualOnly).toBe(true);
 expect(info.blue.intercepts).toBe(false);
 expect(info.red.intercepts).toBe(false);
 expect(info.blueUnitOwner).toBe(0);
 expect(info.redUnitOwner).toBe(1);
 expect(errors).toEqual([]);
});
