import {test,expect} from '@playwright/test';

test('real WebGL unit PBR surfaces are subtly team-tinted; no floating blue/red block geometry',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const data=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,g=view.game,field=view.battlefield;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  if(!unit)throw Error('Player unit missing');
  const opponent=g.spawn(1,{x:unit.x+100,y:unit.y+90},'infantry');
  field.sync(false,0,false,1);
  const read=id=>{
   const entry=field.units.get(id),colored=[];
   entry.node.traverse(obj=>{
    if(!obj.isMesh)return;
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
     if(mat?.userData?.sandforgeFactionTint)colored.push({
      color:mat.color.getHexString(),original:mat.userData.sandforgeBaseColor,
      textureRetained:!!mat.map||mat.map===null,weight:mat.roughness
     });
    }
   });
   return {count:colored.length,colored,owner:entry.factionOwner,
    floatingBoxes:entry.node.children.filter(c=>c.name.startsWith('sandforge-team-accents-')).length};
  };
  return {blue:read(unit.id),red:read(opponent.id),
   sceneBoxes:view.scene.children.filter(c=>c.name.includes('sandforge-team-accents')).length};
 });
 expect(data.blue.count).toBeGreaterThan(0);
 expect(data.red.count).toBeGreaterThan(0);
 expect(data.blue.owner).toBe(0);
 expect(data.red.owner).toBe(1);
 expect(data.blue.floatingBoxes).toBe(0);
 expect(data.red.floatingBoxes).toBe(0);
 expect(data.sceneBoxes).toBe(0);
 expect(data.blue.colored.some(c=>parseInt(c.color,16)!==c.original)).toBe(true);
 expect(data.red.colored.some(c=>parseInt(c.color,16)!==c.original)).toBe(true);
 expect(errors).toEqual([]);
});
