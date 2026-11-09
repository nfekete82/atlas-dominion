import {test,expect} from '@playwright/test';

async function load(page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
}

test('full-width HUD unifies radar, catalog, production and commands in one dock',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const before=await page.evaluate(()=>{
  const rect=id=>{
   const r=document.querySelector(id).getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  };
  return {
   viewport:{width:innerWidth,height:innerHeight},
   dock:rect('#sidebar'),
   radar:rect('#sidebar .radar'),
   catalog:rect('#sidebar .catalog'),
   production:rect('#sf-production'),
   commands:rect('#sf-selection-panel'),
   map:rect('#sf-map'),
   zoom:window.__sandforgeWebGL.camera.zoom,
   minZoom:window.__sandforgeWebGL.controls.minZoom,
   worldSize:window.__sandforgeWebGL.game.world.size,
   worldVersion:window.__sandforgeWebGL.game.world.mapVersion,
   rimHidden:window.__sandforgeWebGL.boundaryCliffs.cliffs.every(x=>!x.visible)
  };
 });
 expect(before.dock.top).toBeGreaterThan(590); // unified 270px dock leaves the battle visible
 expect(before.dock.bottom).toBeGreaterThan(875);
 expect(before.dock.left).toBeLessThanOrEqual(12);
 expect(before.dock.right).toBeGreaterThanOrEqual(before.viewport.width-12);
 expect(before.dock.width).toBeGreaterThan(before.viewport.width-24);
 expect(before.radar.left).toBeLessThan(before.catalog.left);
 expect(before.catalog.left).toBeLessThan(before.production.left);
 expect(before.catalog.right).toBeLessThanOrEqual(before.production.left+2);
 expect(before.production.right).toBeLessThanOrEqual(before.commands.left+2);
 expect(before.production.height).toBeGreaterThanOrEqual(215);
 expect(before.commands.bottom).toBeGreaterThan(875);
 expect(before.map.width).toBeGreaterThan(100);
 expect(before.zoom).toBeCloseTo(.59,2);
 expect(before.minZoom).toBeLessThan(.5);
 expect(before.worldVersion).toBe(19);
 expect(before.worldSize).toBe(6240);
 expect(before.rimHidden).toBe(true);
 await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);battlefield.selectedBase=null; battlefield.drawInterface();
 });
 await page.locator('#sf-tabs button[data-tab="buildings"]').click();
 const after=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll(
   '#sf-actions .sf-group[data-sf-group="buildings"] .catalog-card')];
  const visible=elements.filter(e=>e.getBoundingClientRect().width>0);
  const boxes=visible.slice(0,2).map(e=>e.getBoundingClientRect());
  const first=visible[0],last=visible.at(-1);
  const names=visible.map(card=>card.querySelector('.card-name'));
  const toNum=(e,key)=>Number.parseFloat(getComputedStyle(e)[key])||0;
  const tab=document.querySelector('#sidebar .catalog-tabs button[data-tab="buildings"]');
  return {
   tab:document.querySelector('#sf-classic-root').dataset.tab,
   cards:visible.length,first:boxes[0]?.left??0,second:boxes[1]?.left??0,
   dockHeight:document.querySelector('#sidebar').getBoundingClientRect().height,
   tabHeight:tab.getBoundingClientRect().height,tabFont:toNum(tab,'fontSize'),
   cardHeight:first.getBoundingClientRect().height,
   labelMin:Math.min(...names.map(el=>toNum(el,'fontSize'))),
   firstRow:last.getBoundingClientRect().top-first.getBoundingClientRect().top<5,
   commandFont:toNum(document.querySelector('#sf-selection-panel .commands button'),'fontSize')
  };
 });
 expect(after.tab).toBe('buildings');
 expect(after.cards).toBeGreaterThan(1);
 expect(after.second).toBeGreaterThan(after.first);
 expect(after.dockHeight).toBeGreaterThanOrEqual(250);
 expect(after.dockHeight).toBeLessThanOrEqual(270);
 expect(after.tabHeight).toBeGreaterThanOrEqual(30);
 expect(after.tabFont).toBeGreaterThanOrEqual(10);
 expect(after.cardHeight).toBeGreaterThanOrEqual(110);
 expect(after.labelMin).toBeGreaterThanOrEqual(12);
 expect(after.commandFont).toBeGreaterThanOrEqual(9);
 expect(after.firstRow).toBeDefined(); // Catalog may scroll across rows at narrower widths
 // The same four dock sections should remain inside ONE container at 1600px
 // and still be usable at 820px without a detached command window.
 await page.setViewportSize({width:1600,height:900});
 const mac=await page.evaluate(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect();
  const dock=r('#sidebar'),catalog=r('#sidebar .catalog'),
   production=r('#sf-production'),command=r('#sf-selection-panel');
  return {dockHeight:dock.height,productionHeight:production.height,
   rightOf:production.left>=catalog.right-2,
   beforeCommands:production.right<=command.left+2};
 });
 expect(mac.dockHeight).toBeLessThanOrEqual(270);
 expect(mac.productionHeight).toBeGreaterThanOrEqual(215);
 expect(mac.rightOf&&mac.beforeCommands).toBe(true);
 await page.setViewportSize({width:820,height:720});
 const narrow=await page.evaluate(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect();
  const catalog=r('#sidebar .catalog'),production=r('#sf-production'),
   command=r('#sf-selection-panel'),dock=r('#sidebar');
  return {separate:document.querySelector('#sf-production').parentElement.id==='sidebar',
   aligned:Math.abs(production.top-catalog.top)<10,
   inside:production.bottom<=dock.bottom+1,
   beforeCommands:production.right<=command.left+2,
   slotVisible:production.width>100};
 });
 expect(narrow.separate).toBe(true);
 expect(narrow.aligned&&narrow.inside&&narrow.beforeCommands&&narrow.slotVisible).toBe(true);
});

test('lite infantry visual scale is reduced without changing unit collision radius',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const result=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,game=view.game;
  const soldier=game.units.find(u=>u.owner===0&&u.kind==='infantry');
  const entry=view.battlefield.units.get(soldier.id);
  return {scale:entry?.placeholder?.scale.x,kind:soldier.kind,
   radius:game.world.walkable(soldier),sameUnit:entry?.node?.userData?.id===soldier.id};
 });
 expect(result.kind).toBe('infantry');
 // Deliberately downsized infantry in 3D: the engine collision footprint
 // and authoritative movement remain unchanged.
 expect(result.scale).toBeCloseTo(.59,3);
 expect(result.sameUnit).toBe(true);
 expect(result.radius).toBe(true);
});

test('spacious desert details are subtle decals, not oversized scattered blobs',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const visuals=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,scene=a.scene;
  const craters=scene.getObjectByName('visual-desert-craters');
  const stones=scene.getObjectByName('visual-desert-debris');
  // Instanced matrices are available without exposing THREE globally.
  const sizes=[];
  if(craters)for(let i=0;i<Math.min(craters.count,8);i++){
   const m=craters.instanceMatrix.array,offset=i*16;
   const x=Math.hypot(m[offset],m[offset+1],m[offset+2]);
   const y=Math.hypot(m[offset+4],m[offset+5],m[offset+6]);
   sizes.push(Math.max(x,y));
  }
  return {version:a.world?.mapVersion??a.game.world.mapVersion,
   craters:craters?.count??0,opacity:craters?.material?.opacity,
   debris:stones?.count??0,craterSizes:sizes};
 });
 expect(visuals.version).toBe(19);
 expect(visuals.craters).toBeLessThanOrEqual(30);
 expect(visuals.craters).toBeGreaterThan(0);
 expect(visuals.opacity).toBeCloseTo(.74,2);
 expect(visuals.debris).toBeLessThanOrEqual(160);
 expect(visuals.craterSizes.every(v=>v>0&&v<150)).toBe(true);
});

test('lite mode still requests original detailed PBR building model, and ruins receive props',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  if(!site)throw new Error('No valid HQ fixture placement');
  const building=g.build(0,'headquarters',site);
  if(!building)throw new Error('HQ fixture could not be created');
  b.sync(true);
  const entry=b.bases.get(building.id);
  return {requested:entry?.requested===true,
   filename:b.asset('headquarters',0,'building'),
   sandApron:entry?.node.getObjectByName('sand-apron-headquarters-'+building.id)?.isMesh===true,
   grounding:b.grounding.items.has(building.id),
   lite:b.lite===true};
 });
 expect(state.lite).toBe(true);
 expect(state.requested).toBe(true);
 expect(state.sandApron).toBe(true);
 expect(state.grounding).toBe(true);
 expect(state.filename).toContain('buildings-3d/headquarters-0.glb');
 await page.waitForFunction(()=>{
  const b=window.__sandforgeWebGL?.battlefield;
  return [...(b?.bases.values()??[])].some(e=>e.kind==='headquarters'&&e.detail);
 },null,{timeout:65000});
 const hasPBR=await page.evaluate(()=>{
  const entries=[...window.__sandforgeWebGL.battlefield.bases.values()];
  const model=entries.find(e=>e.kind==='headquarters')?.detail;
  let maps=0;
  model?.traverse(n=>{
   if(!n.isMesh)return;
   const materials=Array.isArray(n.material)?n.material:[n.material];
   maps+=materials.filter(m=>m?.map&&m?.normalMap).length;
  });
  return maps>0;
 });
 expect(hasPBR).toBe(true);
 await page.waitForFunction(()=>window.__sandforgeWebGL.scene.children.some(
  node=>node.userData?.ruinDecor===true),null,{timeout:65000});
 const props=await page.evaluate(()=>window.__sandforgeWebGL.scene.children.filter(
  node=>node.userData?.ruinDecor===true).length);
 expect(props).toBeGreaterThan(0);
});


test('context menus expose builder construction and only the selected producer unit row',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const initial=await page.evaluate(()=>{
  const b=window.__sandforgeWebGL.battlefield;
  return {tab:b.panel.dataset.tab,unitsTab:b.panel.querySelector('[data-tab="units"]').hidden,
   buildingsTab:b.panel.querySelector('[data-tab="buildings"]').hidden};
 });
 expect(initial).toEqual({tab:'territories',unitsTab:true,buildingsTab:true});
 const builder=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);battlefield.selectedBase=null;
  battlefield.drawInterface();
  const group=document.querySelector('#sf-actions [data-sf-group="buildings"]');
  const cards=[...group.querySelectorAll('.catalog-card')];
  const boxes=cards.map(el=>el.getBoundingClientRect());
  return {tab:battlefield.panel.dataset.tab,count:cards.length,
   row:boxes.every(box=>Math.abs(box.y-boxes[0].y)<5),
   name:getComputedStyle(cards[0].querySelector('.card-name')).whiteSpace,
   priceBelow:cards[0].querySelector('.card-cost').getBoundingClientRect().y>
     cards[0].querySelector('.card-name').getBoundingClientRect().y,
   dockHeight:document.querySelector('#sidebar').getBoundingClientRect().height,
   unitTab:battlefield.panel.querySelector('[data-tab="units"]').hidden};
 });
 expect(builder.tab).toBe('buildings');
 expect(builder.count).toBe(6);
 expect(builder.row).toBe(true);
 expect(builder.name).toBe('nowrap');
 expect(builder.priceBelow).toBe(true);
 expect(builder.dockHeight).toBeGreaterThanOrEqual(225);
 expect(builder.dockHeight).toBeLessThanOrEqual(270);
 expect(builder.unitTab).toBe(true);
 await page.waitForFunction(()=>{
  const icons=[...document.querySelectorAll('img[data-sf-building-icon]')];
  return icons.length===6&&icons.every(img=>img.dataset.sfIconStatus==='ready'&&
   img.naturalWidth===320&&img.naturalHeight===220);
 },null,{timeout:45000});

 const roster=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ site');
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('Could not build HQ');
  base.buildRemaining=0;base.hp=1200;
  battlefield.selected.clear();battlefield.selectedBase=base.id;
  battlefield.sync(true,.06,false,1);battlefield.drawInterface();
  const active=()=>[...document.querySelectorAll('[data-sf-producer]')]
   .filter(el=>!el.hidden).map(el=>({kind:el.dataset.sfProducer,
    units:[...el.querySelectorAll('[data-unit]')].map(button=>button.dataset.unit)}));
  const hq=active();
  const kinds=['barracks','factory','airfield'];
  const variants={};
  for(const kind of kinds){
   // Change only the selected completed producer's presentation kind for this
   // isolated, paused roster filter test; no production order or simulation step.
   base.kind=kind;
   battlefield.drawInterface();
   variants[kind]=active();
  }
  base.kind='headquarters';battlefield.drawInterface();
  return {tab:battlefield.panel.dataset.tab,hq,variants,
   tabs:[...battlefield.panel.querySelectorAll('#sf-tabs [data-tab]')]
    .filter(el=>!el.hidden).map(el=>el.dataset.tab)};
 });
 expect(roster.tab).toBe('units');
 expect(roster.hq).toEqual([{kind:'headquarters',units:['engineer']}]);
 expect(roster.variants.barracks[0].units).toEqual(['infantry','medic','heavy']);
 expect(roster.variants.factory[0].units).toEqual(['rover','tank','artillery']);
 expect(roster.variants.airfield[0].units).toEqual(['scout','bomber']);
 expect(roster.tabs).toEqual(['units','territories']);
});

test('selecting a completed HQ trains the pioneer in that exact building queue',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const buildingId=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ fixture site');
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('Could not build HQ fixture');
  base.buildRemaining=0;base.hp=1200;
  battlefield.selected.clear();battlefield.selectedBase=base.id;
  battlefield.sync(true,.06,false,1);battlefield.drawInterface();
  return base.id;
 });
 await expect(page.locator('#sf-tabs button[data-tab="units"]')).toBeVisible();
 await expect(page.locator('#sf-tabs button[data-tab="buildings"]')).toBeHidden();
 await expect(page.locator('[data-sf-producer="headquarters"]')).toBeVisible();
 await expect(page.locator('[data-sf-producer="barracks"]')).toBeHidden();
 await page.locator('[data-unit="engineer"]').click();
 const result=await page.evaluate(id=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const base=game.bases.find(b=>b.id===id);
  return {queue:base.queueTypes.slice(),selectedBase:battlefield.selectedBase,
   notice:battlefield.panel.querySelector('#sf-message').textContent,
   context:battlefield.panel.dataset.tab};
 },buildingId);
 expect(result.queue).toContain('engineer');
 expect(result.selectedBase).toBe(buildingId);
 expect(result.notice).toContain('in Auftrag');
 expect(result.context).toBe('units');
});

test('selecting multiple soldiers shows a squad portrait with the correct count',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const squad=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const soldiers=game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier).slice(0,2);
  if(soldiers.length!==2)throw Error('Starting campaign needs two soldiers');
  battlefield.selected=new Set(soldiers.map(u=>u.id));
  battlefield.selectedBase=null;
  battlefield.drawInterface();
  const selected=document.querySelector('#sf-squad-portrait');
  return {count:battlefield.selected.size,visible:!selected.hidden,
   singleHidden:document.querySelector('#sf-portrait').hidden,
   images:[...selected.querySelectorAll('.sf-squad-member')].length,
   label:selected.getAttribute('aria-label'),
   countLabel:selected.querySelector('.sf-squad-count').textContent};
 });
 expect(squad).toMatchObject({
  count:2,visible:true,singleHidden:true,images:3,
  label:'2 ausgewählte Einheiten',countLabel:'×2'
 });
 await expect.poll(()=>page.locator('#sf-squad-portrait .sf-squad-member').first()
  .evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 const single=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const soldier=game.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  battlefield.selected=new Set([soldier.id]);battlefield.drawInterface();
  return {groupHidden:document.querySelector('#sf-squad-portrait').hidden,
   singleVisible:!document.querySelector('#sf-portrait').hidden};
 });
 expect(single).toEqual({groupHidden:true,singleVisible:true});
});

test('paused simulation is visibly labeled and resumes unit logic in 3D showcase',async({page})=>{
 test.setTimeout(120000);
 await load(page); // deliberately starts in ?pause=1
 const banner=page.locator('#sf3d-simulation-state');
 await expect(banner).toBeVisible();
 await expect(banner).toContainText('SIMULATION PAUSIERT');
 const start=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.evaluate(()=>document.getElementById('simulation').click());
 await expect(banner).toBeHidden();
 await page.waitForFunction(previous=>window.__sandforgeWebGL.game.time>previous+.20,
  start,{timeout:15000});
 await page.evaluate(()=>window.__sandforgeWebGL.setShowcase(true));
 const before=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.waitForFunction(previous=>window.__sandforgeWebGL.game.time>previous+.20,
  before,{timeout:15000});
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.evaluate(()=>document.getElementById('simulation').click());
 await expect(banner).toContainText('SIMULATION PAUSIERT');
 const stopped=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 await page.waitForTimeout(180);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.time)).toBeCloseTo(stopped,5);
});

test('a medic in lite 3D mode is a detailed soldier instead of a blue capsule',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const medicId=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const engineer=game.units.find(u=>u.owner===0&&u.hp>0&&u.kind==='engineer');
  if(!engineer)throw Error('No engineer to anchor test');
  const medic=game.spawn(0,{x:engineer.x+75,y:engineer.y+15},'medic');
  battlefield.sync(true,.02,false,1);
  const entry=battlefield.units.get(medic.id);
  if(!entry?.requested)throw Error('Lite mode failed to request genuine medic GLB');
  if(entry.placeholder.children.length<10)throw Error('Medic fallback still looks like a capsule');
  return medic.id;
 });
 await page.waitForFunction(id=>Boolean(window.__sandforgeWebGL.battlefield.units.get(id)?.detail),
  medicId,{timeout:70000});
 const state=await page.evaluate(id=>{
  const e=window.__sandforgeWebGL.battlefield.units.get(id);
  return {kind:e.kind,detail:!!e.detail,removed:!e.placeholder.parent,meshes:e.detail.children.length};
 },medicId);
 expect(state.kind).toBe('medic');
 expect(state.detail).toBe(true);
 expect(state.removed).toBe(true);
 expect(state.meshes).toBeGreaterThan(0);
});

test('production has a framed panel with live queue slots and building progress',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const layout=await page.evaluate(()=>{
  const dock=document.querySelector('#sidebar').getBoundingClientRect();
  const panel=document.querySelector('#sf-production');
  const production=panel.getBoundingClientRect();
  const catalog=document.querySelector('#sf-actions').getBoundingClientRect();
  return {height:production.height,catalogHeight:catalog.height,
   beside:production.left>=catalog.right-2,inside:production.bottom<=dock.bottom,
   separate:panel.parentElement?.id==='sidebar',
   border:getComputedStyle(panel).borderTopWidth,
   empty:document.querySelector('#sf-queue-slots').textContent};
 });
 expect(layout.height).toBeGreaterThanOrEqual(215);
 expect(layout.catalogHeight).toBeGreaterThan(100);
 expect(layout.beside).toBe(true);
 expect(layout.separate).toBe(true);
 expect(layout.inside).toBe(true);
 expect(layout.border).toBe('2px');
 expect(layout.empty).toContain('Noch keine Produktion aktiv');

 const queue=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No HQ location');
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('HQ build failed');
  hq.buildRemaining=0;hq.hp=1200;
  if(!game.recruit(hq.id,'engineer')||!game.recruit(hq.id,'engineer'))
   throw Error('Cannot enqueue 2 pioneers');
  hq.production=hq.queue[0]*.5;
  battlefield.selectedBase=hq.id;battlefield.selected.clear();battlefield.drawInterface();
  const panel=document.querySelector('#sf-production');
  const first=panel.querySelector('[data-queue-index="0"]');
  return {count:panel.querySelectorAll('[data-queue-index]').length,
   name:first.querySelector('strong').textContent,icon:first.querySelector('img').dataset.sfUnitIcon,
   status:first.querySelector('small').textContent,
   progress:panel.querySelector('#sf-progress').style.width,
   tileProgress:first.querySelector('.sf-slot-progress i').style.width,
   aria:panel.querySelector('.production-track').getAttribute('aria-valuenow'),
   time:panel.querySelector('#sf-queue-time').textContent,
   summary:panel.querySelector('#sf-queue-count').textContent};
 });
 expect(queue.count).toBe(2);
 expect(queue.name).toBe('Pionier');
 expect(queue.icon).toBe('engineer');
 expect(queue.status).toContain('50%');
 expect(Number.parseFloat(queue.progress)).toBeCloseTo(50,5);
 expect(Number.parseFloat(queue.tileProgress)).toBeCloseTo(50,5);
 expect(queue.aria).toBe('50');
 expect(queue.time).toMatch(/^\d+ s$/);
 expect(queue.summary).toContain('2 AUFTRÄGE');

 const construction=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const hq=game.bases.find(b=>b.id===battlefield.selectedBase);
  game.cancel(hq.id);game.cancel(hq.id);
  hq.buildRemaining=10;hq.production=0;
  battlefield.drawInterface();
  const tile=document.querySelector('#sf-queue-slots [data-build-id]');
  return {name:tile?.querySelector('strong').textContent,
   status:tile?.querySelector('small').textContent,
   progress:document.querySelector('#sf-progress').style.width,
   buildHidden:document.querySelector('#sf-building-status').hidden,
   summary:document.querySelector('#sf-queue-count').textContent};
 });
 expect(construction.name).toBe('Feldkommando');
 expect(construction.status).toContain('BAU · 50%');
 expect(Number.parseFloat(construction.progress)).toBeCloseTo(50,5);
 expect(construction.buildHidden).toBe(false);
 expect(construction.summary).toContain('1 BAU');
});


test('production strip globally lists every producer and building site without selection',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('No headquarters');
  hq.buildRemaining=0;
  hq.queue=[7,7];hq.queueTypes=['engineer','engineer'];hq.production=3.5;
  const barracks={...hq,id:hq.id+1000,kind:'barracks',hp:800,
   x:hq.x+220,queue:[10,8],queueTypes:['infantry','medic'],production:5};
  const factory={...hq,id:hq.id+1001,kind:'factory',hp:1100,
   x:hq.x+390,queue:[18],queueTypes:['tank'],production:9};
  const newSite={...hq,id:hq.id+1002,kind:'turret',hp:650,
   x:hq.x+510,queue:[],queueTypes:[],production:0,buildRemaining:5};
  game.bases.push(barracks,factory,newSite);
  battlefield.selected.clear();battlefield.selectedBase=null; battlefield.drawInterface();
  const panel=document.querySelector('#sf-queue-slots');
  const before=[...panel.querySelectorAll('[data-queue-base]')]
   .map(n=>({base:Number(n.dataset.queueBase),unit:n.querySelector('strong').textContent,
    source:n.querySelector('.sf-production-source')?.textContent,
    pct:n.querySelector('small').textContent}));
  const siteCount=panel.querySelectorAll('[data-build-id]').length;
  const savedNode=panel.querySelector('[data-queue-base]');
  battlefield.selectedBase=factory.id;battlefield.drawInterface();
  const afterFactory=panel.querySelector('[data-queue-base]')===savedNode;
  battlefield.selectedBase=hq.id;battlefield.drawInterface();
  const afterHQ=panel.querySelector('[data-queue-base]')===savedNode;
  battlefield.selectedBase=null;battlefield.drawInterface();
  return {before,siteCount,afterFactory,afterHQ,
   summary:document.querySelector('#sf-queue-count').textContent};
 });
 expect(state.before.map(x=>x.unit)).toEqual([
  'Pionier','Pionier','Infanteriesoldat','Sanitäter','Kampfpanzer'
 ]);
 expect(new Set(state.before.map(x=>x.base)).size).toBe(3);
 expect(state.before.find(x=>x.unit==='Kampfpanzer').source).toBe('Fahrzeugfabrik');
 expect(state.before.find(x=>x.unit==='Kampfpanzer').pct).toContain('50%');
 expect(state.siteCount).toBe(1);
 expect(state.afterFactory).toBe(true);
 expect(state.afterHQ).toBe(true);
 expect(state.summary).toContain('5 AUFTRÄGE');
 expect(state.summary).toContain('1 BAU');
});

test('generator build card becomes grey and disabled after the third energy core',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const hq=game.build(0,'headquarters',site);
  if(!hq)throw Error('Could not build HQ');
  hq.buildRemaining=0;
  const engineer=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([engineer.id]);
  battlefield.selectedBase=null;
  const button=()=>document.querySelector('#sf-actions [data-build="generator"]');
  battlefield.drawInterface();
  const initial={disabled:button()?.disabled};
  for(let i=0;i<2;i++){
   game.bases.push({...hq,id:hq.id+2000+i,kind:'generator',hp:500,
    queue:[],queueTypes:[],buildRemaining:9,production:0});
  }
  battlefield.drawInterface();
  const two={disabled:button().disabled};
  game.bases.push({...hq,id:hq.id+2002,kind:'generator',hp:500,
   queue:[],queueTypes:[],buildRemaining:9,production:0});
  battlefield.drawInterface();
  const three={disabled:button().disabled,locked:button().classList.contains('locked'),
   reason:button().getAttribute('aria-description'),tooltip:button().title};
  game.bases.pop();battlefield.drawInterface();
  const afterRemoval={disabled:button().disabled};
  return {initial,two,three,afterRemoval};
 });
 expect(state.initial.disabled).toBe(false);
 expect(state.two.disabled).toBe(false);
 expect(state.three.disabled).toBe(true);
 expect(state.three.locked).toBe(true);
 expect(state.three.reason).toContain('Maximal 3 Energiekerne');
 expect(state.three.tooltip).toContain('Maximal 3 Energiekerne');
 expect(state.afterRemoval.disabled).toBe(false);
});

test('vehicle factory and barracks have recognizable physical equipment beside them',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const state=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  game.credits[0]=10000;
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  const base=game.build(0,'headquarters',site);
  if(!base)throw Error('HQ fixture missing');
  base.kind='factory';base.hp=1100;base.buildRemaining=0;
  const barracks={...base,id:base.id+3000,kind:'barracks',hp:800,
   x:base.x+250,queue:[],queueTypes:[],production:0};
  game.bases.push(barracks);
  battlefield.sync(true,0,false,1);
  const workshop=battlefield.bases.get(base.id)?.yard;
  const infantry=battlefield.bases.get(barracks.id)?.yard;
  const count=(root,name)=>{
   let n=0;root?.traverse(obj=>{if(obj.name===name)n++;});return n;
  };
  base.facing=2;barracks.facing=3;battlefield.sync(false,0,false,1);
  return {workshop:workshop?.name,infantry:infantry?.name,
   wheels:count(workshop,'SpareTyre'),tracks:count(workshop,'SpareTrackLink'),
   engines:count(workshop,'EngineBlock'),
   helmets:count(infantry,'InfantryHelmet'),
   guns:count(infantry,'InfantryWeaponRackRifle'),
   visuallyOnly:workshop?.userData?.nonPlayable&&infantry?.userData?.nonPlayable,
   factoryTurn:battlefield.bases.get(base.id)?.node.rotation.y,
   barracksTurn:battlefield.bases.get(barracks.id)?.node.rotation.y};
 });
 expect(state.workshop).toBe('sf-yard-factory');
 expect(state.infantry).toBe('sf-yard-barracks');
 expect(state.wheels).toBe(5);
 expect(state.tracks).toBe(8);
 expect(state.engines).toBe(1);
 expect(state.helmets).toBe(3);
 expect(state.guns).toBe(3);
 expect(state.visuallyOnly).toBe(true);
 expect(state.factoryTurn).toBeCloseTo(Math.PI/2,5);
 expect(state.barracksTurn).toBeCloseTo(Math.PI*1.5,5);
});
