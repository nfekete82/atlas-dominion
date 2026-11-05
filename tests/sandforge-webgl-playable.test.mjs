import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {SandforgeConstructionRecovery} from '../dist/webgl-construction-recovery.js';

test('Canyon v15-v18: 3D campaign saves remain reloadable without changing simulation',()=>{
 for(const version of [15,16,17,18]){
  const original=new Simulation(2074,version);
  const saved=original.save(),loaded=Simulation.load(saved);
  assert.equal(loaded.seed,original.seed);
  assert.equal(loaded.world.mapVersion,version);
  assert.deepEqual(loaded.bases.map(b=>b.id),original.bases.map(b=>b.id));
  assert.deepEqual(loaded.units.map(u=>u.kind),original.units.map(u=>u.kind));
  assert.equal(loaded.territories.length,original.territories.length);
  loaded.step(.05);
  assert.equal(loaded.time,.05);
 }
});

test('All 9 combat unit kinds and 6 structures have original authored 3D models',()=>{
 for(const kind of Object.keys(UNITS))for(const team of [0,1]){
  const folder=['tank','rover','artillery','scout','bomber'].includes(kind)?'animation':'prototype';
  const path='dist/src/assets/reborn/'+folder+'/'+kind+'-'+team+'.glb';
  assert.ok(existsSync(path),'missing 3D unit model '+path);
 }
 for(const kind of Object.keys(BUILDINGS))for(const team of [0,1]){
  const path='dist/src/assets/reborn/buildings-3d/'+kind+'-'+team+'.glb';
  assert.ok(existsSync(path),'missing 3D structure model '+path);
 }
});

test('WebGL build exposes full gameplay adapter, all draw modules and skinned Three.js animation',()=>{
 for(const path of ['dist/webgl-preview.html','dist/webgl-preview.js','dist/webgl-battlefield.js','dist/webgl-environment.js','dist/vendor/three/addons/utils/SkeletonUtils.js']){
  assert.ok(existsSync(path),path+' missing from runtime image');
 }
 assert.ok(existsSync('dist/webgl-actor-presentation.js'),'required 3D animation module must be shipped');
 assert.match(readFileSync('Dockerfile','utf8'),/COPY scripts\/webgl-actor-presentation\.js/);
 assert.match(readFileSync('scripts/build.mjs','utf8'),/cpSync\('scripts\/webgl-actor-presentation\.js'/);
 const main=readFileSync('dist/webgl-preview.js','utf8');
 const adapter=readFileSync('dist/webgl-battlefield.js','utf8');
 assert.match(main,/new SandforgeBattlefield/);
 assert.match(main,/new DesertArtPass/);
 assert.match(adapter,/new THREE\.ShaderMaterial/);
 assert.match(adapter,/buildInterface\(/);
 assert.match(adapter,/this\.game\.recruit\(/);
 assert.match(adapter,/this\.game\.build\(/);
 assert.match(adapter,/this\.game\.command\(/);
 assert.match(adapter,/this\.game\.save\(/);
 assert.match(adapter,/cloneSkeleton/);
 assert.match(adapter,/updateShots\(/);
 assert.match(adapter,/drawMinimap\(/);
 assert.match(main,/fineSandPattern\(context,source\)/);
 assert.match(main,/sand-ripples-v2\.png/);
 assert.doesNotMatch(main,/textures\.load\('\/src\/assets\/reborn\/buildings-3d\/textures\/desert-basecolor/);
 assert.doesNotMatch(main,/textures\.load\('\/src\/assets\/reborn\/buildings-3d\/textures\/desert-normal/);
 const docker=readFileSync('Dockerfile','utf8');
 assert.match(docker,/COPY scripts\/webgl-battlefield\.js/);
 assert.match(docker,/COPY scripts\/webgl-environment\.js/);
});

test('Classic Sandforge WebGL HUD shares the original shipped CSS and starts live',()=>{
 for(const path of ['dist/webgl-classic-hud.js','dist/webgl-classic-hud.css','dist/style.css','dist/retro-desert.css'])
  assert.ok(existsSync(path),path+' missing from Docker build');
 const hud=readFileSync('dist/webgl-classic-hud.js','utf8');
 const skin=readFileSync('dist/webgl-classic-hud.css','utf8');
 const js=readFileSync('dist/webgl-preview.js','utf8');
 const html=readFileSync('dist/webgl-preview.html','utf8');
 assert.match(hud,/class="top hud frame"/);
 assert.match(hud,/class="radar hud frame"/);
 assert.match(hud,/class="catalog hud frame"/);
 assert.match(hud,/class="command hud frame sf-command"/);
 assert.match(hud,/makeAction\('save'/);
 assert.match(skin,/#sf-classic-root/);
 assert.match(js,/running=query.get\('pause'\)!=='1'/);
 assert.match(js,/game.paused=false/);
 assert.match(html,/href="\/style.css"/);
 assert.match(html,/href="\/retro-desert.css"/);
 assert.match(html,/href="\/webgl-classic-hud.css"/);
});

test('WebGL RTS menu v2: isolated tabs and real 192x132 unit sprite portraits',()=>{
 assert.ok(existsSync('dist/webgl-portraits.js'),'portrait extractor must ship with Docker');
 const js=readFileSync('dist/webgl-portraits.js','utf8');
 const battlefield=readFileSync('dist/webgl-battlefield.js','utf8');
 const css=readFileSync('dist/webgl-classic-hud.css','utf8');
 assert.match(js,/const frameIndex=directions\[/);
 assert.match(js,/target.width=192;target.height=132/);
 assert.match(js,/sfIconStatus/);
 assert.match(battlefield,/hydrateUnitIcons\(actions\)/);
 assert.match(battlefield,/data-sf-producer/);
 assert.match(battlefield,/button\.dataset\.unit/);
 assert.match(css,/data-tab="units"/);
 assert.match(css,/data-tab="buildings"/);
 assert.match(css,/data-tab="territories"/);
 for(const kind of Object.keys(UNITS)){
  const folder=kind==='medic'?'prototype':'animation';
  const root='dist/src/assets/reborn/'+folder+'/'+kind+'-0';
  assert.ok(existsSync(root+'.png'),kind+' sprite missing');
  assert.ok(existsSync(root+'.json'),kind+' frames missing');
 }
});

test('Decoration outside the map is packaged but is absent from AI, pathfinding and gameplay raycasts',()=>{
 const perimeterPath='dist/webgl-perimeter.js';
 assert.ok(existsSync(perimeterPath),'visual-only terrain module missing from Docker runtime');
 const perimeter=readFileSync(perimeterPath,'utf8');
 const preview=readFileSync('dist/webgl-preview.js','utf8');
 const battlefield=readFileSync('dist/webgl-battlefield.js','utf8');
 const docker=readFileSync('Dockerfile','utf8');
 assert.match(perimeter,/visualPerimeter:true/);
 assert.match(perimeter,/nonPlayable:true/);
 assert.match(perimeter,/ringTiles=2/);
 assert.match(preview,/addVisualPerimeter\(/);
 assert.match(preview,/groundMeshes\.push\(mesh\)/);
 assert.match(preview,/panControls=new Set/);
 assert.match(preview,/stepCamera\(dt\)/);
 assert.match(battlefield,/KeyF/);
 assert.doesNotMatch(battlefield,/KeyA/);
 assert.match(docker,/COPY scripts\/webgl-perimeter\.js/);
});

test('3D and classic campaign share HQ-first economy, save flags and unit producer rules',()=>{
 for(const mapVersion of [15,16,17,18]){
  const game=Simulation.campaign(2074,mapVersion);
  assert.equal(game.bootstrapVersion,1);
  assert.equal(game.hasHeadquarters(0),false);
  assert.equal(game.needsHeadquarters(0),true);
  assert.equal(game.producer(0,'infantry'),undefined);
  assert.equal(game.producer(0,'engineer'),undefined);
  const saved=Simulation.load(game.save());
  assert.equal(saved.needsHeadquarters(0),true,'no free HQ after reload');
  const candidates=game.headquartersCandidates(0);
  const site=candidates.find(p=>game.buildError(0,'headquarters',p)===null);
  assert.ok(site,'at least one legal engineer HQ construction site on '+mapVersion);
  assert.equal(game.buildError(0,'barracks',site),'Ein fertiggestelltes Hauptquartier ist erforderlich.');
 }
});

test('3D Fog is black until discovery and zoom is constrained like the classic RTS',()=>{
 const preview=readFileSync('dist/webgl-preview.js','utf8');
 const adapter=readFileSync('dist/webgl-battlefield.js','utf8');
 assert.match(preview,/Simulation\.campaign\(seed,sizes\[bastions\]\)/);
 assert.match(preview,/controls\.minZoom=wideView\?\.42:\.46;controls\.maxZoom=3\.5/);
 assert.match(preview,/cameraRay\.setFromCamera\(c,camera\)/);
 assert.match(preview,/cameraGroundPlane/);
 assert.match(preview,/const correction=\(low,high\)/);
 assert.match(adapter,/visible\[0\]\[i\]\?0:explored\[0\]\[i\]\?215:255/);
 assert.match(adapter,/visible\[0\]\[index\]\?0:this\.game\.explored\[0\]\[index\]\?\.82:1/);
 assert.ok(adapter.includes('p.y+=3.0'),'fog overlay should follow ground height');
 assert.ok(!adapter.includes('p.y+=420.0'),'old elevated fog causes parallax');
 assert.match(adapter,/depthTest:false,depthWrite:false/);
 assert.match(adapter,/renderOrder=990/);
 assert.ok(adapter.includes('visualPerimeter'),'outer terrain must participate in fog');
});

test('3D stalled construction safely retries paths, reattaches idle original worker, preserves manual orders',()=>{
 const b={id:1000,owner:0,kind:'headquarters',x:200,y:200,radius:80,hp:300,buildRemaining:4};
 const worker={id:1,owner:0,kind:'engineer',hp:110,x:280,y:270,defendUntil:0,
  hold:false,carrier:null,workingTarget:null,repath:3,
  path:[{x:240,y:210}],orders:[{kind:'build',target:1000,x:200,y:200,approach:{x:290,y:210}}]};
 let commands=0;
 const g={time:0,paused:false,status:'playing',bases:[b],units:[worker],notices:[],
  command(ids,order){commands++;assert.deepEqual(ids,[1]);worker.orders=[order];return 1;}};
 const repair=new SandforgeConstructionRecovery(g);
 repair.tick();
 g.time=4.1;repair.tick();
 assert.equal(worker.path.length,0,'stalled original path must be cleared');
 assert.equal(worker.repath,0);
 assert.equal(worker.orders[0].approach,undefined,'stale approach must be recalculated');
 assert.equal(commands,0,'active build order must not be overwritten');
 worker.orders=[];g.time=9.2;repair.tick();
 assert.equal(commands,1,'idle originally assigned pioneer should be re-commissioned');
 assert.equal(worker.orders[0].kind,'build');
 assert.equal(repair.recovered,1);
 worker.orders=[{kind:'move',x:400,y:400}];
 g.time=15;repair.tick();
 assert.equal(commands,1,'manual move order must not be overwritten');
 assert.equal(worker.orders[0].kind,'move');
 b.buildRemaining=2.8;g.time=15.2;repair.tick();
 assert.equal(commands,1,'genuine progress must reset recovery timer');
});

test('3D suspended audio and unavailable tech-tree artwork have explicit styles',()=>{
 const main=readFileSync('dist/webgl-preview.js','utf8');
 const style=readFileSync('dist/webgl-classic-hud.css','utf8');
 const construction=readFileSync('dist/webgl-construction.js','utf8');
 assert.match(main,/window\.addEventListener\('focus',/);
 assert.match(main,/window\.addEventListener\('pageshow',/);
 assert.match(main,/document\.addEventListener\('visibilitychange',/);
 assert.match(main,/constructionRecovery\.tick\(\)/);
 assert.match(style,/filter:grayscale\(1\) blur\(\.85px\)/);
 assert.match(style,/button\.catalog-card:disabled/);
 assert.match(construction,/PAUSIERT · PIONIER/);
 assert.ok(existsSync('dist/webgl-construction-recovery.js'));
});
