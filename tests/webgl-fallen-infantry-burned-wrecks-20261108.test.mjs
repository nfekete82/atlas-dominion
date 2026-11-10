import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {
 WRECK_LIFETIME_SECONDS,WRECK_CAP,WRECK_CAP_LITE,CRASH_CAP,
 CRASH_LIFETIME_SECONDS,isWreckableUnit,isAircraftWreck,
 addWreckRecord,advanceWreckRecords,wreckSink
} from '../scripts/webgl-wreck-lifecycle.js';

test('burned wreck lifecycle discards debris after a short finite timeout',()=>{
 assert.equal(WRECK_LIFETIME_SECONDS,21);
 assert.ok(WRECK_CAP<=24&&WRECK_CAP_LITE<=WRECK_CAP);
 const records=[];
 assert.equal(addWreckRecord(records,{kind:'tank',x:400,y:500,angle:0}),true);
 assert.deepEqual(records.map(w=>w.kind),['tank']);
 assert.equal(advanceWreckRecords(records,12),true);
 assert.equal(records[0].age,12);
 assert.equal(wreckSink(records[0]),0);
 assert.equal(advanceWreckRecords(records,8),true);
 assert.equal(records[0].age,20);
 assert.ok(wreckSink(records[0])>0,'sinks into sand before expiry');
 assert.equal(advanceWreckRecords(records,1),true);
 assert.equal(records.length,0,'GPU instance eventually disappears');
 assert.equal(advanceWreckRecords(records,1),false);
});

test('wreck pool cannot grow during long combat and excludes infantry and medics',()=>{
 const records=[];
 assert.ok(isWreckableUnit('tank'));
 assert.ok(isWreckableUnit('rover'));
 assert.ok(isWreckableUnit('artillery'));
 assert.ok(isWreckableUnit('scout'));
 assert.ok(isWreckableUnit('bomber'));
 assert.equal(isWreckableUnit('infantry'),false);
 assert.equal(isWreckableUnit('engineer'),false);
 assert.equal(isWreckableUnit('medic'),false);
 assert.equal(isWreckableUnit('heavy'),false);
 assert.equal(isAircraftWreck('bomber'),true);
 assert.equal(isAircraftWreck('tank'),false);
 for(const kind of ['infantry','engineer','heavy','medic'])
  assert.equal(addWreckRecord(records,{kind,x:0,y:0,angle:0}),false);
 assert.equal(records.length,0);
 for(let i=0;i<500;i++)addWreckRecord(records,{kind:i%2?'rover':'tank',x:i*2,y:50,angle:i},WRECK_CAP_LITE);
 assert.equal(records.length,WRECK_CAP_LITE);
 assert.equal(records[0].x,(500-WRECK_CAP_LITE)*2);
 assert.equal(CRASH_CAP,6);
 assert.ok(CRASH_LIFETIME_SECONDS>1&&CRASH_LIFETIME_SECONDS<2.5);
});

test('rendered wrecks have rounded metallic geometry, no persistent black box slabs',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(vfx,/new THREE\.CylinderGeometry\(\.86,1,1,10,1\)/);
 assert.match(vfx,/new THREE\.DodecahedronGeometry\(1,0\)/);
 assert.match(vfx,/new THREE\.CylinderGeometry\(1,1,1,7\)/);
 assert.match(vfx,/this\.updateAircraftCrashes\(dt\)/);
 assert.match(vfx,/advanceWreckRecords\(this\.wrecks,dt\)/);
 assert.match(vfx,/else if\(isWreckableUnit\(old\.kind\)\)this\.addWreck\(old\)/);
 assert.match(vfx,/adoptAircraftForCrash\(entry\)/);
 assert.match(vfx,/guidedRocketAimY\(missile,targetUnit/);
 assert.doesNotMatch(vfx,/new THREE\.CapsuleGeometry\(1,2,4,8\)/);
 assert.match(battlefield,/this\.effects\?\.captureAircraftCrash\?\.\(e,removal\)/);
 assert.doesNotMatch(vfx,/new THREE\.BoxGeometry\(1,1,1\),wreckMat,90/);
 assert.match(actor,/this\.remnantSeconds=6/);
 assert.match(actor,/this\.maxRemnants=24/);
 assert.match(actor,/pose\.rotation\.x=Math\.PI\/2/);
 assert.match(actor,/entry\.node\.remove\(detail\)/);
 assert.match(actor,/this\.removeRemnant\(r\)/);
 assert.match(battlefield,/const recentDeath=!stillPresent/);
 assert.match(battlefield,/this\.game\.time-e\.lastAliveAt<=\.20/);
 assert.match(battlefield,/this\.presentation\.remove\(e,removal\)/);
 assert.match(build,/cpSync\('scripts\/webgl-wreck-lifecycle\.js','dist\/webgl-wreck-lifecycle\.js'\)/);
 assert.ok(existsSync('dist/webgl-wreck-lifecycle.js'));
});

test('age-based cleanup does not alter fixed-simulation orders, credits, saves or world',()=>{
 const records=[{kind:'bomber',x:350,y:405,yaw:0,age:5,ttl:21}];
 const initial=JSON.stringify(records.map(w=>[w.x,w.y,w.kind]));
 for(let i=0;i<100;i++)advanceWreckRecords(records,.05);
 assert.equal(JSON.stringify(records.map(w=>[w.x,w.y,w.kind])),initial);
 assert.equal(records[0].age>9,true);
 assert.equal(addWreckRecord(records,{kind:'bomber',x:Number.NaN,y:20}),false);
});
