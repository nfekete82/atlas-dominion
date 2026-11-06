import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';
import {offlineRadarPixels} from '../dist/src/reborn/radar-offline.js';
import {Renderer} from '../dist/src/reborn/renderer.js';
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step();};
const campaign=(seed=2026,version=11)=>{const g=Simulation.campaign(seed,version);g.aiClock=-1e8;return g;};
const worker=(g,owner=0)=>g.units.find(u=>u.owner===owner&&u.kind==='engineer');
function placeHQ(g,owner=0,facing=0){
 for(const p of g.headquartersCandidates(owner))if(!g.buildError(owner,'headquarters',p)){
  const b=g.build(owner,'headquarters',p,[worker(g,owner).id],facing);if(b)return b;
 }
 throw Error('No valid HQ site: '+g.seed+'/'+g.world.mapVersion);
}
const finishHQ=(g,owner=0)=>{const b=placeHQ(g,owner);for(let i=0;i<1200&&b.buildRemaining>0;i++)g.step();assert.equal(b.buildRemaining,0);return b;};

test('HQ bootstrap: every campaign starts with one soldier and one pioneer per faction, zero buildings, affordable headquarters and ordinary fog',()=>{
 for(const version of [2,11,12,13,14])for(const seed of [0,2026,0xffffffff]){
  const g=campaign(seed,version);assert.equal(g.bootstrapVersion,1);assert.equal(g.bases.length,0);
  assert.deepEqual(Simulation.load(g.save()).save(),Simulation.load(g.save()).save());
  for(const owner of [0,1]){
   assert.deepEqual(g.units.filter(u=>u.owner===owner).map(u=>u.kind).sort(),['engineer','infantry']);
   assert.ok(g.units.filter(u=>u.owner===owner).every(u=>g.world.walkable(u,g.obstacles())));
   assert.ok(g.credits[owner]>=BUILDINGS.headquarters.cost&&BUILDINGS.headquarters.cost>0);
   assert.equal(g.radarOnline(owner),false);assert.equal(g.producer(owner,'engineer'),undefined);
   assert.ok(g.visible[owner].some(v=>v===1)&&g.visible[owner].some(v=>v===0));
   const enemy=worker(g,1-owner);assert.equal(g.canSee(owner,enemy),false);
   const sites=g.headquartersCandidates(owner).filter(p=>!g.buildError(owner,'headquarters',p));
   assert.ok(sites.length>=12,'generous real buildable area');
   assert.ok(sites.some(a=>sites.some(b=>distance(a,b)>250)),'free choice, not one scripted tile');
   assert.ok(sites.every(p=>distance(p,g.startRegions[owner].center)+BUILDINGS.headquarters.radius<=g.startRegions[owner].radius+.001));
   for(const kind of ['barracks','factory','generator','turret','airfield'])assert.match(g.buildError(owner,kind,sites[0]),/fertiggestelltes Hauptquartier/);
  }
  const copy=Simulation.campaign(seed,version);assert.deepEqual(g.startRegions,copy.startRegions);assert.deepEqual(g.world.blocked,copy.world.blocked);
  g.step();assert.equal(g.status,'playing','empty HQ list never gives a vacuous victory');
 }
});
test('HQ bootstrap: map-wide construction keeps terrain, footprint and unit safety without start radius or fog lock',()=>{
 const g=campaign(),p=g.headquartersCandidates(0).find(p=>!g.buildError(0,'headquarters',p));
 // Starting anchors guide the AI; they no longer restrict player construction.
 // Check an ordinary tile far beyond the former starting radius.
 const region=g.startRegions[0],r=BUILDINGS.headquarters.radius;
 let distant=null;
 for(let y=r+80;y<g.world.size-r-80&&!distant;y+=90)
  for(let x=r+80;x<g.world.size-r-80;x+=90){
   const site={x,y};
   if(distance(site,region.center)<=region.radius+r+120)continue;
   if(g.buildError(0,'headquarters',site)===null){distant=site;break;}
  }
 assert.ok(distant,'a valid first-HQ site exists outside the former start region');
 assert.ok(distance(distant,region.center)>region.radius+r+120);
 const previousFog=g.explored[0].slice();
 g.explored[0].fill(0);
 assert.equal(g.buildError(0,'headquarters',distant),null,'HQ construction works even on unexplored ground');
 g.explored[0].set(previousFog);
 const cell=g.world.index(p),blocked=g.world.blocked[cell];g.world.blocked[cell]=1;
 assert.match(g.buildError(0,'headquarters',p),/Felsen/);g.world.blocked[cell]=blocked;
 const explored=g.explored[0].slice();g.explored[0].fill(0);assert.equal(g.buildError(0,'headquarters',p),null,'first HQ has no fog gate');g.explored[0].set(explored);
 const u=g.units.find(u=>u.owner===0&&u.kind==='infantry'),old={x:u.x,y:u.y};Object.assign(u,p);
 assert.match(g.buildError(0,'headquarters',p),/Einheiten/);Object.assign(u,old);
 const credits=g.credits[0];assert.equal(g.build(0,'headquarters',p,[worker(g,1).id]),null);assert.equal(g.credits[0],credits);
 const site=placeHQ(g,0,1);assert.equal(site.facing,1);assert.equal(site.radius,BUILDINGS.headquarters.radius);
 assert.equal(g.world.walkable(site,g.obstacles()),false,'normal building collision');
 assert.equal(Simulation.load(g.save()).bases[0].facing,1);
});
test('HQ bootstrap: paid, worker-driven build pauses, resumes and unlocks radar/production exactly at completion',()=>{
 const g=campaign(),before=g.credits[0],hq=placeHQ(g),w=worker(g);
 assert.equal(g.credits[0],before-BUILDINGS.headquarters.cost);assert.ok(hq.buildRemaining>0);assert.equal(g.radarOnline(0),false);
 assert.match(g.buildError(0,'headquarters',g.startRegions[0].center),/bereits/);
 advance(g,2);g.stop([w.id]);const remaining=hq.buildRemaining;advance(g,3);assert.equal(hq.buildRemaining,remaining);
 assert.equal(g.recruit(hq.id,'engineer'),false);assert.equal(g.radarOnline(0),false);
 assert.ok(g.command([w.id],{...hq,kind:'build',target:hq.id}));
 for(let i=0;i<1000&&hq.buildRemaining>0;i++){assert.equal(g.radarOnline(0),false);g.step();}
 assert.equal(hq.buildRemaining,0);assert.equal(g.radarOnline(0),true);assert.equal(g.producer(0,'engineer').id,hq.id);
 assert.deepEqual(g.notices,['Hauptquartier errichtet. Radar online.']);advance(g,1);assert.equal(g.notices.length,1);
 assert.ok(g.recruit(hq.id,'engineer'));
 const restored=Simulation.load(g.save());assert.equal(restored.radarOnline(0),true);assert.equal(restored.notices.length,0);
 const legal=g.headquartersCandidates(0).some(p=>!g.buildError(0,'barracks',p));assert.ok(legal);
});
test('HQ bootstrap: cancellation is refundable and restartable; unfinished saves preserve pending work and radar lock',()=>{
 const g=campaign(),start=g.credits[0],hq=placeHQ(g);advance(g,2);
 const saved=g.save(),loaded=Simulation.load(saved);assert.equal(loaded.bases[0].buildRemaining,hq.buildRemaining);assert.equal(loaded.radarOnline(0),false);
 assert.equal(loaded.units.find(u=>u.id===worker(g).id).orders[0].target,hq.id);
 assert.ok(g.cancelConstruction(hq.id));assert.equal(g.credits[0],start-BUILDINGS.headquarters.cost+Math.floor(BUILDINGS.headquarters.cost*.75));
 assert.equal(g.radarOnline(0),false);assert.doesNotThrow(()=>placeHQ(g));
 const a=Simulation.load(saved),b=Simulation.load(saved);advance(a,30);advance(b,30);assert.deepEqual(a.save(),b.save());assert.equal(a.radarOnline(0),true);
});
test('HQ bootstrap: loss of the only pioneer before or during HQ construction ends the match without a softlock',()=>{
 for(const during of [false,true]){
  const g=campaign();if(during)placeHQ(g);g.units=g.units.filter(u=>u.id!==worker(g).id);g.step();
  assert.equal(g.status,'defeat');assert.ok(g.count(0)>0,'soldier survives');assert.equal(g.radarOnline(0),false);
  assert.equal(Simulation.load(g.save()).status,'defeat');
 }
 const complete=campaign(),hq=finishHQ(complete);complete.units=complete.units.filter(u=>u.id!==worker(complete).id);complete.step();
 assert.equal(complete.status,'playing');assert.ok(complete.recruit(hq.id,'engineer'),'completed HQ can replace a pioneer');
 const enemy=campaign();enemy.units=enemy.units.filter(u=>u.id!==worker(enemy,1).id);enemy.step();assert.equal(enemy.status,'victory');
});
test('HQ bootstrap: AI uses paid real construction on varied maps, resumes work and then hands off to Tactical AI',()=>{
 for(const version of [2,11,12,13,14])for(const seed of [0,2026,75310]){
  const g=Simulation.campaign(seed,version),built=[],original=g.build.bind(g);
  g.build=(owner,kind,...args)=>{const credits=g.credits[owner],b=original(owner,kind,...args);if(b&&owner===1){assert.equal(g.credits[1],credits-BUILDINGS[kind].cost);built.push(kind);}return b;};
  advance(g,3.1);const site=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');assert.ok(site,version+'/'+seed);
  assert.ok(site.buildRemaining>0);assert.equal(g.radarOnline(1),false);assert.deepEqual(built,['headquarters']);
  g.stop([worker(g,1).id]);advance(g,40);assert.equal(site.buildRemaining,0);assert.equal(g.radarOnline(1),true);
  assert.ok(g.tactical.state.lastPlan>0,'existing Tactical AI resumes');assert.ok(built.includes('barracks'));
  assert.ok(!g.notices.includes('Hauptquartier errichtet. Radar online.'),'enemy completion is never announced');
 }
});
test('HQ bootstrap: old HQ saves remain online and retain their legacy rules; new markers are validated',()=>{
 const legacy=new Simulation(2026,11),saved=legacy.save();assert.equal(saved.bootstrapVersion,undefined);
 const copy=Simulation.load(saved);assert.equal(copy.radarOnline(0),true);assert.equal(copy.needsHeadquarters(0),false);assert.deepEqual(copy.bases,legacy.bases);
 const newGame=campaign(),empty=newGame.save();assert.equal(empty.bases.length,0);assert.equal(Simulation.load(empty).bases.length,0);
 assert.throws(()=>Simulation.load({...empty,bootstrapVersion:2}));assert.throws(()=>Simulation.load({...saved,bases:[]}));
 assert.deepEqual(Simulation.load(empty).startRegions,newGame.startRegions);
});
test('radar offline: animated greyscale noise is independent of map/enemy state; reduced motion stays stable',()=>{
 const first=offlineRadarPixels(32,1),second=offlineRadarPixels(32,2);assert.notDeepEqual(first,second);
 assert.deepEqual(first,offlineRadarPixels(32,1));assert.deepEqual(offlineRadarPixels(32,1,true),offlineRadarPixels(32,2,true));
 for(let i=0;i<first.length;i+=4){assert.equal(first[i],first[i+1]);assert.equal(first[i],first[i+2]);assert.equal(first[i+3],255);}
 const r=Object.create(Renderer.prototype);r.miniCanvas={width:32};let image;
 r.mini={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>image=data,drawImage:()=>assert.fail('offline radar may never draw map sprites')};
 r.game=new Proxy({radarOnline:()=>false},{get:(g,key)=>{if(key!=='radarOnline')assert.fail('offline radar read game state: '+String(key));return g[key];}});
 r.renderMiniMeasured();assert.equal(image.data.length,32*32*4);
});
