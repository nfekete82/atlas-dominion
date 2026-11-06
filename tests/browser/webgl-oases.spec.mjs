import {test,expect} from '@playwright/test';
for(const bastions of [4,8,12,16]){
 test(`${bastions} bastions: premium oases in built WebGL scene, exact ground contact and gameplay isolation`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`/?bastions=${bastions}&seed=2074&pause=1&lite=1&oasis=water`);
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
  const result=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,o=a.oases,g=a.game,before=JSON.stringify(g.save()),blocked=g.world.blocked.slice();
   const waters=o.water.map(m=>{const p=m.geometry.attributes.position;let maxError=0;
    for(let i=0;i<p.count;i++)maxError=Math.max(maxError,Math.abs(p.getY(i)-o.renderedHeight(p.getX(i)+o.half,p.getZ(i)+o.half)-.2));
    // Check triangle interiors as well as vertices: no intersections or lift.
    const idx=m.geometry.index;
    for(let i=0;i<idx.count;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){const n=idx.getX(i+j);x+=p.getX(n)/3;y+=p.getY(n)/3;z+=p.getZ(n)/3;}
     maxError=Math.max(maxError,Math.abs(y-o.renderedHeight(x+o.half,z+o.half)-.2));}
    return {maxError,passable:m.userData.shallowPassable,vertices:p.count};
   });
   const fronds=o.root.children.filter(n=>n.name.startsWith('oasis-palm-fronds'));
   const saved=g.save(),layout=JSON.stringify(o.layout);o.update(999);
   const untouched=before===JSON.stringify(g.save())&&blocked.every((v,i)=>v===g.world.blocked[i]);
   const center=o.layout[0];
   // Move a real soldier through the shallow pool using the game's movement.
   const unit=g.units.find(u=>u.owner===0),start={x:center.x-90,y:center.y};
   unit.x=start.x;unit.y=start.y;unit.previousX=start.x;unit.previousY=start.y;
   g.command([unit.id],{type:'move',x:center.x+90,y:center.y});
   for(let i=0;i<160;i++)g.step(.05);
   const moved=Math.hypot(unit.x-start.x,unit.y-start.y);
   return {count:o.layout.length,types:o.layout.map(p=>p.type),waters,fronds:fronds.map(n=>n.count),untouched,
    fog:a.battlefield.fogEnabled,layers:a.battlefield.fogNodes.length,moved,
    layout,saveVersion:saved.version,programs:a.renderer.info.programs.length};
  });
  expect(result.count).toBeGreaterThanOrEqual(2);expect(result.count).toBeLessThanOrEqual(4);
  if(bastions===4)expect(result.count).toBe(3);
  expect(result.fronds.every(n=>n>0)).toBe(true);expect(result.untouched).toBe(true);
  for(const water of result.waters){expect(water.passable).toBe(true);expect(water.maxError).toBeLessThan(.003);}
  expect(result.fog).toBe(true);expect(result.layers).toBe(16);expect(result.moved).toBeGreaterThan(100);
  expect(errors).toEqual([]);
  await page.screenshot({path:test.info().outputPath(`oases-${bastions}.png`)});
 });
}
test('occupied saves and construction reclaim oases; repeated disposal releases resources',async({page})=>{
 await page.goto('/?bastions=4&seed=2074&pause=1');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 const result=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,o=a.oases,c=o.layout[0],count=a.scene.children.length;
  // Visual occupancy only; remove the fixture immediately after inspection.
  const fixture={id:-777,x:c.x,y:c.y,hp:100,radius:100};a.game.bases.push(fixture);o.update(1000);
  const hidden=o.hidden.has(c.id)&&o.water.find(m=>m.userData.oasisId===c.id).visible===false;
  a.game.bases.pop();o.update(1001);const restored=!o.hidden.has(c.id);
  let disposed=0;for(const r of o.resources)r.addEventListener('dispose',()=>disposed++);
  const resources=o.resources.size;o.dispose();o.dispose();
  return {hidden,restored,resources,disposed,removed:a.scene.children.length===count-1,remaining:o.resources.size};
 });
 expect(result.hidden).toBe(true);expect(result.restored).toBe(true);
 expect(result.disposed).toBe(result.resources);expect(result.remaining).toBe(0);expect(result.removed).toBe(true);
});
