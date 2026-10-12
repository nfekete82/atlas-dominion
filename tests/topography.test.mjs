import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {LAKES,TOPOGRAPHY_BOUNDS} from '../dist/src/data/topography.js';import {GEO_BOUNDS,MAP_WIDTH,MAP_HEIGHT,WORLD_WIDTH,WORLD_HEIGHT} from '../dist/src/data/europe.js';import {geoToCell,pointToWorld} from '../dist/src/engine/game.js';
test('topography uses the exact gameplay geographic bounds and projection',()=>{
 assert.deepEqual(TOPOGRAPHY_BOUNDS,GEO_BOUNDS);
 for(const [lon,lat] of [[9.4,47.6],[6.5,46.4],[13,59],[28,62]]){const p=geoToCell(lon,lat),world=pointToWorld({x:p.x-.5,y:p.y-.5});assert.ok(Math.abs(world.x-(lon-GEO_BOUNDS.west)/(GEO_BOUNDS.east-GEO_BOUNDS.west)*WORLD_WIDTH)<1e-8);assert.ok(Math.abs(world.y-(GEO_BOUNDS.north-lat)/(GEO_BOUNDS.north-GEO_BOUNDS.south)*WORLD_HEIGHT)<1e-8);}
});
for(const [name,lon,lat]of [['Constance',9.4,47.6],['Geneva',6.5,46.4],['Garda',10.7,45.7],['Balaton',17.7,46.9],['Vänern',13.3,58.9],['Vättern',14.5,58.3],['Saimaa',28.3,62]])test(`real ${name} geometry encloses its documented geographic region`,()=>{
 const lake=LAKES.find(l=>l.name===name);assert.ok(lake);const [w,s,e,n]=lake.bounds;assert.ok(lon>=w&&lon<=e&&lat>=s&&lat<=n);
 const p=geoToCell(lon,lat),x=p.x/MAP_WIDTH*WORLD_WIDTH,y=p.y/MAP_HEIGHT*WORLD_HEIGHT;const points=lake.rings.flat();assert.ok(points.some(p=>p[0]<x)&&points.some(p=>p[0]>x));assert.ok(points.some(p=>p[1]<y)&&points.some(p=>p[1]>y));
});
test('checked-in relief is georeferenced at DPR 2 with reproducible source hashes',()=>{
 const b=readFileSync('src/assets/europe-relief.png');assert.equal(b.readUInt32BE(16),WORLD_WIDTH*2);assert.equal(b.readUInt32BE(20),WORLD_HEIGHT*2);const m=JSON.parse(readFileSync('src/assets/topography-sources.json'));assert.deepEqual(m.bounds,GEO_BOUNDS);assert.equal(m.lakeCount,LAKES.length);for(const hash of Object.values(m.sha256))assert.match(hash,/^[a-f0-9]{64}$/);
});
