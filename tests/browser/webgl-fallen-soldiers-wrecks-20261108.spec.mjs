import {test,expect} from '@playwright/test';

test('a dead soldier lies as its real 3D model; burned wrecks and crashes are temporary',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const result=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,field=v.battlefield,effects=v.effects;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0&&u.kind==='infantry');
  if(!unit)throw Error('No friendly infantry for death test');
  field.sync(false,0,false,1);
  const live=field.units.get(unit.id);
  if(!live)throw Error('No 3D actor for soldier');
  const visual=live.detail??live.placeholder;
  if(!visual)throw Error('Soldier has no visible model');
  // Mirror Simulation.step(): killed units are filtered from the game array.
  g.units=g.units.filter(u=>u.id!==unit.id);
  g.time+=.05;
  field.sync(false,0,false,1);
  const corpse=v.scene.getObjectByName('fallen-soldier-infantry-'+unit.id);
  const death={
   created:Boolean(corpse),kind:corpse?.userData.corpse,
   realModel:corpse?.children[0]?.children[0]===visual,
   liesOnSide:Math.abs((corpse?.children[0]?.rotation.x??0)-Math.PI/2)<.001,
   aliveStillInField:field.units.has(unit.id),
   remains:field.presentation.remnants.length,
   noBox:!corpse?.children.some(c=>c.isMesh&&c.geometry?.type==='PlaneGeometry')
  };
  field.presentation.stepRemnants(6.1,true);
  death.cleaned=!v.scene.getObjectByName('fallen-soldier-infantry-'+unit.id);
  death.remainsAfter=field.presentation.remnants.length;

  const before=effects.wrecks.length;
  effects.addWreck({kind:'tank',x:unit.x+210,y:unit.y+90,angle:0});
  const wreck={
   before,after:effects.wrecks.length,
   hullType:effects.wreckHull.geometry.type,
   turretType:effects.wreckTurret.geometry.type,
   barrels:effects.wreckBarrel.count,
   cap:effects.wreckHull.instanceMatrix.count
  };
  // A loaded aircraft transfers its actual textured mesh into the crash;
  // the old opaque capsule-and-wings proxy must never be spawned.
  const source=field.units.get(g.units.find(u=>u.kind==='scout'&&u.owner===0)?.id)?.detail;
  // A real loaded glTF is preferred; when lite mode skips that asset, the
  // group can still verify that crash ownership transfers model identity.
  const aircraft=effects.scene.clone(false);
  aircraft.name='authored-scout-for-death-test';
  const model=source?.clone(true)??effects.scene.clone(false);
  const spawned={kind:'scout',node:aircraft,detail:model};
  const tx=unit.x+235,tz=unit.y+110;
  aircraft.position.copy(effects.pos(tx,tz));aircraft.position.y+=175;
  aircraft.add(model);
  const captured=effects.captureAircraftCrash(spawned,{id:987654,kind:'scout',hp:0});
  wreck.realCrash=captured&&effects.crashes.at(-1)?.model===model;
  wreck.usesPlaceholderGeometry=Boolean(effects.crashFuselage||effects.crashWing);
  wreck.crashing=effects.crashes.length;
  effects.updateAircraftCrashes(1.5);
  wreck.crashesAfterImpact=effects.crashes.length;
  wreck.afterHelicopter=effects.wrecks.length;
  effects.update(22,true,0);
  wreck.afterLifetime=effects.wrecks.length;
  wreck.hullAfter=effects.wreckHull.count;
  return {death,wreck};
 });
 expect(result.death).toMatchObject({
  created:true,kind:true,realModel:true,liesOnSide:true,
  aliveStillInField:false,cleaned:true,remainsAfter:0,noBox:true
 });
 expect(result.wreck.after).toBe(result.wreck.before+1);
 expect(result.wreck.hullType).toBe('CylinderGeometry');
 expect(result.wreck.turretType).toBe('DodecahedronGeometry');
 expect(result.wreck.barrels).toBeGreaterThan(0);
 expect(result.wreck.cap).toBeLessThanOrEqual(24);
 expect(result.wreck.crashing).toBeGreaterThan(0);
 expect(result.wreck.realCrash).toBe(true);
 expect(result.wreck.usesPlaceholderGeometry).toBe(false);
 expect(result.wreck.crashesAfterImpact).toBe(0);
 expect(result.wreck.afterHelicopter).toBe(result.wreck.after+1);
 expect(result.wreck.afterLifetime).toBe(0);
 expect(result.wreck.hullAfter).toBe(0);
 expect(errors).toEqual([]);
});
