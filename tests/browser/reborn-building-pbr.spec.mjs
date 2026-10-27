import {test,expect} from '@playwright/test';

const kinds=['headquarters','factory','barracks','airfield','generator','turret','bastion'];
const evidence=new URL('../../docs/buildings-3d/',import.meta.url).pathname;

test('buildings PBR: all factions load embedded physical surfaces in the actual 3D gallery',async({page,baseURL})=>{
 test.setTimeout(120000);
 const errors=[],external=[],sharedSources=new Set();page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('data:')&&!r.url().startsWith('blob:')&&new URL(r.url()).origin!==new URL(baseURL).origin)external.push(r.url());});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/model-3d.html?model=headquarters');
 for(const kind of kinds){
  await page.locator('#model').selectOption(kind);
  for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
   await page.locator(team===0?'#blue':team===1?'#red':'#neutral').click();
   await page.waitForFunction(({kind,team})=>window.__model3D?.kind===kind&&window.__model3D?.team===team&&(()=>{let ready=false;window.__model3D.current?.traverse(n=>{if(n.userData.atlasDesign?.kind===kind&&n.userData.atlasDesign.team===team&&n.userData.atlasDesign.surfaceRevision===4)ready=true;});return ready;})(),{kind,team});
   const info=await page.evaluate(()=>{
    const v=window.__model3D;v.pause();v.play('Operation');v.mixer.setTime(7);v.render();
    const surfaces=[],textures=new Set();v.current.traverse(n=>{if(!n.isMesh)return;const m=n.material;if(m.userData.atlasSurface==='light')return;
     for(const t of [m.map,m.normalMap,m.roughnessMap,m.metalnessMap,m.aoMap])textures.add(t.source.uuid);
     surfaces.push({role:m.userData.atlasSurface,size:[m.map.image.width,m.map.image.height],normal:!!m.normalMap,packed:m.roughnessMap===m.metalnessMap&&m.aoMap===m.metalnessMap,uv:!!n.geometry.attributes.uv});
    });return {surfaces,textures:textures.size,sourceIds:[...textures],calls:v.renderer.info.render.calls};
   });
   expect(info.textures).toBe(3);expect(info.surfaces.length).toBeGreaterThan(14);
   for(const id of info.sourceIds)sharedSources.add(id);
   for(const surface of info.surfaces){expect(surface.size).toEqual([2048,2048]);expect(surface.normal&&surface.packed&&surface.uv).toBe(true);}
   await expect(page.locator('#error')).toHaveText('');await expect(page.locator('#download')).toHaveAttribute('href',`/src/assets/reborn/buildings-3d/${kind}-${team}.glb`);
   if(kind==='headquarters'&&team===0||kind==='airfield'&&team===0||kind==='turret'&&team===1||team===-1)await page.screenshot({path:evidence+`pbr-gallery-${kind}-${team}.png`,fullPage:true});
  }
 }
 expect(errors).toEqual([]);expect(external).toEqual([]);expect(sharedSources.size).toBe(3);
});

test('buildings PBR: runtime sprites, radar, sweep and rotating weapons draw for all 15 variants without changing a save',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1600,height:1100});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(kinds=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=true;const before=JSON.stringify(g.save()),checks=[];
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1050;canvas.id='pbr-proof';const c=canvas.getContext('2d');c.fillStyle='#aa8c61';c.fillRect(0,0,canvas.width,canvas.height);
  let i=0;
  for(const kind of kinds)for(const owner of kind==='bastion'?[0,1,-1]:[0,1]){
   const a=r.structures.asset(kind,owner),b=a.data.body,scale=190/b.solidBounds.w,p={x:150+i%5*300,y:285+Math.floor(i/5)*345};
   c.drawImage(a.body,p.x-b.pivot[0]*scale,p.y-b.pivot[1]*scale,512*scale,512*scale);
   if(kind==='turret')r.structures.drawTurret(c,owner,p,190,Math.PI/6);
   r.structures.drawActivity(c,kind,owner,p,190,12);
   c.fillStyle='#272b25';c.font='16px monospace';c.textAlign='center';c.fillText(kind+' / '+owner,p.x,p.y+30);
   checks.push({kind,owner,revision:a.data.design.surfaceRevision,body:a.body.complete&&a.body.naturalWidth===512,radar:a.data.activity?.frames.length??0,sweep:a.data.sweep?.frames.length??0,turret:a.data.turret?.frames.length??0});i++;
  }
  // A test-only review surface, built through the same runtime presentation API.
  canvas.style.cssText='position:fixed;inset:0;width:1500px;height:1050px;z-index:99999';document.body.append(canvas);
  return {checks,unchanged:JSON.stringify(g.save())===before};
 },kinds);
 expect(result.unchanged).toBe(true);expect(result.checks).toHaveLength(15);
 for(const a of result.checks){expect(a.revision).toBe(4);expect(a.body).toBe(true);if(['headquarters','bastion'].includes(a.kind))expect(a.radar).toBe(64);if(a.kind==='bastion')expect(a.sweep).toBe(64);if(a.kind==='turret')expect(a.turret).toBe(64);}
 await page.screenshot({path:evidence+'pbr-runtime-all-factions.png'});expect(errors).toEqual([]);
});
