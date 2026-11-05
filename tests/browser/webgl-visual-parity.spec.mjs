import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('3D HP bar is bright green at 100%, decreases smoothly and turns yellow/red after damage',async({page})=>{
 test.setTimeout(115000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const result=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0);
  const e=b.units.get(unit.id);if(!e)throw Error('Missing owned actor');
  const full=unit.hp;
  const defaultMode=b.presentation.showHealth;
  b.presentation.setHealthMode('all'); // explicit visibility mode for HP snapshots
  b.sync(true,.02,false,1);
  const sample=()=>({
   fraction:e.presentation.bar.fraction,
   width:e.presentation.bar.fill.scale.x,
   color:'#'+e.presentation.bar.fillMaterial.color.getHexString(),
   visible:e.presentation.bar.root.visible,
   height:e.presentation.bar.root.children[2].scale.y
  });
  const fullBar=sample();
  unit.hp=full*.5;b.sync(true,.02,false,1);const halfBar=sample();
  unit.hp=full*.12;b.sync(true,.02,false,1);const lowBar=sample();
  return {fullBar,halfBar,lowBar,mode:b.presentation.showHealth,defaultMode,
   buildingShadows:b.grounding.items.size,structures:b.bases.size};
 });
 expect(result.fullBar.fraction).toBe(1);
 expect(result.fullBar.visible).toBe(true);
 expect(result.fullBar.color).toBe('#24e568');
 expect(result.fullBar.height).toBeLessThan(3);
 expect(result.halfBar.fraction).toBeCloseTo(.5,4);
 expect(result.halfBar.color).toBe('#f6d44b');
 expect(result.halfBar.width).toBeCloseTo(result.fullBar.width*.5,3);
 expect(result.lowBar.fraction).toBeCloseTo(.12,4);
 expect(result.lowBar.color).toBe('#ed5146');
 expect(result.lowBar.width).toBeLessThan(result.halfBar.width);
 expect(result.buildingShadows).toBe(result.structures);
 expect(result.defaultMode).toBe('all');
 expect(result.mode).toBe('all');
 expect(errors).toEqual([]);
});

test('4 contiguous rocky outer walls mark map boundary and do not change collision',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,cliffs=a.boundaryCliffs;
  if(!cliffs)throw Error('Missing boundary cliffs');
  const walls=cliffs.cliffs;
  const sample=(mesh,band,last)=>{
   const arr=mesh.geometry.getAttribute('position');
   const tiles=arr.count/6-1;
   const idx=band*(tiles+1)+(last?tiles:0);
   return [arr.getX(idx),arr.getY(idx),arr.getZ(idx)];
  };
  const cornerGaps=[];
  for(let wall=0;wall<4;wall++){
   for(let band=0;band<6;band++){
    const last=sample(walls[wall],band,true);
    const first=sample(walls[(wall+1)%4],band,false);
    cornerGaps.push(Math.hypot(...last.map((v,i)=>v-first[i])));
   }
  }
  const size=g.world.size;
  return {walls:walls.length,scree:cliffs.scree.length,
   nonPlayable:walls.every(w=>w.userData.visualBoundary&&w.userData.nonPlayable),
   maxCornerGap:Math.max(...cornerGaps),
   blocked:[g.world.walkable({x:-10,y:size/2}),g.world.walkable({x:size+10,y:size/2})],
   render:a.renderer.capabilities.isWebGL2};
 });
 expect(state.render).toBe(true);
 expect(state.walls).toBe(4);
 expect(state.scree).toBe(1);
 expect(state.nonPlayable).toBe(true);
 expect(state.maxCornerGap).toBeLessThan(.02);
 expect(state.blocked).toEqual([false,false]);
 const out=fileURLToPath(new URL('./artifacts/',import.meta.url));
 await mkdir(out,{recursive:true});
 await page.screenshot({path:out+'webgl-canyon-boundary-hp.png',fullPage:true});
});

test('dark natural map rim has no off-map foliage or reappearing bright exterior',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 // Wait for asynchronous decorations: exterior should remain empty even
 // after all in-world palm trees finish loading.
 await page.waitForFunction(()=>window.__sandforgeWebGL?.desertArtReady===true,
  null,{timeout:30000});
 const state=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,size=v.game.world.size,half=size*.5;
  const edgeColor=[],voidColor=[];
  for(const tile of v.visualPerimeter.meshes){
   const p=tile.geometry.getAttribute('position');
   const c=tile.geometry.getAttribute('color');
   for(let i=0;i<p.count;i++){
    const x=p.getX(i)+half,z=p.getZ(i)+half;
    const beyond=Math.max(0,-x,x-size,-z,z-size);
    const brightness=(c.getX(i)+c.getY(i)+c.getZ(i))/3;
    if(beyond<.01)edgeColor.push(brightness);
    if(beyond>1000)voidColor.push(brightness);
   }
  }
  const palms=v.scene.children.filter(node=>node.name==='visual-boundary-palm');
  return {
   edge:edgeColor.reduce((a,b)=>a+b,0)/edgeColor.length,
   beyond:voidColor.reduce((a,b)=>a+b,0)/voidColor.length,
   samples:[edgeColor.length,voidColor.length],
   background:'#'+v.scene.background.getHexString(),
   palmCount:palms.length,
   allOutside:palms.every(node=>{
    const x=node.position.x+half,z=node.position.z+half;
    return x<0||x>size||z<0||z>size;
   }),
   cosmetic:palms.every(node=>node.userData.visualBoundary&&node.userData.nonPlayable),
   voidCover:v.visualPerimeter.voidCover.length,
   coveredGeometry:v.visualPerimeter.voidCover.every((overlay,i)=>
    overlay.geometry===v.visualPerimeter.meshes[i].geometry),
   // Validate the *behavior* of the shader, rather than pinning it to
   // an old hard-coded fade length. A Zero-Hour-style exterior must reach
   // fully opaque black no farther than 24 world units from the boundary.
   fadeStops:(()=>{
    const shader=v.visualPerimeter.voidCover[0].material.fragmentShader;
    const match=shader.match(/float\s+darkness\s*=\s*smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*outside\s*\)/);
    return match?[Number(match[1]),Number(match[2])]:null;
   })(),
   permanentlyBlack:v.visualPerimeter.voidCover.every(overlay=>
    overlay.visible&&overlay.renderOrder===980&&
    overlay.material.depthTest===true&&overlay.material.depthWrite===false&&
    overlay.material.fragmentShader.includes('vec4(0.0,0.0,0.0,darkness)'))
  };
 });
 expect(state.samples[0]).toBeGreaterThan(0);
 expect(state.samples[1]).toBeGreaterThan(0);
 expect(state.beyond).toBeLessThan(state.edge*.15);
 expect(state.background).toBe('#000000');
 expect(state.palmCount).toBe(0);
 expect(state.allOutside).toBe(true);
 expect(state.cosmetic).toBe(true);
 expect(state.voidCover).toBe(48);
 expect(state.coveredGeometry).toBe(true);
 expect(state.permanentlyBlack).toBe(true);
 expect(state.fadeStops).not.toBeNull();
 expect(state.fadeStops[0]).toBeLessThanOrEqual(0);
 expect(state.fadeStops[1]).toBeGreaterThan(state.fadeStops[0]);
 expect(state.fadeStops[1]).toBeLessThanOrEqual(24);
 expect(state.fadeStops[1]-state.fadeStops[0]).toBeLessThanOrEqual(26);
 // Render-only border never receives fog-of-war overlays: dense unknown
 // terrain is still hidden inside the 16 authoritative map chunks only.
 const fogState=await page.evaluate(()=>{
   const v=window.__sandforgeWebGL;
   return {count:v.battlefield.fogNodes.length,
     decorative:v.battlefield.fogNodes.filter(
       m=>v.visualPerimeter.meshes.some(p=>p.geometry===m.geometry)).length,
     unknown:v.battlefield.fogTexture.image.data.some((n,i)=>i%4===3&&n===255)};
 });
 expect(fogState.count).toBe(16);
 expect(fogState.decorative).toBe(0);
 expect(fogState.unknown).toBe(true);
});


test('3D buildings receive texture-based fill without brightening sand or soldier materials',async({page})=>{
 test.setTimeout(125000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const fixture=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
  const sandMeshes=[];
  v.scene.traverse(obj=>{if(obj.isMesh&&obj.userData?.terrain)sandMeshes.push(obj);});
  const fallback=b.createFallback('headquarters',0,'building');
  const soldier=b.createFallback('infantry',0,'unit');
  const materials=root=>{
   const list=[];root.traverse(o=>{
    if(o.isMesh){const m=Array.isArray(o.material)?o.material:[o.material];
     list.push(...m.filter(Boolean));}
   });return list;
  };
  const fallbackMaterials=materials(fallback),unitMaterials=materials(soldier);
  const readySite=g.headquartersCandidates(0)
   .find(p=>g.buildError(0,'headquarters',p)===null);
  if(!readySite)throw Error('No HQ fixture construction site');
  const base=g.build(0,'headquarters',readySite);
  if(!base)throw Error('Could not build HQ fixture');
  base.buildRemaining=0;base.hp=1200;
  b.sync(true,.06,false,1);
  return {id:base.id,exposure:v.renderer.toneMappingExposure,
   fallbackLit:fallbackMaterials.every(m=>m.emissiveIntensity===.22),
   soldierUnchanged:unitMaterials.every(m=>m.emissiveIntensity===1&&m.emissive.getHex()===0),
   terrainUnchanged:sandMeshes.length>0&&sandMeshes.every(mesh=>
    !mesh.material?.userData?.sandforgeBuildingFill&&
    !mesh.material?.emissiveMap)};
 });
 expect(fixture.fallbackLit).toBe(true);
 expect(fixture.soldierUnchanged).toBe(true);
 expect(fixture.terrainUnchanged).toBe(true);
 expect(fixture.exposure).toBeCloseTo(.96,3);
 await page.waitForFunction(id=>{
  const b=window.__sandforgeWebGL.battlefield;
  return Boolean(b.bases.get(id)?.detail);
 },fixture.id,{timeout:65000});
 const state=await page.evaluate(async id=>{
  const b=window.__sandforgeWebGL.battlefield;
  const model=b.bases.get(id).detail;
  const materials=[];
  model.traverse(obj=>{
   if(obj.isMesh){
    const values=Array.isArray(obj.material)?obj.material:[obj.material];
    materials.push(...values.filter(m=>m?.isMeshStandardMaterial));
   }
  });
  const original=(await b.getModel(b.asset('headquarters',0,'building'))).scene;
  const originals=[];
  original.traverse(obj=>{
   if(obj.isMesh){
    const values=Array.isArray(obj.material)?obj.material:[obj.material];
    originals.push(...values.filter(m=>m?.isMeshStandardMaterial));
   }
  });
  return {modelMaterials:materials.length,
   colored:materials.every(m=>m.userData.sandforgeBuildingFill===true&&m.emissiveIntensity===.22),
   textured:materials.filter(m=>m.map).length,
   mapUsedAsFill:materials.filter(m=>m.map).every(m=>m.emissiveMap===m.map),
   originalUnchanged:originals.every(m=>!m.userData?.sandforgeBuildingFill)};
 },fixture.id);
 expect(state.modelMaterials).toBeGreaterThan(0);
 expect(state.colored).toBe(true);
 expect(state.textured).toBeGreaterThan(0);
 expect(state.mapUsedAsFill).toBe(true);
 expect(state.originalUnchanged).toBe(true);
});

test('loaded GLB turret head, real muzzle nodes, flashes and shot traces share one heading',async({page})=>{
 test.setTimeout(135000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const id=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('Missing turret fixture site');
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('Could not build fixture');
  base.kind='turret';base.hp=650;base.buildRemaining=0;
  base.turretAngle=0;base.previousTurretAngle=0;
  battlefield.sync(true,0,false,1);
  return base.id;
 });
 // The old test passed against only analytic placeholder offsets. Require
 // the shipped 16MB model AND its actual animated head and muzzle nodes.
 await page.waitForFunction(id=>{
  const entry=window.__sandforgeWebGL.battlefield.bases.get(id);
  return Boolean(entry?.detail&&entry.motion?.mode==='authored-rig'&&
   entry.motion.muzzles?.length===2&&entry.motion.muzzles.every(Boolean));
 },id,{timeout:80000});
 const state=await page.evaluate(id=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const turret=game.bases.find(b=>b.id===id),entry=battlefield.bases.get(id);
  const flashes=entry.presentation.turretFlashes;
  const Vector3=entry.node.position.constructor;
  const samples=[];
  for(const facing of [0,2,1,3])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   turret.facing=facing;turret.turretAngle=angle;
   battlefield.sync(false,0,false,1);
   entry.node.updateWorldMatrix(true,true);
   const head=entry.motion.rotor.getWorldPosition(new Vector3());
   const left=entry.motion.muzzles[0].getWorldPosition(new Vector3());
   const right=entry.motion.muzzles[1].getWorldPosition(new Vector3());
   const dx=(left.x+right.x)*.5-head.x;
   const dz=(left.z+right.z)*.5-head.z;
   const dir=dx*Math.cos(angle)+dz*Math.sin(angle);
   samples.push({
    mode:entry.motion.mode,angle,facing,
    aligned:dir/Math.max(.001,Math.hypot(dx,dz)),
    barrelSpread:Math.hypot(left.x-right.x,left.z-right.z),
    leftFlashError:flashes[0].position.distanceTo(left),
    rightFlashError:flashes[1].position.distanceTo(right)
   });
  }
  turret.facing=0;turret.turretAngle=0;
  battlefield.sync(false,0,false,1);
  const shot={from:{x:turret.x,y:turret.y},to:{x:turret.x+170,y:turret.y},
   source:turret.id,owner:0,weapon:'turret',barrel:0,life:.65,hit:true,at:game.time};
  game.shots.push(shot);battlefield.sync(false,0,false,1);
  const firstVisible=flashes.map(e=>e.visible);
  const leftOrigin=flashes[0].position.toArray(),tr0=battlefield.tracer.geometry.getAttribute('position');
  const leftTrace=[tr0.getX(0),tr0.getY(0),tr0.getZ(0)];
  game.shots.push({...shot,barrel:1});battlefield.sync(false,0,false,1);
  const bothVisible=flashes.map(e=>e.visible);
  const rightOrigin=flashes[1].position.toArray(),tr1=battlefield.tracer.geometry.getAttribute('position');
  const rightTrace=[tr1.getX(2),tr1.getY(2),tr1.getZ(2)];
  return {samples,firstVisible,bothVisible,leftOrigin,leftTrace,rightOrigin,rightTrace,
   names:entry.motion.muzzles.map(n=>n.name)};
 },id);
 expect(state.samples).toHaveLength(16);
 for(const sample of state.samples){
  expect(sample.mode).toBe('authored-rig');
  expect(sample.aligned).toBeCloseTo(1,4);
  expect(sample.barrelSpread).toBeGreaterThan(2);
  expect(sample.leftFlashError).toBeLessThan(.01);
  expect(sample.rightFlashError).toBeLessThan(.01);
 }
 expect(state.names).toEqual(['TurretMuzzleL','TurretMuzzleR']);
 expect(state.firstVisible).toEqual([true,false]);
 expect(state.bothVisible).toEqual([true,true]);
 for(let i=0;i<3;i++){
  expect(state.leftTrace[i]).toBeCloseTo(state.leftOrigin[i],3);
  expect(state.rightTrace[i]).toBeCloseTo(state.rightOrigin[i],3);
 }
});


test('live HP stays visible above FOW for full-health friendlies without leaking hidden enemy health',async({page})=>{
 test.setTimeout(115000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const result=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  battlefield.sync(true,0,false,1);
  const friendly=game.units.find(u=>u.owner===0&&u.hp>0);
  const entry=battlefield.units.get(friendly.id);
  const initial={mode:battlefield.presentation.showHealth,
   visible:entry.presentation.bar.root.visible,
   depthTest:entry.presentation.bar.fill.material.depthTest,
   barOrder:entry.presentation.bar.fill.renderOrder,
   fogOrder:battlefield.fogNodes[0].renderOrder};
  const hostile=game.units.find(u=>u.owner===1&&u.hp>0);
  const hostileEntry=battlefield.units.get(hostile?.id);
  const unseen=hostileEntry&&!game.canSee(0,hostile)
   ?hostileEntry.presentation.bar.root.visible:false;
  battlefield.presentation.setHealthMode('off');
  battlefield.sync(true,0,false,1);
  return {initial,unseen,off:entry.presentation.bar.root.visible};
 });
 expect(result.initial.mode).toBe('all');
 expect(result.initial.visible).toBe(true);
 expect(result.initial.depthTest).toBe(false);
 expect(result.initial.barOrder).toBeGreaterThan(result.initial.fogOrder);
 expect(result.unseen).toBe(false);
 expect(result.off).toBe(false);
});

test('guided six-tube rocket flies in 3D, skips MG tracer and produces pooled staged impact effects',async({page})=>{
 test.setTimeout(125000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const data=await page.evaluate(()=>{
  const {game,battlefield,effects}=window.__sandforgeWebGL;
  const ally=game.units.find(u=>u.owner===0&&u.hp>0);
  const gun=game.spawn(0,{x:ally.x+24,y:ally.y+24},'artillery');
  gun.angle=0;gun.hullAngle=0;
  battlefield.sync(true,0,false,1);
  const actor=battlefield.units.get(gun.id);
  const tubes=actor.rocketMuzzles?.map(m=>m?.name);
  const rocket={id:900999,source:gun.id,owner:0,
   from:{x:gun.x,y:gun.y},to:{x:gun.x+140,y:gun.y+30},
   angle:0,at:game.time,impactAt:game.time+1,damage:120};
  game.missiles=[rocket];game.shots=[{
   from:{x:gun.x,y:gun.y},to:rocket.to,source:gun.id,owner:0,
   hit:false,weapon:'rocket',barrel:rocket.id%6,life:.65,at:game.time
  }];
  battlefield.sync(true,0,false,1);
  effects.update(.05,true,.025);
  const first=[...effects.rockets.instanceMatrix.array.slice(12,15)];
  const initial={
   rocket:effects.rockets.count,nose:effects.rocketNoses.count,
   exhaust:effects.rocketExhaust.count,
   trace: battleFieldDrawRange(),flash:actor.presentation.flash?.visible??false,
   tubes,point:first,
   smoke:effects.smoke.particles.length
  };
  function battleFieldDrawRange(){return battlefield.tracer.geometry.drawRange.count;}
  // Fast-forward only the cosmetic trajectory. Gameplay and impact damage
  // remain authoritative in the simulation, not handled by effects.update().
  game.time+=.25;
  effects.update(.05,true,0);
  const next=[...effects.rockets.instanceMatrix.array.slice(12,15)];
  game.missiles=[];
  game.blasts.push({x:rocket.to.x,y:rocket.to.y,id:rocket.id,at:game.time});
  effects.update(.05,true,0);
  return {initial,next,
   gone:effects.rockets.count,
   blast:effects.stats.blasts,
   dust:effects.dust.mesh.count,
   debris:effects.debris.mesh.count,
   smoke:effects.smoke.mesh.count};
 });
 expect(data.initial.tubes).toEqual([
  'RocketMuzzle_0','RocketMuzzle_1','RocketMuzzle_2',
  'RocketMuzzle_3','RocketMuzzle_4','RocketMuzzle_5'
 ]);
 expect(data.initial.rocket).toBe(1);
 expect(data.initial.nose).toBe(1);
 expect(data.initial.exhaust).toBe(1);
 expect(data.initial.trace).toBe(0);
 expect(data.initial.flash).toBe(false);
 expect(data.initial.smoke).toBeGreaterThan(0);
 expect(data.next).not.toEqual(data.initial.point);
 expect(data.gone).toBe(0);
 expect(data.blast).toBeGreaterThan(0);
 expect(data.dust).toBeGreaterThan(0);
 expect(data.debris).toBeGreaterThan(0);
 expect(data.smoke).toBeGreaterThan(0);
});

test('rocket-free tracer buffers remain stable after 300 visual frames',async({page})=>{
 test.setTimeout(115000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const data=await page.evaluate(()=>{
  const {battlefield,game}=window.__sandforgeWebGL;
  const pos=battlefield.tracer.geometry.getAttribute('position');
  const color=battlefield.tracer.geometry.getAttribute('color');
  const ally=game.units.find(u=>u.owner===0&&u.hp>0);
  game.shots=[{from:{x:ally.x,y:ally.y},
   to:{x:ally.x+15,y:ally.y},owner:0,source:ally.id,
   weapon:'rifle',hit:true,life:.5,at:game.time}];
  for(let frame=0;frame<300;frame++)battlefield.updateShots();
  return {samePos:pos===battlefield.tracer.geometry.getAttribute('position'),
   sameColor:color===battlefield.tracer.geometry.getAttribute('color'),
   length:pos.array.length,draw:battlefield.tracer.geometry.drawRange.count};
 });
 expect(data).toEqual({samePos:true,sameColor:true,length:660,draw:2});
});
