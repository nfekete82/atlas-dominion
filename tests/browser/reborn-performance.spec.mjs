import {test,expect} from '@playwright/test';

test('performance: profiler requires debug and perf; overlay reports and exports measurements',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const query of ['','?perf','?debug']){
  await page.goto('/'+query);await page.locator('#loading').waitFor({state:'detached'});
  expect(await page.evaluate(async()=> (await import('/src/reborn/performance.js')).profiler===null)).toBe(true);
  await expect(page.locator('#performance-panel')).toHaveCount(0);
 }
 await page.goto('/?debug&perf&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#performance-panel pre')).toContainText('1%-Low');
 await expect.poll(()=>page.evaluate(()=>window.__reborn.profiler.snapshot().frames)).toBeGreaterThan(10);
 const download=page.waitForEvent('download');await page.getByText('JSON exportieren',{exact:true}).click();expect((await download).suggestedFilename()).toBe('atlas-performance.json');
 expect(errors).toEqual([]);
});

test('performance: unchanged HUD text and queue DOM survive refresh, selection responds immediately',async({page})=>{
 await page.goto('/?debug&perfTest&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(()=>{
  const a=window.__reborn,g=a.game,u=g.spawn(0,{x:g.bases[0].x+180,y:g.bases[0].y},'scout');g.paused=true;a.renderer.selected=new Set([u.id]);a.refresh();
  document.querySelector('#tab-territories').click();a.refresh();
  const queue=document.querySelector('#queue-slots').firstElementChild,observer=new MutationObserver(()=>{});observer.observe(document.querySelector('#sidebar'),{subtree:true,childList:true,characterData:true});
  a.refresh();a.refresh();const mutations=observer.takeRecords().length;observer.disconnect();
  a.renderer.selected.clear();a.renderer.selectedBase=g.bases[0].id;a.refresh();
  return {mutations,sameQueue:queue===document.querySelector('#queue-slots').firstElementChild,title:document.querySelector('#selection-title').textContent};
 });
 expect(result).toEqual({mutations:0,sameQueue:true,title:'Hauptquartier'});
});

test('performance: optimized layered sprites match original Canvas pixels and preserve caller state',async({page})=>{
 await page.goto('/?debug&perfTest&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const results=await page.evaluate(async()=>{
  const a=window.__reborn,{unitVisualLift}=await import('/src/reborn/unit-presentation.js'),out=[];
  // Reference is the original save/restore implementation, including corpse filters.
  function reference(presentation,c,v,p){c.save();c.imageSmoothingEnabled=v.asset.data.cell[0]>=144;const at={x:p.x,y:p.y-unitVisualLift(v.unit)};
   const ground=v.asset.groundShadow;
   if(ground)c.drawImage(ground.image,p.x+ground.offsetX-ground.width/2,p.y+ground.offsetY-ground.height/2,ground.width,ground.height);
   else if(v.asset.shadow)presentation.drawFrame(c,v,v.frame,p,{x:0,y:0},v.asset.shadow);
   if(v.dead&&!v.asset.data.clips.death)c.filter='grayscale(1) brightness(.5)';
   presentation.drawFrame(c,v,v.frame,at);
   if(v.asset.data.clips.turret){presentation.drawFrame(c,v,v.anim.frame('turret',v.turretAngle),at);if(v.asset.data.clips.barrel){const recoil=v.unit.fire>0?Math.sin(v.unit.fire/.18*Math.PI)*2.5:0;presentation.drawFrame(c,v,v.anim.frame('barrel',v.turretAngle),at,{x:-Math.cos(v.turretAngle)*recoil,y:-Math.sin(v.turretAngle)*recoil*.65});}}
   c.restore();
  }
  for(const kind of ['infantry','heavy','medic','engineer','rover','tank','artillery','scout','bomber'])for(const scale of [.6,1,1.7]){
   const u=a.game.spawn(0,{x:1000,y:1000},kind);u.angle=.8;u.fire=.09;a.renderer.units.update([u],0,()=>true);const view=a.renderer.units.inspect(u.id);
   for(const dead of [false,true]){view.dead=dead;const canvases=[document.createElement('canvas'),document.createElement('canvas')];for(const canvas of canvases){canvas.width=canvas.height=320;const c=canvas.getContext('2d');c.translate(160,250);c.scale(scale,scale);c.globalAlpha=.7;}
    const [expected,actual]=canvases.map(c=>c.getContext('2d'));reference(a.renderer.units,expected,view,{x:0,y:0});a.renderer.units.drawView(actual,view,{x:0,y:0});
    const x=expected.getImageData(0,0,320,320).data,y=actual.getImageData(0,0,320,320).data;let different=0;for(let i=0;i<x.length;i++)if(x[i]!==y[i])different++;
    out.push({kind,scale,dead,different,state:actual.imageSmoothingEnabled===true&&actual.filter==='none'&&actual.globalAlpha===expected.globalAlpha});
   }
  }return out;
 });
 expect(results.every(r=>r.different===0&&r.state),JSON.stringify(results.filter(r=>r.different||!r.state))).toBe(true);
});
