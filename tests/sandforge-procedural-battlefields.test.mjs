import {test} from 'node:test';
import * as THREE from 'three';
import {blendOasisTerrain} from '../scripts/webgl-oasis-materials.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout,mapWorldSize} from '../dist/src/reborn/config.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {TERRAIN_PROFILES,battlefieldHeightAt,battlefieldSlopeAt,streamSeed,terrainProfile} from '../dist/src/reborn/battlefield-terrain.js';
import {validateBattlefield} from '../dist/src/reborn/battlefield-validation.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {generateOases,safeOasis} from '../scripts/webgl-oasis-generation.js';
const portableHash=w=>createHash('sha256').update(JSON.stringify(w.generated??null,(_,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v)).update(w.blocked).update(w.opaque).update(JSON.stringify(w.territories(),(_,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v)).digest('hex');
const hash=w=>createHash('sha256').update(JSON.stringify(w.generated??null)).update(w.blocked).update(w.opaque).update(JSON.stringify(w.territories())).digest('hex');

test('historical v0–22 geometry, collisions, opacity and economy match 69 PR #239 golden fingerprints',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/battlefield-historical-geometry.json',import.meta.url),'utf8'));
 for(const f of fixtures){
  const w=new World(f.seed,f.version);
  // Number serialization of trigonometry differs in the last bits between
  // Node 22/x86 and Node 25/ARM. Collision and opacity remain byte-exact.
  assert.equal(portableHash(w),f.portableHash,`v${f.version}, seed ${f.seed}`);
  if(process.version===f.node&&process.platform===f.platform&&process.arch===f.arch)assert.equal(hash(w),f.hash);
 }
});

test('all sizes, profiles and four actual starting orientations have connected tank routes and equal HQ pads',()=>{
 for(const version of [23,24,25,26])for(const profile of TERRAIN_PROFILES)for(const seed of [0,1,2,3]){
  const g=Simulation.campaign(seed,version,profile),w=g.world,v=w.validation,t=w.generated.battlefield;
  assert.equal(v.valid,true,JSON.stringify(v));assert.equal(t.profile,profile);
  assert.equal(w.size,mapWorldSize(version));assert.equal(v.reachableSites,g.territories.length);
  assert.equal(v.tankReachableSites,g.territories.length);assert.equal(v.connectedCells,v.freeCells);
  assert.ok(Math.abs(v.buildAreaSamples[0]-v.buildAreaSamples[1])<=8);
  for(const owner of [0,1]){
   const layout=campaignLayout(version,seed);assert.equal(g.territories[layout.headquarters[owner]].owner,owner);
   assert.equal(g.income(0),g.income(1));assert.ok(v.expansionDirections[owner]>=2);
   assert.ok(g.headquartersCandidates(owner).some(p=>g.buildError(owner,'headquarters',p)===null));
   for(const u of g.units.filter(u=>u.owner===owner)){
    assert.ok(w.walkable(u));assert.equal(w.terrainHeight(u.x,u.y),0);
    assert.ok(Math.hypot(u.x-g.startRegions[owner].center.x,u.y-g.startRegions[owner].center.y)<400);
   }
  }
 }
});

test('named streams and profile choice are deterministic; seeds change continuous relief, sites, rocks and ruins',()=>{
 assert.notEqual(streamSeed(42,'terrain'),streamSeed(42,'rocks'));
 for(const profile of TERRAIN_PROFILES){
  const a=new World(2074,23,profile),b=new World(2074,23,profile),c=new World(2075,23,profile);
  assert.equal(hash(a),hash(b));assert.deepEqual(a.generated,generateMap(2074,23,profile,a.validation.candidate));
  assert.notDeepEqual(a.generated.battlefield.heights,c.generated.battlefield.heights);
  assert.notDeepEqual(a.generated.sites,c.generated.sites);assert.notDeepEqual(a.rocks,c.rocks);
  assert.notDeepEqual(a.generated.ruins,c.generated.ruins);
 }
 const profiles=new Set(Array.from({length:60},(_,seed)=>terrainProfile(seed)));assert.equal(profiles.size,5);
});

test('heightfield sampler exactly follows rendered triangles, with safe gradients and genuinely different profile relief',()=>{
 const ranges=[];
 for(const profile of TERRAIN_PROFILES){
  const w=new World(2074,26,profile),t=w.generated.battlefield,n=t.segments+1,step=t.size/t.segments;
  ranges.push(t.maxHeight-t.minHeight);
  for(let j=0;j<t.segments;j+=3)for(let i=0;i<t.segments;i+=3){
   const k=j*n+i;
   assert.ok(Math.abs(battlefieldHeightAt(t,i*step,j*step)-t.heights[k])<1e-9);
   for(const [u,v] of [[.2,.3],[.7,.8]]){
    const expected=u+v<=1?t.heights[k]+(t.heights[k+1]-t.heights[k])*u+(t.heights[k+n]-t.heights[k])*v:
     t.heights[k+n+1]+(t.heights[k+n]-t.heights[k+n+1])*(1-u)+(t.heights[k+1]-t.heights[k+n+1])*(1-v);
    assert.ok(Math.abs(w.terrainHeight((i+u)*step,(j+v)*step)-expected)<1e-8);
    assert.ok(battlefieldSlopeAt(t,(i+u)*step,(j+v)*step)<.312);
   }
  }
 }
 assert.ok(ranges[0]<35);assert.ok(ranges[1]>100);assert.ok(ranges[2]>180);assert.ok(ranges[3]<85);assert.ok(ranges[4]>120);
});

test('infantry, engineer, vehicle and heavy tank paths reach every bastion with their real clearance and solid rocks',()=>{
 for(const version of [23,26])for(const profile of TERRAIN_PROFILES){
  const w=new World(2074,version,profile),start=w.generated.sites[0];
  for(const kind of ['infantry','engineer','rover','tank'])for(const target of w.generated.sites.slice(1)){
   const clearance=Math.max(0,UNITS[kind].radius-10),path=w.path(start,target,[],clearance,undefined,false,true);
   assert.ok(path.length,`${version}/${profile}/${kind}`);
   assert.ok(Math.hypot(path.at(-1).x-target.x,path.at(-1).y-target.y)<1e-5);
   let from=start;for(const to of path){assert.ok(w.line(from,to,[],clearance));from=to;}
  }
  for(const mesa of w.generated.mesas){const p=mesa.outline.reduce((a,b)=>({x:a.x+b.x/mesa.outline.length,y:a.y+b.y/mesa.outline.length}),{x:0,y:0});assert.equal(w.walkable(p),false);}
 }
});

test('validation detects real unreachable terrain; final deterministic candidate has bounded safe geometry',()=>{
 const w=new World(27,26,'rocky');
 for(let x=0;x<240;x++)w.blocked[120*240+x]=1;
 assert.equal(validateBattlefield(w).valid,false);
 const fallback=new World(27,26,'rocky',3);
 assert.equal(fallback.validation.valid,true);assert.equal(fallback.validation.candidate,3);
 assert.equal(fallback.generated.mesas.length,0);assert.equal(fallback.generated.ruins.length,0);
 assert.equal(fallback.generated.battlefield.profile,'rocky');
});

test('all profiles place the existing premium oases safely on the authoritative terrain',()=>{
 for(const version of [23,24,25,26])for(const profile of TERRAIN_PROFILES){
  const g=Simulation.campaign(2074,version,profile),options={world:g.world,startRegions:g.startRegions,heightAt:(x,y)=>g.world.terrainHeight(x,y)};
  const before=g.world.blocked.slice(),oases=generateOases(options);assert.ok(oases.length>=1,`${version}/${profile}`);
  assert.deepEqual(oases,generateOases(options));
  for(let i=0;i<oases.length;i++)assert.ok(safeOasis(oases[i],options,oases.slice(0,i)));
  assert.deepEqual(g.world.blocked,before);
 }
});

test('high ground uses the real walkable heightfield, excludes low ground, cliffs and aircraft',()=>{
 const g=Simulation.campaign(2074,26,'rocky');g.highGroundEnabled=true;
 const w=g.world;
 const high=Array.from({length:w.blocked.length},(_,i)=>w.center(i)).find(p=>w.walkable(p)&&w.terrainHeight(p.x,p.y)>60&&w.terrainSlope(p.x,p.y)<.15);
 assert.ok(high);assert.equal(g.onHighGround(high),true);
 assert.equal(g.onHighGround(g.units[0]),false);
 assert.equal(g.onHighGround({...high,kind:'bomber'}),false);
 w.blocked[w.index(high)]=1;assert.equal(g.onHighGround(high),false);
 const old=Simulation.campaign(2074,19);old.highGroundEnabled=true;assert.ok(old.hills.length>0);
});

test('v23–26 save/load preserves the actual selected profile, seed, geometry, collision, fog and start ownership',()=>{
 for(const version of [23,24,25,26])for(const profile of TERRAIN_PROFILES){
  const g=Simulation.campaign(4294967295,version,profile),raw=JSON.parse(JSON.stringify(g.save())),copy=Simulation.load(raw);
  assert.equal(raw.generatorVersion,1);assert.equal(raw.terrainProfile,profile);assert.equal(raw.seed,4294967295);
  assert.equal(hash(g.world),hash(copy.world));assert.deepEqual(g.startRegions,copy.startRegions);assert.deepEqual(g.explored,copy.explored);
  assert.deepEqual(g.territories.map(t=>t.owner),copy.territories.map(t=>t.owner));
  assert.throws(()=>Simulation.load({...raw,terrainProfile:'invalid'}),/beschädigt/);
  assert.throws(()=>Simulation.load({...raw,generatorVersion:2}),/beschädigt/);
  assert.throws(()=>Simulation.load({...raw,terrainProfile:undefined}),/beschädigt/);
 }
});

test('paid AI bootstrap builds headquarters, produces and reaches new bastions from every corner on small and large maps',()=>{
 for(const version of [23,26])for(const seed of [0,1,2,3]){
  const g=Simulation.campaign(seed,version,seed%2?'rocky':'mixed');g.highGroundEnabled=true;g.visionScale=1.3;g.infantryVisionBonus=1.15;
  const born=new Set(g.units.map(u=>u.id));let produced=false,expanded=false,hq=false;
  for(let tick=0;tick<180*20&&g.status==='playing';tick++){
   g.step(.05);
   if(tick%20===0){hq||=g.hasHeadquarters(1);produced||=g.units.some(u=>u.owner===1&&!born.has(u.id));expanded||=g.territories.filter(t=>t.owner===1).length>1;}
  }
  assert.ok(hq,`HQ v${version} seed ${seed}`);assert.ok(produced,`production v${version} seed ${seed}`);assert.ok(expanded,`expansion v${version} seed ${seed}`);
  for(const u of g.units.filter(u=>u.owner===1&&!['bomber','scout'].includes(u.kind)))assert.ok(g.world.walkable(u));
 }
});


test('premium soil shader includes every oasis and reclaims the fifth soil mask on construction',()=>{
 for(const count of [1,4,5]){
  const material=new THREE.MeshStandardMaterial(),original=material.onBeforeCompile;
  const oases=Array.from({length:count},(_,i)=>({x:500+i*500,y:900,radius:120,phase:0,aspect:.7,rotation:0,type:'water'}));
  const restore=blendOasisTerrain(material,oases,3000),shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.oasisCenters.value.length,Math.max(4,count));
  assert.equal(shader.uniforms.oasisShapes.value.length,Math.max(4,count));
  assert.ok(shader.fragmentShader.includes(`oasisCenters[${Math.max(4,count)}]`));
  const last=count-1;assert.equal(shader.uniforms.oasisCenters.value[last].x,oases[last].x-3000);
  restore.setHidden(new Set([last]));assert.equal(shader.uniforms.oasisCenters.value[last].x,1e8);
  restore.setHidden(new Set());assert.equal(shader.uniforms.oasisCenters.value[last].x,oases[last].x-3000);
  restore();assert.equal(material.onBeforeCompile,original);material.dispose();
 }
});
